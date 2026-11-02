-- ============================================================================
-- Vértice DD — 0001 — núcleo do ambiente de due diligence
--
-- Convive com o schema do produto (retenção/governança). Não reusa
-- `institutions` como tenant: a fronteira aqui é o MANDATO, não a instituição.
-- Dois compradores concorrentes podem analisar o mesmo alvo e não podem se ver.
--
-- Nenhuma tabela desta migração guarda nome de aluno, CPF ou texto livre de
-- terceiro. Dado pessoal que entra no cofre fica no arquivo, não na tabela —
-- a tabela guarda metadado, hash e referência ao objeto no Storage.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type dd_side as enum ('buyer', 'seller', 'neutral');
create type dd_matter_status as enum ('draft', 'active', 'closing', 'closed', 'cancelled');
create type dd_member_role as enum (
  'matter_lead',      -- responde pelo mandato
  'analyst',          -- analisa requisito
  'reviewer',         -- revisa relatório
  'client_buyer',     -- cliente do lado comprador
  'client_seller',    -- cliente do lado vendedor
  'data_room_admin',  -- administra o cofre, não opina
  'wall_keeper',      -- existe nos dois lados, só metadados
  'client_observer'   -- cliente com leitura, sem edição
);

create type dd_requirement_status as enum (
  'not_sent', 'requested', 'received', 'in_review', 'compliant',
  'finding', 'not_applicable', 'not_provided'
);

create type dd_severity as enum ('red', 'amber', 'green');

create type dd_mechanism as enum (
  'condition_precedent', 'rep_warranty_general', 'rep_warranty_specific',
  'indemnity_capped', 'indemnity_uncapped', 'price_adjustment', 'escrow',
  'earn_out', 'price_holdback', 'remediation_budget', 'perimeter_exclusion',
  'informational'
);

create type dd_access_action as enum (
  'upload_url_issued', 'upload_confirmed', 'download_url_issued',
  'viewed', 'search_result', 'shared_link_created', 'purge_executed'
);

-- ---------------------------------------------------------------------------
-- Mandatos
-- ---------------------------------------------------------------------------

create table dd_matters (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,          -- ex.: 2026-0007
  title              text not null,                 -- nome interno do alvo
  target_name        text not null,                 -- nome do alvo
  target_cnpj_root   text,                          -- 8 dígitos, sem filial
  side               dd_side not null,
  status             dd_matter_status not null default 'draft',
  client_name        text not null,
  contract_ref       text,
  opened_at          timestamptz,
  closed_at          timestamptz,
  -- Prazo contratado de destruição do cofre após a entrega.
  purge_due_at       timestamptz,
  purged_at          timestamptz,
  scope_note         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint dd_matters_closed_needs_date
    check (status <> 'closed' or closed_at is not null),
  constraint dd_matters_purge_after_close
    check (purge_due_at is null or closed_at is null
           or purge_due_at >= closed_at)
);

create index dd_matters_target_idx on dd_matters (target_cnpj_root);
create index dd_matters_open_idx on dd_matters (status) where status in ('draft','active','closing');

-- ---------------------------------------------------------------------------
-- Parede entre mandatos
--
-- `dd_walls` é simétrica por construção: guarda o par ordenado (a < b) e a
-- função de checagem consulta as duas direções.
-- ---------------------------------------------------------------------------

create table dd_walls (
  id            uuid primary key default gen_random_uuid(),
  matter_a      uuid not null references dd_matters(id) on delete restrict,
  matter_b      uuid not null references dd_matters(id) on delete restrict,
  reason        text not null
                  check (reason in ('same_target_competing','same_target_opposing',
                                    'same_region','related_party','other')),
  -- consented_by_both só é verdadeiro quando existe termo assinado dos dois
  -- lados (opposing). Para same_target_competing a parede é absoluta e não
  -- depende de consentimento.
  consented_by_both boolean not null default false,
  consent_ref   text,
  is_absolute   boolean not null default true,
  created_by    uuid not null,
  created_at    timestamptz not null default now(),
  lifted_at     timestamptz,
  lifted_reason text,
  constraint dd_walls_distinct check (matter_a <> matter_b),
  constraint dd_walls_ordered check (matter_a < matter_b),
  constraint dd_walls_unique unique (matter_a, matter_b)
);

create index dd_walls_a_idx on dd_walls (matter_a) where lifted_at is null;
create index dd_walls_b_idx on dd_walls (matter_b) where lifted_at is null;

-- ---------------------------------------------------------------------------
-- Membros
-- ---------------------------------------------------------------------------

create table dd_matter_members (
  id            uuid primary key default gen_random_uuid(),
  matter_id     uuid not null references dd_matters(id) on delete cascade,
  user_id       uuid not null,
  role          dd_member_role not null,
  -- Escopo por frente (REG, FIN, TRIB, ...). Vazio = todas as frentes.
  front_scope   text[] not null default '{}',
  expires_at    timestamptz not null,               -- acesso sempre temporário
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (matter_id, user_id, role),
  constraint dd_members_expiry check (expires_at > created_at)
);

create index dd_members_user_idx on dd_matter_members (user_id)
  where revoked_at is null;
create index dd_members_matter_idx on dd_matter_members (matter_id, role)
  where revoked_at is null;

-- Wall keeper é uma qualificação que atravessa mandatos. Ele NÃO herda
-- acesso a documento: só lê metadado (ver a view dd_matter_metadata).
create table dd_wall_keepers (
  user_id       uuid primary key,
  appointed_by  uuid not null,
  appointed_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  note          text
);

-- ---------------------------------------------------------------------------
-- Conflitos declarados
-- ---------------------------------------------------------------------------

create table dd_conflicts (
  id              uuid primary key default gen_random_uuid(),
  matter_id       uuid not null references dd_matters(id) on delete cascade,
  kind            text not null check (kind in (
                    'prior_engagement_same_target','board_or_ownership',
                    'family_or_relationship','prior_opinion_published',
                    'competing_client','other')),
  description     text not null,
  treatment       text not null check (treatment in (
                    'accepted_with_wall','declined','no_conflict','pending')),
  affected_user   uuid,
  decided_by      uuid not null,
  decided_at      timestamptz not null default now(),
  -- Mandato não abre sem conflito declarado e tratado.
  constraint dd_conflicts_pending_needs_later_check check (treatment <> 'pending')
);

create index dd_conflicts_matter_idx on dd_conflicts (matter_id);

-- ---------------------------------------------------------------------------
-- Ciência da parede
-- ---------------------------------------------------------------------------

create table dd_acknowledgements (
  id             uuid primary key default gen_random_uuid(),
  matter_id      uuid not null references dd_matters(id) on delete cascade,
  user_id        uuid not null,
  wall_version   int not null,
  body_sha256    text not null,        -- hash do termo que a pessoa aceitou
  signed_at      timestamptz not null default now(),
  ip             inet,
  unique (matter_id, user_id, wall_version)
);

-- ---------------------------------------------------------------------------
-- Instrumento versionado
--
-- Reusa o desenho do produto (instrumentos versionados), mas separado: o
-- instrumento de DD não é o instrumento do INEP.
-- ---------------------------------------------------------------------------

create table dd_instruments (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,                    -- DD-VERTICE
  version        text not null,                    -- 1.0
  title          text not null,
  effective_from date not null,
  superseded_at  timestamptz,
  created_at     timestamptz not null default now(),
  unique (code, version)
);

create table dd_requirements (
  id             uuid primary key default gen_random_uuid(),
  instrument_id  uuid not null references dd_instruments(id) on delete cascade,
  code           text not null,                    -- REG-01
  front          text not null,                    -- REG
  subfront       text not null,
  question       text not null,
  expected_doc   text not null,
  criticality    text not null check (criticality in ('critical','high','normal','low')),
  default_mechanism dd_mechanism,
  unique (instrument_id, code)
);

create index dd_requirements_front_idx on dd_requirements (instrument_id, front);

-- ---------------------------------------------------------------------------
-- Cofre: documentos do mandato
-- ---------------------------------------------------------------------------

create table dd_documents (
  id             uuid primary key default gen_random_uuid(),
  matter_id      uuid not null references dd_matters(id) on delete cascade,
  storage_key    text not null,                    -- objeto no bucket
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes > 0),
  sha256         text not null,
  -- Sigilo do documento. `privileged` só é lido por matter_lead.
  classification text not null default 'restricted'
                   check (classification in ('public','internal','restricted','privileged')),
  -- Origem: quem enviou (vendedor) e para qual pedido.
  supplied_by    text,
  received_at    timestamptz,
  scan_status    text not null default 'pending_upload'
                   check (scan_status in ('pending_upload','pending_scan','clean','infected','failed')),
  purged_at      timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  -- Dentro de UM mandato a deduplicação por hash é correta: o mesmo arquivo
  -- anexado em duas frentes é um objeto, dois vínculos.
  unique (matter_id, sha256)
);

create index dd_documents_matter_idx on dd_documents (matter_id) where purged_at is null;
create index dd_documents_scan_idx on dd_documents (matter_id, scan_status);

-- ---------------------------------------------------------------------------
-- Tracker: estado de cada requisito no mandato
-- ---------------------------------------------------------------------------

create table dd_requirement_state (
  id              uuid primary key default gen_random_uuid(),
  matter_id       uuid not null references dd_matters(id) on delete cascade,
  requirement_id  uuid not null references dd_requirements(id) on delete restrict,
  status          dd_requirement_status not null default 'not_sent',
  owner_user      uuid,
  requested_at    timestamptz,
  received_at     timestamptz,
  not_applicable_reason text,
  note            text,
  updated_at      timestamptz not null default now(),
  unique (matter_id, requirement_id),
  constraint dd_state_na_needs_reason
    check (status <> 'not_applicable' or not_applicable_reason is not null)
);

create index dd_state_matter_status_idx on dd_requirement_state (matter_id, status);

create table dd_document_links (
  id           uuid primary key default gen_random_uuid(),
  matter_id    uuid not null references dd_matters(id) on delete cascade,
  document_id  uuid not null references dd_documents(id) on delete cascade,
  state_id     uuid not null references dd_requirement_state(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (state_id, document_id)
);

-- ---------------------------------------------------------------------------
-- Achados — a entidade que vira relatório e cláusula
-- ---------------------------------------------------------------------------

create table dd_findings (
  id                uuid primary key default gen_random_uuid(),
  matter_id         uuid not null references dd_matters(id) on delete cascade,
  code              text not null,                 -- AC-01, sequencial por mandato
  requirement_id    uuid not null references dd_requirements(id) on delete restrict,
  front             text not null,
  title             text not null,
  description       text not null,
  consequence       text not null,                 -- o que acontece, com quem, até quando
  severity          dd_severity not null,
  -- Valor em risco. NULL + value_unquantified = "não quantificado", nunca R$ 0.
  value_brl         numeric(16,2),
  value_unquantified boolean not null default false,
  value_basis       text,
  mechanism         dd_mechanism not null,
  mechanism_holder  text check (mechanism_holder in ('seller','buyer','both','third_party')),
  due_stage         text check (due_stage in ('pre_closing','closing','post_closing')),
  owner_user        uuid,
  resolved_at       timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (matter_id, code),
  constraint dd_finding_red_needs_consequence
    check (severity <> 'red' or length(btrim(consequence)) >= 20),
  constraint dd_finding_value_exclusive
    check (not (value_brl is not null and value_unquantified)),
  constraint dd_finding_positive check (value_brl is null or value_brl > 0)
);

create index dd_findings_matter_idx on dd_findings (matter_id, severity);

-- Histórico do achado: append-only. Mudança de severidade é evento novo.
create table dd_finding_history (
  id          uuid primary key default gen_random_uuid(),
  matter_id   uuid not null references dd_matters(id) on delete cascade,
  finding_id  uuid not null references dd_findings(id) on delete cascade,
  from_severity dd_severity,
  to_severity   dd_severity,
  from_mechanism dd_mechanism,
  to_mechanism   dd_mechanism,
  from_value    numeric(16,2),
  to_value      numeric(16,2),
  actor_id      uuid,
  note          text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plano de remediação (100 dias pós-closing)
-- ---------------------------------------------------------------------------

create table dd_actions (
  id           uuid primary key default gen_random_uuid(),
  matter_id    uuid not null references dd_matters(id) on delete cascade,
  finding_id   uuid references dd_findings(id) on delete set null,
  title        text not null,
  owner_user   uuid,
  due_date     date,
  done_at      timestamptz,
  cost_brl     numeric(16,2),
  status       text not null default 'open'
                 check (status in ('open','in_progress','done','cancelled')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Log de acesso ao cofre — append-only
-- ---------------------------------------------------------------------------

create table dd_document_access_log (
  id           bigserial primary key,
  matter_id    uuid not null references dd_matters(id) on delete cascade,
  document_id  uuid references dd_documents(id) on delete set null,
  actor_id     uuid,
  action       dd_access_action not null,
  result       text not null,
  purpose      text,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index dd_access_log_matter_idx on dd_document_access_log (matter_id, created_at desc);
create index dd_access_log_doc_idx on dd_document_access_log (document_id, created_at desc);


-- ============================================================================
-- Vértice DD — seed do instrumento v1.0
--
-- GERADO AUTOMATICAMENTE por scripts/gerar_seed_instrumento.py.
-- Não edite à mão: altere os módulos dados_*.py e gere de novo.
-- Requisitos: 305
-- ============================================================================

insert into dd_instruments (code, version, title, effective_from)
values ('DD-VERTICE', '1.0', 'Instrumento de Due Diligence Vértice', '2026-10-31')
on conflict (code, version) do nothing;

insert into dd_requirements
  (instrument_id, code, front, subfront, question, expected_doc,
   criticality, default_mechanism)
select i.id, v.code, v.front, v.subfront, v.question, v.expected_doc,
       v.criticality::text, v.default_mechanism::dd_mechanism
  from (values
    ('REG-01', 'REG', 'Credenciamento', 'Qual o ato de credenciamento vigente da mantida (numero, data, publicacao) e qual o prazo de validade?', 'Portaria de credenciamento + comprovante de publicacao no DOU', 'critical', 'condition_precedent'),
    ('REG-02', 'REG', 'Credenciamento', 'Existe pedido de recredenciamento protocolado dentro do prazo? Qual o numero do processo no e-MEC e a situacao atual?', 'Protocolo e-MEC + andamento', 'critical', 'indemnity_uncapped'),
    ('REG-03', 'REG', 'Credenciamento', 'O recredenciamento foi negado, arquivado ou esta com exigencia nao cumprida em algum momento nos ultimos 8 anos?', 'Historico de processos e-MEC', 'critical', 'escrow'),
    ('REG-04', 'REG', 'Credenciamento', 'Qual o tipo de credenciamento (faculdade, centro universitario, universidade) e ele suporta toda a oferta declarada, inclusive autonomia para criar cursos se houver?', 'Ato + relacao de cursos', 'high', 'price_adjustment'),
    ('REG-05', 'REG', 'Credenciamento', 'Houve mudanca de mantenedora, de denominacao ou de sede nos ultimos 5 anos? Foi regularmente aprovada?', 'Atos de alteracao + aprovacao no e-MEC', 'high', 'rep_warranty_specific'),
    ('REG-06', 'REG', 'Credenciamento', 'O PDI vigente esta aprovado e compativel com a operacao real (cursos, polos, vagas)?', 'PDI aprovado + ata de aprovacao', 'high', 'remediation_budget'),
    ('REG-07', 'REG', 'Credenciamento', 'Existe pedido de credenciamento EAD, de novos polos ou de novos cursos pendente de decisao? Qual o risco de indeferimento?', 'Protocolos e-MEC', 'high', 'earn_out'),
    ('REG-08', 'REG', 'Cursos', 'Relacao completa de cursos ofertados com o respectivo ato autorizativo, data de publicacao e situacao (autorizado, reconhecido, em renovacao)', 'Planilha de cursos + atos', 'critical', 'rep_warranty_specific'),
    ('REG-09', 'REG', 'Cursos', 'Existe curso em funcionamento sem reconhecimento, ou com reconhecimento vencido, ou com alunos formados em situacao irregular?', 'Cruzamento e-MEC x historico de colacao', 'critical', 'indemnity_uncapped'),
    ('REG-10', 'REG', 'Cursos', 'Para cada curso em renovacao de reconhecimento, qual o resultado ou a previsao da avaliacao? Ha risco de nao renovacao?', 'Relatorios de avaliacao + protocolos', 'critical', 'price_adjustment'),
    ('REG-11', 'REG', 'Cursos', 'Existe curso com conceito CPC 1 ou 2, ou com ciclo avaliativo pendente de encerramento?', 'Conceitos Enade/CPC', 'critical', 'earn_out'),
    ('REG-12', 'REG', 'Cursos', 'Quantas vagas estao autorizadas por curso e por turno, e quantas estao efetivamente ocupadas nos ultimos 3 anos?', 'Atos + Censo + dados internos', 'high', 'informational'),
    ('REG-13', 'REG', 'Cursos', 'Ha pedido de aumento de vagas em tramitacao? Desde quando, e qual a probabilidade regulatoria?', 'Protocolos e-MEC', 'normal', 'earn_out'),
    ('REG-14', 'REG', 'Cursos', 'Ha curso autorizado e nunca implantado, ou implantado e suspenso?', 'Atos + historico de oferta', 'normal', 'price_adjustment'),
    ('REG-15', 'REG', 'Cursos', 'Existe curso ofertado fora da sede ou em dependencia sem ato autorizativo?', 'Relacao de enderecos de funcionamento', 'high', 'condition_precedent'),
    ('REG-16', 'REG', 'EAD', 'Qual o credenciamento EAD vigente e quantos polos estao ativos, com ato de cada um?', 'Portaria EAD + relacao de polos', 'critical', 'price_adjustment'),
    ('REG-17', 'REG', 'EAD', 'Existe polo que opera sem autorizacao, com autorizacao vencida ou em municipio vedado?', 'Cruzamento polos x atos', 'critical', 'informational'),
    ('REG-18', 'REG', 'EAD', 'Qual o percentual de carga horaria a distancia em cursos presenciais e ele respeita o limite aplicavel ao curso e a epoca?', 'Matrizes + atos', 'high', 'remediation_budget'),
    ('REG-19', 'REG', 'EAD', 'Os ambientes virtuais, avaliacoes e polos atendem aos requisitos de infraestrutura e de biblioteca exigidos?', 'Relatorios de avaliacao + contratos de plataforma', 'normal', 'remediation_budget'),
    ('REG-20', 'REG', 'Supervisao', 'Existe processo de supervisao, termo de saneamento de deficiencias, medida cautelar ou auto de infracao aberto?', 'Processos + TSD + autos', 'critical', 'condition_precedent'),
    ('REG-21', 'REG', 'Supervisao', 'Ja houve reducao de vagas, suspensao de ingresso, suspensao de curso ou descredenciamento, ainda que revertido?', 'Historico do e-MEC', 'critical', 'indemnity_uncapped'),
    ('REG-22', 'REG', 'Supervisao', 'Existem denuncias, representacoes do Ministerio Publico ou acoes civis publicas contra a instituicao na area regulatoria?', 'Certidoes + acompanhamento processual', 'high', 'informational'),
    ('REG-23', 'REG', 'Supervisao', 'Existem prazos regulatorios perdidos ou em curso que exijam resposta imediata?', 'Agenda regulatoria', 'high', 'rep_warranty_specific'),
    ('REG-24', 'REG', 'FIES/PROUNI', 'Qual o termo de adesao ao FIES e ao PROUNI, sua vigencia e o historico de glosas e devolucoes?', 'Termos + relatorios de glosa', 'critical', 'price_adjustment'),
    ('REG-25', 'REG', 'FIES/PROUNI', 'Qual o percentual da receita dependente de FIES, PROUNI e financiamentos estaduais/municipais?', 'Demonstracoes por fonte de receita', 'critical', 'informational'),
    ('REG-26', 'REG', 'FIES/PROUNI', 'A instituicao atende aos requisitos de qualidade e de regularidade fiscal exigidos para permanecer nos programas?', 'Certidoes + conceitos', 'critical', 'condition_precedent'),
    ('REG-27', 'REG', 'FIES/PROUNI', 'Existe saldo de repasse a receber ou a devolver? Qual o valor e a idade?', 'Extratos e conciliacoes', 'high', 'price_adjustment'),
    ('REG-28', 'REG', 'Pos-graduacao', 'Existe programa de mestrado ou doutorado credenciado pela CAPES? Qual o conceito e a vigencia?', 'Documento de area + atos CAPES', 'high', 'price_adjustment'),
    ('REG-29', 'REG', 'Pos-graduacao', 'Ha proposta de APCN em avaliacao, ou programa em risco de descredenciamento?', 'Protocolos CAPES', 'normal', 'perimeter_exclusion'),
    ('REG-30', 'REG', 'Pos-graduacao', 'A oferta de pos-graduacao lato sensu tem ato autorizativo e registro dos cursos?', 'Atos + relacao de cursos', 'normal', 'rep_warranty_specific'),
    ('REG-31', 'REG', 'Censo', 'Os dados declarados ao Censo da Educacao Superior dos ultimos 3 anos conferem com a operacao real (alunos, docentes, cursos)?', 'Declaracoes do Censo + microdados', 'high', 'rep_warranty_specific'),
    ('REG-32', 'REG', 'Censo', 'Existe divergencia entre numero de alunos declarados e alunos pagantes que possa indicar inflacao de base?', 'Cruzamento Censo x financeiro', 'high', 'price_adjustment'),
    ('REG-33', 'REG', 'Censo', 'Os diplomas dos ultimos 5 anos foram registrados regularmente e ha controle de emissao?', 'Amostra de registros de diploma', 'high', 'informational'),
    ('REG-34', 'REG', 'Censo', 'Ha curso com dupla oferta (presencial e a distancia) sem ato para a segunda modalidade?', 'Atos + matrizes', 'high', 'condition_precedent'),
    ('QUA-01', 'QUA', 'IGC', 'Qual o IGC da instituicao nos ultimos 3 ciclos e qual a tendencia?', 'Conceitos IGC por ano', 'critical', 'earn_out'),
    ('QUA-02', 'QUA', 'IGC', 'Existe faixa de IGC que impede ou limita acesso a FIES/PROUNI, a financiamento bancario ou a expansao?', 'Norma aplicavel + conceito', 'critical', 'informational'),
    ('QUA-03', 'QUA', 'Enade', 'Quais os conceitos Enade por curso nos ultimos 3 ciclos e quais cursos nao participaram?', 'Conceitos por curso', 'high', 'earn_out'),
    ('QUA-04', 'QUA', 'CPC', 'Quais cursos tem CPC 1 ou 2 e qual o plano de recuperacao existente?', 'Conceitos + plano', 'critical', 'price_adjustment'),
    ('QUA-05', 'QUA', 'CPC', 'Qual o IDD e qual a diferenca entre o desempenho esperado e o observado?', 'Indicadores IDD', 'normal', 'informational'),
    ('QUA-06', 'QUA', 'Avaliacao in loco', 'Existem relatorios de avaliacao in loco dos ultimos 5 anos? Quais dimensoes ficaram abaixo de 3?', 'Relatorios completos', 'critical', 'remediation_budget'),
    ('QUA-07', 'QUA', 'Avaliacao in loco', 'O que foi prometido como melhoria nos PPCs e nos relatorios foi efetivamente executado?', 'Evidencias de execucao', 'high', 'informational'),
    ('QUA-08', 'QUA', 'Avaliacao in loco', 'A infraestrutura avaliada (laboratorios, biblioteca, salas) existe fisicamente e esta em condicoes?', 'Visita tecnica + laudos', 'high', 'informational'),
    ('QUA-09', 'QUA', 'CPA', 'A Comissao Propria de Avaliacao esta constituida, atuante e com relatorios?', 'Atas e relatorios da CPA', 'high', 'remediation_budget'),
    ('QUA-10', 'QUA', 'CPA', 'A autoavaliacao institucional gerou acoes verificaveis ou e documento de gaveta?', 'Relatorio + plano de acao', 'normal', 'informational'),
    ('QUA-11', 'QUA', 'PPC', 'Os PPCs estao atualizados conforme as diretrizes curriculares vigentes de cada curso?', 'PPCs + DCNs', 'high', 'remediation_budget'),
    ('QUA-12', 'QUA', 'PPC', 'Ha curso com matriz desatualizada em relacao a DCN, ou com carga horaria de extensao insuficiente?', 'Matrizes', 'high', 'remediation_budget'),
    ('QUA-13', 'QUA', 'Aprendizagem', 'Existe politica de avaliacao da aprendizagem documentada e aplicada?', 'Regulamento + amostra', 'normal', 'informational'),
    ('QUA-14', 'QUA', 'Aprendizagem', 'Qual a taxa de aprovacao, reprovacao e trancamento por curso nos ultimos 3 anos?', 'Relatorios academicos', 'high', 'informational'),
    ('QUA-15', 'QUA', 'Pesquisa', 'Existe producao cientifica, inovacao e extensao compativeis com o tipo de credenciamento?', 'Relatorios de producao', 'normal', 'informational'),
    ('QUA-16', 'QUA', 'Biblioteca', 'O acervo fisico e virtual atende ao numero de titulos e exemplares exigido por curso?', 'Inventario + contratos de base', 'high', 'informational'),
    ('QUA-17', 'QUA', 'Biblioteca', 'Os contratos de base digital estao vigentes e cobrem os cursos ofertados?', 'Contratos', 'normal', 'informational'),
    ('QUA-18', 'QUA', 'Laboratorios', 'Os laboratorios exigidos pela matriz existem, funcionam e tem responsavel tecnico?', 'Laudos + escala de uso', 'high', 'informational'),
    ('QUA-19', 'QUA', 'Nucleo docente', 'O NDE de cada curso esta constituido e atuante, com atas?', 'Portarias + atas', 'normal', 'informational'),
    ('QUA-20', 'QUA', 'Egressos', 'Existe acompanhamento de egressos e insercao profissional?', 'Relatorios', 'low', 'informational'),
    ('ACA-01', 'ACA', 'Corpo docente', 'Qual o quadro docente completo por curso: titulacao, regime de trabalho, tempo de casa e vinculo juridico?', 'Planilha de docentes + contratos', 'critical', 'informational'),
    ('ACA-02', 'ACA', 'Corpo docente', 'O percentual de mestres e doutores e o regime de tempo integral atendem ao exigido para o tipo de instituicao?', 'Cruzamento com norma', 'critical', 'remediation_budget'),
    ('ACA-03', 'ACA', 'Corpo docente', 'Existe docente contratado como pessoa juridica, bolsista ou sem registro, exercendo funcao de professor?', 'Contratos + folha', 'critical', 'informational'),
    ('ACA-04', 'ACA', 'Corpo docente', 'Ha docentes com titulacao declarada ao Censo superior a titulacao comprovada?', 'Diplomas + declaracoes', 'critical', 'informational'),
    ('ACA-05', 'ACA', 'Corpo docente', 'Qual a rotatividade docente dos ultimos 3 anos e quais cursos dependem de um unico professor?', 'Historico de admissao e demissao', 'high', 'price_holdback'),
    ('ACA-06', 'ACA', 'Corpo docente', 'Existem acordos de nao concorrencia, clausulas de permanencia ou bonus de retencao com docentes-chave?', 'Contratos', 'normal', 'price_holdback'),
    ('ACA-07', 'ACA', 'Coordenacao', 'Cada curso tem coordenador com dedicacao compativel, e ele permanece apos a operacao?', 'Portarias + contratos', 'high', 'price_holdback'),
    ('ACA-08', 'ACA', 'Coordenacao', 'Existe acumulo de coordenacao por uma mesma pessoa em cursos distintos?', 'Portarias', 'normal', 'informational'),
    ('ACA-09', 'ACA', 'Registro academico', 'O sistema academico e proprietario ou licenciado? Quem e o titular da licenca e ela e transferivel?', 'Contrato de licenca', 'critical', 'condition_precedent'),
    ('ACA-10', 'ACA', 'Registro academico', 'Os dados academicos sao exportaveis integralmente, ou ha dependencia de fornecedor?', 'Teste de exportacao', 'critical', 'condition_precedent'),
    ('ACA-11', 'ACA', 'Registro academico', 'Os historicos escolares e processos de colacao seguem o rito e ficam arquivados pelo prazo legal?', 'Amostra + politica de arquivo', 'high', 'informational'),
    ('ACA-12', 'ACA', 'Processos academicos', 'Existe regulamento de aproveitamento de estudos, transferencia e dispensa aplicado de forma consistente?', 'Regulamentos + amostra', 'normal', 'informational'),
    ('ACA-13', 'ACA', 'Processos academicos', 'Ha passivo de aluno formado sem cumprimento integral de carga horaria ou de estagio?', 'Auditoria de amostra', 'critical', 'informational'),
    ('ACA-14', 'ACA', 'Estagio', 'Os convenios de estagio estao vigentes e ha seguro e supervisao?', 'Convenios', 'normal', 'informational'),
    ('ACA-15', 'ACA', 'TCC e extensao', 'Existe registro de orientacao, TCC e atividades extensionistas conforme a matriz?', 'Registros', 'normal', 'informational'),
    ('ACA-16', 'ACA', 'Planejamento', 'Quem decide a abertura de turma e como? Existe criterio economico documentado?', 'Politica interna', 'normal', 'informational'),
    ('ACA-17', 'ACA', 'Planejamento', 'Existe turma com menos alunos que o custo de operacao justifica? Qual o subsidio cruzado?', 'Relatorio de turmas', 'high', 'informational'),
    ('ACA-18', 'ACA', 'Continuidade', 'Quais sao os 10 processos academicos criticos e quem os executa hoje?', 'Mapa de processos', 'high', 'informational'),
    ('ACA-19', 'ACA', 'Continuidade', 'A secretaria academica tem procedimento escrito e pessoal treinado?', 'Procedimentos', 'normal', 'informational'),
    ('ACA-20', 'ACA', 'Internacionalizacao', 'Existem convenios internacionais, dupla diplomação ou acordos com terceiros que gerem obrigacao?', 'Convenios', 'low', 'rep_warranty_specific'),
    ('FIN-01', 'FIN', 'Demonstrações', 'Quais as demonstracoes contabeis completas dos ultimos 5 anos, auditadas ou revisadas?', 'Balanco, DRE, DFC, DMPL e notas', 'critical', 'informational'),
    ('FIN-02', 'FIN', 'Demonstrações', 'Quem audita ou revisa as demonstracoes? Ha ressalva, enfase ou limitacao de escopo?', 'Relatorio de auditoria', 'critical', 'rep_warranty_specific'),
    ('FIN-03', 'FIN', 'Demonstrações', 'Ha demonstracoes intermediarias (ultimos 12 meses) que reflitam a operacao ate a data do mandato?', 'Balancetes, razao, extratos', 'high', 'price_adjustment'),
    ('FIN-04', 'FIN', 'Demonstrações', 'Existem demonstracoes da mantenedora e da mantida? Como e feito o consolidado?', 'Demonstracoes das duas', 'high', 'informational'),
    ('FIN-05', 'FIN', 'Demonstrações', 'O plano de contas e adequado a atividade educacional ou agrega receitas e custos de forma que esconde resultado?', 'Plano de contas', 'high', 'informational'),
    ('FIN-06', 'FIN', 'EBITDA', 'Qual o EBITDA dos ultimos 3 a 5 anos, mensal, e como ele varia no ciclo de matricula?', 'DRE mensal', 'critical', 'informational'),
    ('FIN-07', 'FIN', 'EBITDA', 'Quais despesas nao recorrentes, pessoais dos socios e relacionadas a partes ligadas estao na DRE?', 'Razao + contratos com ligadas', 'critical', 'informational'),
    ('FIN-08', 'FIN', 'EBITDA', 'Como estao tratados descontos comerciais, bolsas e convenios na DRE? Sao receita reduzida ou despesa?', 'Razao + politica comercial', 'critical', 'informational'),
    ('FIN-09', 'FIN', 'EBITDA', 'Ha receita de curso, de pos, de extensao, de aluguel ou de servico que nao faz parte do perimetro?', 'DRE por linha de receita', 'high', 'informational'),
    ('FIN-10', 'FIN', 'EBITDA', 'Existe subsidio cruzado entre cursos e unidades? Qual negocio e lucrativo e qual consome caixa?', 'DRE por curso e unidade', 'high', 'price_adjustment'),
    ('FIN-11', 'FIN', 'Receita', 'Qual a receita liquida por curso, turno e unidade nos ultimos 3 anos?', 'Relatorios gerenciais', 'critical', 'informational'),
    ('FIN-12', 'FIN', 'Receita', 'Qual o ticket medio, a politica de desconto e o efeito do reajuste anual sobre a base?', 'Politica + historico de reajuste', 'critical', 'informational'),
    ('FIN-13', 'FIN', 'Receita', 'Qual a evolucao do numero de alunos ativos, ingressantes e concluintes por semestre?', 'Censo interno', 'critical', 'informational'),
    ('FIN-14', 'FIN', 'Receita', 'Existe contrato de prestacao de servico com empresa ligada, mantenedora ou pessoa dos socios que gera receita?', 'Contratos interc ompany', 'high', 'informational'),
    ('FIN-15', 'FIN', 'Receita', 'Ha receita antecipada, semestralidade antecipada ou pacote cujo reconhecimento contabil e diferente do caixa?', 'Razao + politicas', 'high', 'informational'),
    ('FIN-16', 'FIN', 'Inadimplencia', 'Qual o indice de inadimplencia bruto e liquido por mes, e como e calculado?', 'Relatorio de aging', 'critical', 'informational'),
    ('FIN-17', 'FIN', 'Inadimplencia', 'A inadimplencia foi mascarada por renegociacao, parcelamento ou bolsa interna? Qual o impacto real?', 'Razao de renegociacoes', 'critical', 'informational'),
    ('FIN-18', 'FIN', 'Inadimplencia', 'Existe carteira de recebiveis proprios, antecipacao com banco ou cessao de credito?', 'Contratos financeiros', 'high', 'informational'),
    ('FIN-19', 'FIN', 'Inadimplencia', 'Qual a provisao para devedores duvidosos e ela e suficiente pela experiencia historica?', 'Notas explicativas', 'high', 'price_adjustment'),
    ('FIN-20', 'FIN', 'Inadimplencia', 'Ha processo de cobranca judicial relevante, e qual o custo e a taxa de recuperacao?', 'Relatorio de cobranca', 'normal', 'informational'),
    ('FIN-21', 'FIN', 'Caixa e dívida', 'Qual a posicao de caixa, aplicacoes e equivalentes na data-base?', 'Extratos + conciliacao', 'critical', 'informational'),
    ('FIN-22', 'FIN', 'Caixa e dívida', 'Qual o endividamento completo: bancario, com fornecedores, com partes ligadas, com tributos e com alunos?', 'Contratos + balanco', 'critical', 'informational'),
    ('FIN-23', 'FIN', 'Caixa e dívida', 'Existem garantias, avais, fiancas ou onus dados pelos socios ou pela instituicao a terceiros?', 'Certidoes de onus + contratos', 'critical', 'informational'),
    ('FIN-24', 'FIN', 'Caixa e dívida', 'Ha operacao de leasing, aluguel com contraprestacao variavel ou contrato de longo prazo nao registrado no balanco?', 'Contratos', 'high', 'informational'),
    ('FIN-25', 'FIN', 'Caixa e dívida', 'Existem dividendos ou distribuicoes aprovadas e nao pagas?', 'Atas + razao', 'high', 'informational'),
    ('FIN-26', 'FIN', 'Fornecedores', 'Quais os 20 maiores fornecedores, valores e contratos? Ha contrato com parte ligada?', 'Razao + contratos', 'high', 'informational'),
    ('FIN-27', 'FIN', 'Fornecedores', 'Existe dependencia de fornecedor unico (sistema, plataforma, conteudo, limpeza)?', 'Contratos', 'high', 'informational'),
    ('FIN-28', 'FIN', 'Fornecedores', 'Ha fornecedor com contrato que tenha clausula de mudanca de controle, rescisao ou pagamento antecipado?', 'Contratos', 'critical', 'condition_precedent'),
    ('FIN-29', 'FIN', 'Fornecedores', 'Existem dividas em atraso com fornecedores relevantes e risco de interrupcao?', 'Aging de pagamentos', 'high', 'price_adjustment'),
    ('FIN-30', 'FIN', 'Fornecedores', 'Ha fornecimento de servico por pessoa fisica ligada a socios sem contrato formal?', 'Razao + cadastro', 'high', 'informational'),
    ('FIN-31', 'FIN', 'Capital de giro', 'Qual a necessidade de capital de giro ao longo do ciclo de matricula? Ha pico de caixa negativo?', 'Fluxo de caixa mensal', 'critical', 'informational'),
    ('FIN-32', 'FIN', 'Capital de giro', 'A operacao sobrevive ao intervalo entre a assinatura de um contrato e o primeiro recebimento?', 'Fluxo projetado', 'high', 'informational'),
    ('FIN-33', 'FIN', 'Projeções', 'O plano de negocios apresentado pelo vendedor e consistente com o historico?', 'Plano + premissas', 'high', 'earn_out'),
    ('FIN-34', 'FIN', 'Projeções', 'O crescimento projetado depende de autorizacao regulatoria pendente?', 'Cruzamento com REG', 'critical', 'perimeter_exclusion'),
    ('FIN-35', 'FIN', 'Projeções', 'As premissas de retencao de alunos sao compativeis com a taxa historica de evasao?', 'Historico de permanencia', 'high', 'informational'),
    ('FIN-36', 'FIN', 'Controles', 'Existe controle interno minimo: conciliacao bancaria, segregacao de funcao e aprovacao de pagamento?', 'Descricao de controles + teste', 'high', 'informational'),
    ('FIN-37', 'FIN', 'Controles', 'Quem tem acesso ao internet banking e as senhas? Ha controle de dois fatores?', 'Politica + evidencia', 'high', 'informational'),
    ('FIN-38', 'FIN', 'Controles', 'Ha adiantamentos a socios, suprimentos ou emprestimos sem instrumento?', 'Razao', 'high', 'informational'),
    ('FIN-39', 'FIN', 'Controles', 'Existe processo de conciliacao entre arrecadacao, sistema academico e contabilidade?', 'Rotina + amostra', 'normal', 'informational'),
    ('FIN-40', 'FIN', 'Controles', 'Quais ferramentas financeiras, de cobranca e de pagamento sao usadas, e quem e o titular?', 'Contratos + acessos', 'high', 'informational'),
    ('TRIB-01', 'TRIB', 'Regime', 'Qual o regime tributario da mantenedora e da mantida (Lucro Real, Presumido, Simples)?', 'DCTF, ECF, contrato social', 'critical', 'informational'),
    ('TRIB-02', 'TRIB', 'Imunidade', 'A mantenedora e entidade sem fins lucrativos e invoca a imunidade do art. 150, VI, c, da CF? Quais os requisitos cumpridos?', 'Estatuto + escrituracao', 'critical', 'informational'),
    ('TRIB-03', 'TRIB', 'Imunidade', 'Ha risco de a estrutura de aquisicao romper a imunidade (por exemplo, mantenedora com fins lucrativos, distribuicao de resultado, remuneracao de dirigente)?', 'Estrutura societaria proposta', 'critical', 'informational'),
    ('TRIB-04', 'TRIB', 'Imunidade', 'A entidade cumpre os requisitos do art. 14 do CTN: aplicacao integral no Pais, escrituracao e nao distribuicao?', 'Escrituracao + atas', 'critical', 'informational'),
    ('TRIB-05', 'TRIB', 'CEBAS', 'Existe certificacao de entidade beneficente (CEBAS) e ela esta vigente? Quais os efeitos dela na folha?', 'CEBAS + processos', 'critical', 'informational'),
    ('TRIB-06', 'TRIB', 'CEBAS', 'A certificacao esta vinculada a mantenedora ou a mantida? O que acontece com a troca de controlador?', 'Atos + estatuto', 'critical', 'condition_precedent'),
    ('TRIB-07', 'TRIB', 'CEBAS', 'A instituicao cumpre os requisitos de gratuidade, de assistencia e de oferta de bolsas exigidos para a certificacao?', 'Relatorio de gratuidade', 'critical', 'informational'),
    ('TRIB-08', 'TRIB', 'Federal', 'Quais sao as situacoes fiscais e as dividas federais inscritas ou em discussao?', 'Certidoes + consulta', 'critical', 'condition_precedent'),
    ('TRIB-09', 'TRIB', 'Federal', 'Existem parcelamentos federais ativos? Quais as parcelas em atraso e o risco de rescisao?', 'Extratos de parcelamento', 'critical', 'informational'),
    ('TRIB-10', 'TRIB', 'Federal', 'Ha processo administrativo fiscal, autuacao ou mandado de seguranca em materia tributaria?', 'Processos e acompanhamento', 'high', 'informational'),
    ('TRIB-11', 'TRIB', 'Contribuições', 'Como sao calculadas e recolhidas a contribuicao previdenciaria patronal e a de terceiros sobre a folha?', 'Guias + folha', 'high', 'informational'),
    ('TRIB-12', 'TRIB', 'Contribuições', 'Ha retencao de INSS sobre servicos tomados e sobre docentes contratados como autonomos?', 'Notas + guias', 'high', 'informational'),
    ('TRIB-13', 'TRIB', 'Contribuições', 'Existe discussao sobre a base de calculo do PIS/COFINS sobre mensalidade e sobre creditos?', 'Processos + ECF', 'normal', 'informational'),
    ('TRIB-14', 'TRIB', 'Estadual e municipal', 'Quais as situacoes de ICMS e ISS sobre servicos educacionais no municipio da sede e dos polos?', 'Certidoes + guias', 'high', 'informational'),
    ('TRIB-15', 'TRIB', 'Estadual e municipal', 'O ISS esta sendo retido nos polos e nos municipios onde ha atividade?', 'Guias', 'high', 'informational'),
    ('TRIB-16', 'TRIB', 'Estadual e municipal', 'Ha IPTU e ITBI em aberto sobre imoveis da instituicao?', 'Certidoes', 'normal', 'informational'),
    ('TRIB-17', 'TRIB', 'Obrigações acessórias', 'As obrigacoes acessorias estao em dia (DCTF, EFD, ECF, DIRF, eSocial, REINF)?', 'Certidoes + protocolos', 'high', 'informational'),
    ('TRIB-18', 'TRIB', 'Obrigações acessórias', 'Existem declaracoes retificadoras pendentes ou erros conhecidos nao corrigidos?', 'Historico de retificacao', 'normal', 'informational'),
    ('TRIB-19', 'TRIB', 'Planejamento', 'Existe planejamento tributario relevante dos ultimos 5 anos que possa ser desconsiderado?', 'Parecer + estrutura', 'critical', 'indemnity_uncapped'),
    ('TRIB-20', 'TRIB', 'Planejamento', 'Ha operacao com parte ligada (aluguel de imovel dos socios, servico intragrupo) com preco fora do valor de mercado?', 'Contratos + comparativo', 'high', 'informational'),
    ('TRIB-21', 'TRIB', 'Planejamento', 'Existem incentivos fiscais estaduais ou municipais e qual a condicao de manutencao?', 'Atos de incentivo', 'normal', 'condition_precedent'),
    ('TRIB-22', 'TRIB', 'Fechamento', 'Ha prejuizo fiscal a compensar, credito de PIS/COFINS ou saldo de incentivo nao reconhecido?', 'ECF + controles', 'high', 'informational'),
    ('TRIB-23', 'TRIB', 'Fechamento', 'Quais os efeitos tributarios da operacao proposta: ganho de capital, ITBI, IRRF, JCP, amortizacao de agio?', 'Analise da estrutura', 'critical', 'informational'),
    ('TRIB-24', 'TRIB', 'Fechamento', 'A estrutura da operacao permite amortizar agio sobre base real e preserva o regime de tributos?', 'Modelo tributario', 'critical', 'informational'),
    ('TRIB-25', 'TRIB', 'Certidões', 'Quais certidoes negativas ou positivas com efeito de negativa existem hoje: federal, estadual, municipal, FGTS, trabalhista?', 'Certidoes', 'critical', 'condition_precedent'),
    ('TRIB-26', 'TRIB', 'Certidões', 'Qual o prazo de validade de cada certidao e como fica a condicao de fechamento se uma vencer no intervalo?', 'Certidoes', 'high', 'informational'),
    ('TRA-01', 'TRA', 'Contencioso', 'Quantas reclamacoes trabalhistas existem, com valor, fase e provisao?', 'Relatorio + acompanhamento', 'critical', 'price_adjustment'),
    ('TRA-02', 'TRA', 'Contencioso', 'Qual o historico de condenacoes dos ultimos 5 anos e qual o valor medio por reclamacao?', 'Acompanhamento', 'high', 'informational'),
    ('TRA-03', 'TRA', 'Contencioso', 'Existe execucao, penhora, bloqueio de bens ou acordo descumprido?', 'Processos', 'critical', 'informational'),
    ('TRA-04', 'TRA', 'Contencioso', 'Ha acao coletiva, procedimento do Ministerio Publico do Trabalho ou termo de ajustamento de conduta?', 'Procedimentos e TAC', 'critical', 'informational'),
    ('TRA-05', 'TRA', 'Contencioso', 'Existe acao trabalhista de dirigente sindical, gestante, acidentado ou estabilidade especial?', 'Processos', 'high', 'informational'),
    ('TRA-06', 'TRA', 'Folha', 'Qual o headcount, a folha mensal e o custo total de pessoal dos ultimos 3 anos?', 'Folha + CAGED', 'critical', 'informational'),
    ('TRA-07', 'TRA', 'Folha', 'Todos os empregados tem registro em carteira e eSocial, inclusive professores horistas?', 'eSocial + folha', 'critical', 'informational'),
    ('TRA-08', 'TRA', 'Folha', 'Quais servicos sao prestados por PJ que nao tem caracteristicas de PJ (subordinacao, pessoalidade, habitualidade)?', 'Contratos PJ + teste', 'critical', 'informational'),
    ('TRA-09', 'TRA', 'Folha', 'Existem estagiarios e aprendizes na proporcao legal e com contrato adequado?', 'Contratos', 'normal', 'informational'),
    ('TRA-10', 'TRA', 'Folha', 'Existem bolsistas ou prestadores sem vinculo executando atividade de professor?', 'Contratos', 'critical', 'informational'),
    ('TRA-11', 'TRA', 'Folha', 'A remuneracao de professores horistas considera tempo de atividade fora da sala (preparacao, correcao, orientacao)?', 'Convencao + calculo', 'critical', 'informational'),
    ('TRA-12', 'TRA', 'Folha', 'Ha pagamento em atraso, parcelado ou por fora do contracheque?', 'Razao + contracheque', 'critical', 'informational'),
    ('TRA-13', 'TRA', 'Folha', 'Existe banco de horas, escala especial ou acordo de prorrogacao formalizado coletivamente?', 'Acordos', 'normal', 'informational'),
    ('TRA-14', 'TRA', 'Folha', 'Como sao tratados os intervalos intrajornada e a jornada em periodo de matricula e de avaliacao?', 'Registros de ponto', 'high', 'informational'),
    ('TRA-15', 'TRA', 'Passivo', 'Foram recolhidos FGTS, INSS, IRRF e contribuicoes de todos os meses dos ultimos 5 anos?', 'GFIP/DCTFWeb + extratos FGTS', 'critical', 'informational'),
    ('TRA-16', 'TRA', 'Passivo', 'Existem ferias e 13o vencidos, ou passivo de ferias nao gozadas acumuladas?', 'Relatorio de ferias', 'high', 'informational'),
    ('TRA-17', 'TRA', 'Passivo', 'Ha horas extras nao pagas ou nao registradas, especialmente em coordenacao e secretaria?', 'Ponto + relato', 'high', 'informational'),
    ('TRA-18', 'TRA', 'Passivo', 'Existe plano de saude, previdencia privada ou beneficio prometido em contrato ou acordo coletivo?', 'Contratos + acordos', 'high', 'informational'),
    ('TRA-19', 'TRA', 'Passivo', 'Existem planos de carreira docente com direitos adquiridos e progressao automatica?', 'Plano de carreira', 'high', 'informational'),
    ('TRA-20', 'TRA', 'Passivo', 'Ha PLR, bonus, gratificacao ou comissao sem criterio documentado?', 'Contratos + politica', 'normal', 'informational'),
    ('TRA-21', 'TRA', 'Coletivo', 'Qual o sindicato patronal e o dos empregados, e quais as convencoes coletivas vigentes?', 'CCTs', 'high', 'informational'),
    ('TRA-22', 'TRA', 'Coletivo', 'Existe comissao de negociacao, historico de greve ou conflito coletivo?', 'Historico', 'normal', 'informational'),
    ('TRA-23', 'TRA', 'Coletivo', 'Existe contribuicao sindical, assistencial ou associativa descontada?', 'Folha', 'low', 'informational'),
    ('TRA-24', 'TRA', 'Saúde e segurança', 'Existem PCMSO, PGR/PPRA, LTCAT e laudos de insalubridade vigentes?', 'Laudos', 'high', 'informational'),
    ('TRA-25', 'TRA', 'Saúde e segurança', 'Ha CAT registrada, doenca ocupacional ou acidente grave nos ultimos 5 anos?', 'CAT + investigacao', 'high', 'informational'),
    ('TRA-26', 'TRA', 'Saúde e segurança', 'O fator acidentario de prevencao e o historico de afastamentos sao favoraveis ou geram majoracao?', 'Relatorio FAP', 'normal', 'informational'),
    ('TRA-27', 'TRA', 'Terceirizados', 'Quais servicos sao terceirizados (limpeza, seguranca, manutencao, call center) e com quais contratos?', 'Contratos', 'high', 'informational'),
    ('TRA-28', 'TRA', 'Terceirizados', 'As empresas terceirizadas estao com certidoes e recolhimentos em dia?', 'Certidoes dos fornecedores', 'high', 'informational'),
    ('TRA-29', 'TRA', 'Terceirizados', 'Existem servicos terceirizados que executam atividade-fim?', 'Contratos', 'high', 'informational'),
    ('TRA-30', 'TRA', 'Sucessão', 'Na estrutura de aquisicao proposta, ha sucessao trabalhista expressa? Quem responde pelos passivos anteriores?', 'Estrutura da operacao', 'critical', 'informational'),
    ('TRA-31', 'TRA', 'Sucessão', 'Existe garantia trabalhista, seguro ou deposito de passivo a ser liberado no fechamento?', 'Balanco', 'high', 'escrow'),
    ('TRA-32', 'TRA', 'Sucessão', 'Os direitos dos empregados sao afetados pela mudanca de controlador (aviso previo, plano de carreira, beneficio)?', 'Analise juridica', 'high', 'informational'),
    ('TRA-33', 'TRA', 'Previdenciário', 'Existe divida previdenciaria ajuizada, em parcelamento ou em contencioso administrativo?', 'Certidao + processos', 'critical', 'informational'),
    ('TRA-34', 'TRA', 'Previdenciário', 'A contribuicao sobre a folha esta sendo calculada sobre a base correta, incluindo professores horistas?', 'Calculo + guias', 'high', 'informational'),
    ('TRA-35', 'TRA', 'Documentação', 'Ha acordo de confidencialidade e nao concorrencia com ex-funcionarios-chave?', 'Contratos', 'normal', 'informational'),
    ('SOC-01', 'SOC', 'Estrutura societária', 'Qual a estrutura societaria completa: controladores, quotistas, participacoes e acordos parasociais?', 'Contrato social, alteracoes e acordo de socios', 'critical', 'informational'),
    ('SOC-02', 'SOC', 'Estrutura societária', 'Quem detem efetivamente a mantenedora, e ha beneficiario final declarado?', 'Organograma + declaracao', 'critical', 'informational'),
    ('SOC-03', 'SOC', 'Estrutura societária', 'Ha participacao cruzada, holding, offshore ou trust na cadeia de controle?', 'Organograma e paises', 'high', 'informational'),
    ('SOC-04', 'SOC', 'Estrutura societária', 'Existem restricoes a transferencia de quota ou acao (preferencia, tag/drag, aprovacao de terceiros)?', 'Estatuto e acordo de socios', 'critical', 'condition_precedent'),
    ('SOC-05', 'SOC', 'Estrutura societária', 'Mantenedora e mantida tem patrimonio e obrigacoes separados, ou ha confusao patrimonial?', 'Balanco e conciliacao de contas', 'critical', 'informational'),
    ('SOC-06', 'SOC', 'Estrutura societária', 'Ha outra entidade do grupo que presta servico a instituicao ou compartilha estrutura?', 'Organograma e contratos', 'high', 'informational'),
    ('SOC-07', 'SOC', 'Governança', 'Como a instituicao e governada: conselho, assembleia, diretoria, conselho fiscal?', 'Estatuto e atas', 'high', 'informational'),
    ('SOC-08', 'SOC', 'Governança', 'Ha concentracao de decisao em uma pessoa, e ela permanece depois da aquisicao?', 'Organograma e entrevistas', 'high', 'informational'),
    ('SOC-09', 'SOC', 'Governança', 'Existem conflitos entre socios, impugnacoes de ata ou discussao judicial societaria?', 'Processos e atas', 'critical', 'informational'),
    ('SOC-10', 'SOC', 'Governança', 'Ha ato de gestao ou de disposicao de bem social sem aprovacao exigida pelo estatuto?', 'Atas e registro de imoveis', 'high', 'informational'),
    ('SOC-11', 'SOC', 'Governança', 'Os dirigentes sao remunerados? Como? Ha risco de violacao do requisito de nao distribuicao de resultado?', 'Folha, atas e estatuto', 'critical', 'informational'),
    ('SOC-12', 'SOC', 'Governança', 'Existe conselho de administracao ou instancia com atribuicao deliberativa formal?', 'Estatuto', 'normal', 'informational'),
    ('SOC-13', 'SOC', 'Documentos societários', 'A documentacao societaria esta registrada e atualizada (NIRE, cartorio, CNPJ, inscricoes estaduais e municipais)?', 'Atos registrados', 'critical', 'condition_precedent'),
    ('SOC-14', 'SOC', 'Documentos societários', 'Ha inscricao como mantenedora educacional regular na Secretaria da Receita e no MEC?', 'Atos e-MEC', 'critical', 'condition_precedent'),
    ('SOC-15', 'SOC', 'Documentos societários', 'Todos os atos de alteracao de quadro societario e de administracao foram averbados?', 'Registros', 'high', 'informational'),
    ('SOC-16', 'SOC', 'Documentos societários', 'Ha procuracoes relevantes em vigor, e a quem foram outorgadas?', 'Procuracoes', 'high', 'informational'),
    ('SOC-17', 'SOC', 'Partes relacionadas', 'Quais contratos existem entre a instituicao e empresas dos socios, parentes ou terceiros ligados?', 'Contratos intercompany', 'critical', 'informational'),
    ('SOC-18', 'SOC', 'Partes relacionadas', 'Os contratos com partes ligadas sao a valor de mercado e tem sido executados?', 'Contratos + comparativo', 'high', 'informational'),
    ('SOC-19', 'SOC', 'Partes relacionadas', 'Ha emprestimo entre socios e empresa, ou entre empresa e terceiros, sem instrumento?', 'Razao + instrumentos', 'high', 'informational'),
    ('SOC-20', 'SOC', 'Integridade', 'Ha contratos com o poder publico? Ha registro no Portal da Transparencia e programa de integridade?', 'Contratos + programa', 'high', 'informational'),
    ('SOC-21', 'SOC', 'Integridade', 'Ha condenacao, acordo de leniencia ou processo de improbidade envolvendo a instituicao ou seus dirigentes?', 'Certidoes e processos', 'critical', 'indemnity_uncapped'),
    ('SOC-22', 'SOC', 'Integridade', 'Existem pagamentos a intermediarios, consultores ou agentes com comissao atipica?', 'Contratos + razao', 'critical', 'informational'),
    ('SOC-23', 'SOC', 'Integridade', 'Ha doacao ou patrocinio politico feito pela instituicao ou pelos socios?', 'Razao + registros eleitorais', 'high', 'informational'),
    ('SOC-24', 'SOC', 'Integridade', 'A instituicao tem politica anticorrupcao, canal de denuncia e codigo de conduta?', 'Politicas', 'normal', 'informational'),
    ('SOC-25', 'SOC', 'Propriedade intelectual', 'Qual material didatico e proprio, licenciado ou de livre acesso? Quem detem os direitos?', 'Contratos + registros', 'critical', 'informational'),
    ('SOC-26', 'SOC', 'Propriedade intelectual', 'A marca, o logo e os nomes dos cursos estao registrados no INPI, e em nome de quem?', 'Certificados INPI', 'high', 'condition_precedent'),
    ('SOC-27', 'SOC', 'Propriedade intelectual', 'Ha software, plataforma ou conteudo cujo direito e de professor, terceiro ou ex-socio?', 'Contratos + registros', 'high', 'informational'),
    ('SOC-28', 'SOC', 'Propriedade intelectual', 'Ha aula gravada, conteudo digital e imagem de professor com controle de direito de uso?', 'Termos', 'high', 'informational'),
    ('SOC-29', 'SOC', 'Propriedade intelectual', 'Existe marca comercial semelhante de terceiro ou risco de conflito de nome?', 'Busca INPI', 'normal', 'informational'),
    ('SOC-30', 'SOC', 'Propriedade intelectual', 'Na aquisicao, a marca e os dominios de internet sao transferiveis junto com a operacao?', 'Contratos + registros de dominio', 'critical', 'condition_precedent'),
    ('SOC-31', 'SOC', 'Contratos críticos', 'Quais contratos tem clausula de mudanca de controle, rescisao por aquisicao ou vencimento antecipado?', 'Inventario de contratos', 'critical', 'condition_precedent'),
    ('SOC-32', 'SOC', 'Contratos críticos', 'Existem contratos com exclusividade, nao concorrencia ou minimo de compra?', 'Contratos', 'high', 'informational'),
    ('SOC-33', 'SOC', 'Contratos críticos', 'Ha contrato de fornecimento de sistema academico, plataforma ou pagamento com lock-in?', 'Contratos', 'high', 'informational'),
    ('SOC-34', 'SOC', 'Contratos críticos', 'Ha convenio com empresas, prefeituras ou outra instituicao que gera receita ou aluno?', 'Convenios', 'high', 'informational'),
    ('SOC-35', 'SOC', 'Contratos críticos', 'Existe garantia, fiança ou aval da instituicao em favor de terceiros?', 'Balanco + certidoes', 'critical', 'informational'),
    ('SOC-36', 'SOC', 'Seguros', 'Quais apolices existem (predial, responsabilidade civil, D&O, vida, acidentes) e para quais riscos?', 'Apolices', 'high', 'informational'),
    ('SOC-37', 'SOC', 'Seguros', 'Ha sinistro relevante nos ultimos 5 anos? Como foi tratado?', 'Historico de sinistro', 'normal', 'informational'),
    ('SOC-38', 'SOC', 'Contingências', 'Quais processos judiciais e administrativos existem, com valor e risco de perda?', 'Relatorio de contingencias', 'critical', 'price_adjustment'),
    ('SOC-39', 'SOC', 'Contingências', 'As contingencias estao integralmente provisionadas no balanco?', 'Notas explicativas', 'critical', 'price_adjustment'),
    ('SOC-40', 'SOC', 'Contingências', 'Existem contingencias que nao estao no balanco e sao conhecidas apenas pelos socios?', 'Entrevistas', 'critical', 'indemnity_uncapped'),
    ('IMO-01', 'IMO', 'Titularidade', 'Qual o imovel de cada unidade e polo: proprio, alugado, cedido ou comodato?', 'Matriculas e contratos', 'critical', 'informational'),
    ('IMO-02', 'IMO', 'Titularidade', 'Se proprio, o imovel esta livre de onus, hipoteca, alienacao fiduciaria e penhora?', 'Certidao de matricula atualizada', 'critical', 'condition_precedent'),
    ('IMO-03', 'IMO', 'Titularidade', 'Se alugado, qual o prazo, o indice de reajuste, a garantia e a clausula de alteracao de controle?', 'Contrato de locacao', 'critical', 'condition_precedent'),
    ('IMO-04', 'IMO', 'Titularidade', 'O imovel pertence a socio ou a empresa ligada? O aluguel e a valor de mercado?', 'Contrato + laudo', 'critical', 'informational'),
    ('IMO-05', 'IMO', 'Titularidade', 'O uso do imovel para fins educacionais e permitido pela legislacao de uso do solo e pelo condominio?', 'Alvara + convencao', 'critical', 'informational'),
    ('IMO-06', 'IMO', 'Titularidade', 'Ha processo de desapropriacao, ação possessoria ou litigio sobre o imovel?', 'Certidoes e processos', 'critical', 'informational'),
    ('IMO-07', 'IMO', 'Titularidade', 'Existe imovel em nome de pessoa fisica dos socios que sera transferido na operacao? Como?', 'Estrutura da operacao', 'high', 'informational'),
    ('IMO-08', 'IMO', 'Regularidade', 'Ha habite-se, auto de conclusao de obra e certidao de regularidade?', 'Documentos do imovel', 'critical', 'informational'),
    ('IMO-09', 'IMO', 'Regularidade', 'O AVCB ou o CLCB do Corpo de Bombeiros esta vigente? Ha projeto aprovado?', 'AVCB', 'critical', 'informational'),
    ('IMO-10', 'IMO', 'Regularidade', 'As instalações atendem a acessibilidade (Decreto 5.296/2004 e NBR 9050), com laudo?', 'Laudo de acessibilidade', 'critical', 'informational'),
    ('IMO-11', 'IMO', 'Regularidade', 'Ha laudo eletrico, laudo de gas, laudo estrutural, laudo de elevador e de exaustao?', 'Laudos tecnicos', 'high', 'informational'),
    ('IMO-12', 'IMO', 'Regularidade', 'Existe auto de infração, embargo ou exigencia da vigilancia sanitaria na unidade?', 'Autos e certidoes', 'critical', 'informational'),
    ('IMO-13', 'IMO', 'Regularidade', 'Ha area construida alem do autorizado (ampliacao, mezanino, tenda), ou area comum invadida?', 'Cruzamento de projetos', 'high', 'informational'),
    ('IMO-14', 'IMO', 'Regularidade', 'Os polos fora da sede tem sede fisica, contrato e alvara proprio no municipio?', 'Contratos e alvaras', 'critical', 'informational'),
    ('IMO-15', 'IMO', 'Regularidade', 'Existe alvara de funcionamento educacional atualizado no municipio?', 'Alvara', 'critical', 'condition_precedent'),
    ('IMO-16', 'IMO', 'Infraestrutura', 'Biblioteca fisica e virtual: area, acervo, acessos e condicoes de uso', 'Inventario e visita', 'high', 'informational'),
    ('IMO-17', 'IMO', 'Infraestrutura', 'Laboratorios: quais, quantos, com equipamentos funcionando e responsavel tecnico', 'Laudos e escala', 'high', 'informational'),
    ('IMO-18', 'IMO', 'Infraestrutura', 'Salas de aula e capacidade instalada sao suficientes para as vagas autorizadas?', 'Planta e medicao', 'high', 'informational'),
    ('IMO-19', 'IMO', 'Infraestrutura', 'Ha climatizacao, rede, energia de reserva e conectividade adequadas?', 'Relatorio tecnico', 'normal', 'informational'),
    ('IMO-20', 'IMO', 'Infraestrutura', 'Ha plano de manutencao preventiva e custo historico de manutencao?', 'Plano e razao', 'normal', 'informational'),
    ('IMO-21', 'IMO', 'Infraestrutura', 'Ha espacos de convivencia, atendimento, acessibilidade e apoio ao aluno?', 'Visita', 'normal', 'informational'),
    ('IMO-22', 'IMO', 'Infraestrutura', 'Existe estacionamento, area de seguranca, controle de acesso e camara?', 'Visita', 'low', 'informational'),
    ('IMO-23', 'IMO', 'Ocupação', 'Qual a taxa de ocupacao de salas, laboratorio e biblioteca por turno?', 'Relatorio de alocacao', 'high', 'informational'),
    ('IMO-24', 'IMO', 'Ocupação', 'Existe espaco subutilizado que poderia ser monetizado ou devolvido?', 'Planta e contrato', 'normal', 'informational'),
    ('IMO-25', 'IMO', 'Ocupação', 'A capacidade instalada suporta o crescimento que o plano de negocios projeta?', 'Cruzamento com plano', 'high', 'informational'),
    ('IMO-26', 'IMO', 'Despesas', 'Quais sao as despesas de condominio, IPTU, seguros e utilidades por unidade?', 'Razao + contas', 'high', 'informational'),
    ('IMO-27', 'IMO', 'Despesas', 'Ha despesa de imovel de unidade sem uso ou de polo encerrado?', 'Razao', 'normal', 'informational'),
    ('IMO-28', 'IMO', 'Despesas', 'Ha contrato de energia renovavel ou outro de longo prazo que sera transferido?', 'Contratos', 'normal', 'condition_precedent'),
    ('IMO-29', 'IMO', 'Despesas', 'Existe dívida de IPTU ou condominio em atraso?', 'Certidoes', 'high', 'informational'),
    ('IMO-30', 'IMO', 'Despesas', 'Qual o valor de mercado atual de locacao por metro quadrado da regiao comparado ao contratado?', 'Pesquisa de mercado', 'high', 'informational'),
    ('CON-01', 'CON', 'Contrato de matrícula', 'Qual o contrato de prestacao de servico educacional e ele esta atualizado com a legislacao?', 'Contrato modelo', 'critical', 'informational'),
    ('CON-02', 'CON', 'Contrato de matrícula', 'O contrato informa aprovacao regulamentar do curso, valor, reajuste e condicoes de cancelamento?', 'Contrato + amostra', 'high', 'informational'),
    ('CON-03', 'CON', 'Contrato de matrícula', 'Existe clausula abusiva conhecida (multa de cancelamento, retencao de documento, cobranca de matricula sem servico)?', 'Contrato + jurisprudencia', 'high', 'informational'),
    ('CON-04', 'CON', 'Contrato de matrícula', 'Ha garantia de direito de cancelamento e devolucao conforme o CDC?', 'Contrato + politica', 'high', 'informational'),
    ('CON-05', 'CON', 'Reajuste', 'Como e aplicado o reajuste anual? Ha planilha de custo e comunicacao previa?', 'Planilha + comunicado', 'critical', 'informational'),
    ('CON-06', 'CON', 'Reajuste', 'Qual a evolucao do reajuste frente ao indice setorial nos ultimos 3 anos?', 'Historico', 'high', 'informational'),
    ('CON-07', 'CON', 'Reajuste', 'Ha diferenca entre o reajuste aplicado aos alunos e o repasse de custo docente?', 'Cruzamento', 'normal', 'informational'),
    ('CON-08', 'CON', 'Bolsas', 'Qual o valor e a quantidade de bolsas, descontos e convenios aplicados, e ha contrato para cada um?', 'Razao + contratos de convenio', 'critical', 'informational'),
    ('CON-09', 'CON', 'Bolsas', 'Bolsas e descontos sao revogaveis ou tem promessa de continuidade?', 'Contratos', 'critical', 'informational'),
    ('CON-10', 'CON', 'Bolsas', 'A instituicao cumpre o desconto obrigatorio para pessoa com deficiencia (Lei 13.146/2015) e as cotas e gratuidades exigiveis?', 'Evidencia', 'high', 'informational'),
    ('CON-11', 'CON', 'Matrícula', 'Qual a taxa de ingresso, retencao e evasao por curso e periodo?', 'Relatorios academicos', 'critical', 'informational'),
    ('CON-12', 'CON', 'Matrícula', 'Qual o desgaste entre inscricao, matricula e confirmacao de pagamento?', 'Funil comercial', 'high', 'informational'),
    ('CON-13', 'CON', 'Matrícula', 'Existe accordeo ou cancelamento com devolucao? Qual o valor acumulado?', 'Razao', 'high', 'informational'),
    ('CON-14', 'CON', 'Matrícula', 'Ha aluno inadimplente com matricula mantida por decisao interna, sem registro?', 'Cruzamento academico x financeiro', 'high', 'informational'),
    ('CON-15', 'CON', 'Carteira', 'Como e o perfil da carteira de alunos por curso, turno e unidade, e ha concentracao?', 'Relatorio', 'high', 'informational'),
    ('CON-16', 'CON', 'Contencioso', 'Quantas acoes de aluno existem (cobranca, cancelamento, reajuste, qualidade, diploma)?', 'Relatorio de processos', 'critical', 'price_adjustment'),
    ('CON-17', 'CON', 'Contencioso', 'Existe acao coletiva, procedimento no PROCON ou inquerito civil contra a instituicao?', 'Processos', 'critical', 'informational'),
    ('CON-18', 'CON', 'Contencioso', 'Ha dano moral relevante, caso de assedio ou caso com repercussao publica?', 'Processos e midia', 'critical', 'informational'),
    ('CON-19', 'CON', 'Contencioso', 'Existem alunos com pedido de diploma negado ou reconhecimento de curso pendente?', 'Relatorios', 'critical', 'informational'),
    ('CON-20', 'CON', 'Publicidade', 'A publicidade usada pela instituicao informa corretamente situacao de reconhecimento, infraestrutura e precos?', 'Amostra de pecas publicitarias', 'high', 'informational'),
    ('CON-21', 'CON', 'Satisfação', 'Existe pesquisa de satisfacao aplicada com resultado?', 'Relatorios', 'normal', 'informational'),
    ('CON-22', 'CON', 'Satisfação', 'Qual a nota da instituicao em avaliacoes publicas, Reclame Aqui e redes?', 'Consulta', 'normal', 'informational'),
    ('CON-23', 'CON', 'Satisfação', 'Existem conflitos recorrentes com estudantes (falta de professor, turma fechada, alteracao de horario)?', 'Registros de atendimento', 'high', 'informational'),
    ('CON-24', 'CON', 'Satisfação', 'Existe canal de ouvidoria e ele registra e trata?', 'Politica', 'low', 'informational'),
    ('CON-25', 'CON', 'Comercial', 'Quem faz a captacao? Ha equipe propria, terceirizada ou comissionada?', 'Contratos + folha', 'high', 'informational'),
    ('CON-26', 'CON', 'Comercial', 'Qual o custo de aquisicao de aluno por canal?', 'Relatorio de midia', 'high', 'informational'),
    ('CON-27', 'CON', 'Comercial', 'Ha dependencia de um canal ou de um parceiro de captacao?', 'Contratos', 'high', 'informational'),
    ('CON-28', 'CON', 'Comercial', 'Existe preposto, agente ou corretor com promessa verbal de desconto?', 'Contratos e registros', 'normal', 'informational'),
    ('CON-29', 'CON', 'Comercial', 'Ha convenio de desconto com empresas, sindicatos ou poder publico com obrigacao de manter?', 'Convenios', 'high', 'informational'),
    ('CON-30', 'CON', 'Comercial', 'Na aquisicao, os contratos de captacao e de convenio continuam valendo?', 'Contratos', 'critical', 'condition_precedent'),
    ('DAD-01', 'DAD', 'Base legal', 'Qual e a base legal declarada para tratamento de dado de candidato, aluno, responsavel e empregado?', 'Politica de privacidade + ROPA', 'critical', 'informational'),
    ('DAD-02', 'DAD', 'Base legal', 'Existe registro das operacoes de tratamento e ele esta atualizado?', 'ROPA', 'critical', 'informational'),
    ('DAD-03', 'DAD', 'Base legal', 'Existe encarregado de dados designado e divulgado?', 'Ato de designacao', 'high', 'informational'),
    ('DAD-04', 'DAD', 'Base legal', 'Dado de aluno menor de idade tem tratamento especifico de responsavel?', 'Politica + consentimento', 'critical', 'informational'),
    ('DAD-05', 'DAD', 'Transferência', 'Quais dados pessoais a instituicao compartilha com terceiros (plataforma, banco, FIES, convenio)?', 'Contratos', 'high', 'informational'),
    ('DAD-06', 'DAD', 'Transferência', 'Os contratos com operadores tem clausula de LGPD, instrucao e auditoria?', 'Contratos', 'high', 'informational'),
    ('DAD-07', 'DAD', 'Transferência', 'Ha transferencia internacional de dado (nuvem, plataforma estrangeira)? Qual o mecanismo?', 'Contratos + regiao', 'high', 'informational'),
    ('DAD-08', 'DAD', 'Transferência', 'Ha venda, cessao ou uso comercial de base de dados de aluno?', 'Contratos', 'critical', 'informational'),
    ('DAD-09', 'DAD', 'Segurança', 'Existem incidentes de seguranca conhecidos nos ultimos 5 anos? Houve comunicacao a ANPD e aos titulares?', 'Registro de incidentes', 'critical', 'informational'),
    ('DAD-10', 'DAD', 'Segurança', 'Ha controle de acesso, autenticacao multifator, criptografia e backup testado?', 'Relatorio tecnico', 'high', 'informational'),
    ('DAD-11', 'DAD', 'Segurança', 'Existe plano de resposta a incidente e testado?', 'Plano', 'normal', 'informational'),
    ('DAD-12', 'DAD', 'Segurança', 'As senhas, tokens e chaves de sistema estao sob controle de quem?', 'Inventario de acessos', 'critical', 'informational'),
    ('DAD-13', 'DAD', 'Retenção', 'Existe politica de retencao e eliminacao que cumpra o prazo legal de guarda academica?', 'Politica', 'high', 'informational'),
    ('DAD-14', 'DAD', 'Retenção', 'Dados de candidato nao matriculado sao eliminados no prazo?', 'Evidencia', 'high', 'informational'),
    ('DAD-15', 'DAD', 'Retenção', 'Existem backups antigos com dado de aluno sem controle?', 'Inventario de backup', 'normal', 'informational'),
    ('DAD-16', 'DAD', 'Titulares', 'Existem pedidos de titular e eles sao atendidos no prazo?', 'Registro', 'high', 'informational'),
    ('DAD-17', 'DAD', 'Titulares', 'O status ativo ou inativo de sistema e o que impede o vazamento?', 'Inventario', 'high', 'informational'),
    ('DAD-18', 'DAD', 'Aquisição', 'Na transferencia de base para o comprador, ha base legal para continuidade do tratamento?', 'Analise', 'critical', 'condition_precedent'),
    ('DAD-19', 'DAD', 'Aquisição', 'O contrato de compra preve tratamento de dado pessoal, finalidade, retencao e destruicao?', 'Minuta do SPA', 'critical', 'informational'),
    ('DAD-20', 'DAD', 'Aquisição', 'No data room, ha dado pessoal desnecessario e como ele sera eliminado apos o processo?', 'Procedimento', 'critical', 'informational'),
    ('DAD-21', 'DAD', 'Arquivo', 'Os documentos academicos sao digitalizados com integridade e rastreabilidade?', 'Inventario', 'high', 'informational'),
    ('DAD-22', 'DAD', 'Arquivo', 'Existe politica de retencao de documento academico pelo prazo exigido?', 'Politica', 'high', 'informational'),
    ('DAD-23', 'DAD', 'Arquivo', 'Ha documento em papel em risco (umidade, incendio, perda)?', 'Visita', 'high', 'informational'),
    ('DAD-24', 'DAD', 'Arquivo', 'O sistema academico guarda historico de alteracao de nota, matricula e historico?', 'Analise tecnica', 'high', 'informational'),
    ('DAD-25', 'DAD', 'Governança', 'Existe comite ou responsavel de privacidade com funcao definida?', 'Organograma', 'normal', 'informational'),
    ('DAD-26', 'DAD', 'Governança', 'O treinamento de lgpd foi aplicado a quem tem acesso a dado pessoal?', 'Registro', 'low', 'informational'),
    ('DAD-27', 'DAD', 'Governança', 'Ha contrato de tratamento com a plataforma de aprendizagem e com o provedor de nuvem?', 'Contratos', 'high', 'informational'),
    ('DAD-28', 'DAD', 'Governança', 'A instituicao trata dado sensivel de saude (atendimento, acessibilidade, laudo)? Como?', 'Politica', 'critical', 'informational'),
    ('DAD-29', 'DAD', 'Governança', 'Existe avaliacao de impacto (RIPD) para os tratamentos de maior risco?', 'RIPD', 'normal', 'informational'),
    ('DAD-30', 'DAD', 'Governança', 'A instituicao tem registro de quem acessou dado pessoal e faz auditoria?', 'Log', 'high', 'informational')
  ) as v(code, front, subfront, question, expected_doc, criticality, default_mechanism)
  join dd_instruments i on i.code = 'DD-VERTICE' and i.version = '1.0' and i.superseded_at is null
on conflict (instrument_id, code) do nothing;


-- Vértice Aquisições: API do portal master. Aplicar após core e seed.
-- O catálogo é global; todos os registros de cliente têm institution_id e matter_id.
create schema if not exists dd_private;
revoke all on schema dd_private from public,anon;
grant usage on schema dd_private to authenticated;
alter table public.dd_matters add column institution_id uuid not null references public.vertice_institutions(id);
alter table public.dd_matters add column revision bigint not null default 1;
alter table public.dd_matters add column created_by uuid references auth.users(id);
alter table public.dd_matters add column instrument_id uuid references public.dd_instruments(id);
alter table public.dd_requirement_state add column answer text not null default '';
alter table public.dd_document_links add column evidence_location text not null default '';
alter table public.dd_actions add column owner_label text;
alter table public.dd_actions add column note text;
alter table public.dd_findings add column owner_label text;
alter table public.dd_documents add column front text not null default 'SOC';

create table public.dd_workspace(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 matter_id uuid not null references public.dd_matters(id),
 kind text not null check(kind in ('scope','financial','review','opinion')),
 key text not null default '',body jsonb not null default '{}',
 basis_revision bigint,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(matter_id,kind,key)
);
create table public.dd_audit(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.vertice_institutions(id),
 matter_id uuid not null references public.dd_matters(id),
 actor_id uuid not null references auth.users(id),action text not null,
 detail jsonb not null default '{}',created_at timestamptz not null default now()
);
-- Parede usa duas chaves de mandato e duas de instituição.
alter table public.dd_walls add column institution_id uuid references public.vertice_institutions(id);
alter table public.dd_walls add column other_institution_id uuid references public.vertice_institutions(id);
do $$ declare t text; begin
 foreach t in array array['dd_matter_members','dd_conflicts','dd_acknowledgements','dd_documents','dd_requirement_state','dd_document_links','dd_findings','dd_finding_history','dd_actions','dd_document_access_log'] loop
 execute format('alter table public.%I add column institution_id uuid not null references public.vertice_institutions(id)',t);
 end loop;
end $$;
create function dd_private.tenant_guard() returns trigger language plpgsql set search_path='' as $$
declare i uuid;begin
 select institution_id into i from public.dd_matters where id=new.matter_id;
 if i is null or (new.institution_id is not null and new.institution_id<>i) then raise exception 'Instituição incompatível com o mandato.';end if;
 new.institution_id=i;return new;end;$$;
do $$ declare t text;begin
 foreach t in array array['dd_matter_members','dd_conflicts','dd_acknowledgements','dd_documents','dd_requirement_state','dd_document_links','dd_findings','dd_finding_history','dd_actions','dd_document_access_log','dd_workspace','dd_audit'] loop
 execute format('create trigger dd_tenant before insert or update on public.%I for each row execute function dd_private.tenant_guard()',t);
 execute format('create index on public.%I(institution_id,matter_id)',t);
 end loop;
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'dd_%' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
create function dd_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Histórico imutável.';end;$$;
create trigger dd_audit_immutable before update or delete on public.dd_audit for each row execute function dd_private.immutable();
create trigger dd_history_immutable before update or delete on public.dd_finding_history for each row execute function dd_private.immutable();
create trigger dd_access_immutable before update or delete on public.dd_document_access_log for each row execute function dd_private.immutable();

create function dd_private.master() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
 and exists(select 1 from public.vertice_admins where user_id=auth.uid());$$;
create function dd_private.role_for(m uuid,f text default null) returns text language sql stable security definer set search_path='' as $$
 select x.role::text from public.dd_matter_members x where x.matter_id=m and x.user_id=auth.uid()
 and auth.uid() is not null and coalesce(auth.jwt()->>'aal','')='aal2'
 and x.revoked_at is null and x.expires_at>now() and x.role<>'wall_keeper'
 and (f is null or cardinality(x.front_scope)=0 or f=any(x.front_scope))
 order by case x.role when 'matter_lead' then 0 when 'analyst' then 1 when 'reviewer' then 2 else 3 end limit 1;$$;
create function dd_private.member_wall() returns trigger language plpgsql set search_path='' as $$
begin
 if new.revoked_at is not null or new.expires_at<=now() then return new;end if;
 if exists(select 1 from public.dd_walls w join public.dd_matter_members x
 on x.matter_id=case when w.matter_a=new.matter_id then w.matter_b else w.matter_a end
 where (w.matter_a=new.matter_id or w.matter_b=new.matter_id) and w.lifted_at is null
 and x.user_id=new.user_id and x.revoked_at is null and x.expires_at>now()
 and (x.role<>'wall_keeper' or new.role<>'wall_keeper')) then
 raise exception 'Parede: a pessoa não pode acessar conteúdo nos dois mandatos.' using errcode='42501';end if;
 return new;end;$$;
create trigger dd_wall_member before insert or update on public.dd_matter_members for each row execute function dd_private.member_wall();
create function dd_private.link_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.dd_documents d join public.dd_requirement_state s on s.id=new.state_id
 where d.id=new.document_id and d.matter_id=new.matter_id and s.matter_id=new.matter_id) then raise exception 'Vínculo entre mandatos recusado.';end if;
 return new;end;$$;
create trigger dd_link_guard before insert or update on public.dd_document_links for each row execute function dd_private.link_guard();

create function dd_private.api(op text,m uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare v public.dd_matters;role_name text;f text;id uuid;u uuid;obj record;old public.dd_findings;
 result jsonb;other uuid;wall_a uuid;wall_b uuid;state public.dd_requirement_state;total int;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Entre e valide o segundo fator.' using errcode='42501';end if;
 if op='profile' then return jsonb_build_object('master',dd_private.master(),'user_id',auth.uid(),
 'institutions',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name)) from public.vertice_institutions i where dd_private.master()),'[]'));end if;
 if op='list' then return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.dd_matters a where dd_private.role_for(a.id) is not null),'[]');end if;
 if op='create' then
  if not dd_private.master() then raise exception 'Somente master abre mandato.' using errcode='42501';end if;
  if length(trim(coalesce(p->>'target','')))<3 or length(trim(coalesce(p->>'client','')))<3 or not coalesce((p->>'conflict_checked')::boolean,false) then raise exception 'Preencha alvo, cliente e confirme a checagem de conflitos.';end if;
  -- Serializa a abertura para o mesmo alvo, incluindo duas sessões concorrentes.
  perform pg_advisory_xact_lock(hashtext(coalesce(nullif(p->>'cnpj',''),lower(trim(p->>'target')))));
  select a.id into other from public.dd_matters a where a.status not in ('closed','cancelled')
   and ((nullif(p->>'cnpj','') is not null and a.target_cnpj_root=p->>'cnpj') or lower(trim(a.target_name))=lower(trim(p->>'target'))) limit 1;
  if other is not null and (coalesce(p->>'consent_ref','')='' or not coalesce((p->>'separate_team')::boolean,false)) then raise exception 'Alvo já atendido. Registre fundamento da atuação, referência documental e equipe separada.';end if;
  if nullif(p->>'cnpj','') is not null and p->>'cnpj'!~'^[0-9]{8}$' then raise exception 'Raiz do CNPJ deve ter oito dígitos.';end if;
  if not exists(select 1 from public.vertice_institutions i where i.id=(p->>'institution_id')::uuid) then raise exception 'Selecione a instituição contratante cadastrada no master.';end if;
  select i.id into id from public.dd_instruments i where i.superseded_at is null order by i.effective_from desc limit 1;
  insert into public.dd_matters(code,title,target_name,target_cnpj_root,side,client_name,institution_id,created_by,instrument_id,scope_note)
   values('DD-'||to_char(now(),'YYYY')||'-'||upper(left(gen_random_uuid()::text,8)),trim(p->>'target'),trim(p->>'target'),nullif(p->>'cnpj',''),(p->>'side')::public.dd_side,trim(p->>'client'),(p->>'institution_id')::uuid,auth.uid(),id,p->>'scope') returning * into v;
  insert into public.dd_requirement_state(matter_id,requirement_id) select v.id,r.id from public.dd_requirements r where r.instrument_id=id;
  insert into public.dd_conflicts(matter_id,kind,description,treatment,decided_by) values(v.id,'other',coalesce(nullif(p->>'consent_ref',''),'Checagem de conflito declarada pelo responsável.'),case when other is null then 'no_conflict' else 'accepted_with_wall' end,auth.uid());
  if other is null then
   insert into public.dd_matter_members(matter_id,user_id,role,expires_at) values(v.id,auth.uid(),'matter_lead',now()+interval '180 days');
  else
   u:=nullif(p->>'lead_user','')::uuid;
   if u is null or not exists(select 1 from auth.users where auth.users.id=u and email_confirmed_at is not null) then raise exception 'Informe o UUID do responsável da equipe separada, com conta confirmada.';end if;
   wall_a:=least(v.id,other);wall_b:=greatest(v.id,other);
   insert into public.dd_walls(matter_a,matter_b,reason,consented_by_both,consent_ref,created_by,institution_id,other_institution_id)
    values(wall_a,wall_b,case when exists(select 1 from public.dd_matters a where a.id=other and a.side=v.side) then 'same_target_competing' else 'same_target_opposing' end,true,p->>'consent_ref',auth.uid(),(select a.institution_id from public.dd_matters a where a.id=wall_a),(select b.institution_id from public.dd_matters b where b.id=wall_b));
   insert into public.dd_matter_members(matter_id,user_id,role,expires_at) values(v.id,u,'matter_lead',now()+interval '180 days');
  end if;
  insert into public.dd_audit(matter_id,actor_id,action) values(v.id,auth.uid(),'mandato_criado');
  return to_jsonb(v);
 end if;
 select * into v from public.dd_matters where dd_matters.id=m for update;
 role_name:=dd_private.role_for(m);
 if v.id is null or role_name is null then raise exception 'Mandato indisponível para esta conta.' using errcode='42501';end if;
 if op='load' then
  return jsonb_build_object('matter',to_jsonb(v),'role',role_name,
  'requirements',coalesce((select jsonb_agg(r order by r.code) from public.dd_requirements r where r.instrument_id=v.instrument_id and dd_private.role_for(m,r.front) is not null),'[]'),
  'states',coalesce((select jsonb_agg(s) from public.dd_requirement_state s join public.dd_requirements r on r.id=s.requirement_id where s.matter_id=m and dd_private.role_for(m,r.front) is not null),'[]'),
  'findings',coalesce((select jsonb_agg(a order by a.created_at desc) from public.dd_findings a where a.matter_id=m and dd_private.role_for(m,a.front) is not null),'[]'),
  'documents',coalesce((select jsonb_agg(d order by d.created_at desc) from public.dd_documents d where d.matter_id=m and d.purged_at is null and dd_private.role_for(m,d.front) is not null and (d.classification<>'privileged' or role_name='matter_lead')),'[]'),
  'links',coalesce((select jsonb_agg(l) from public.dd_document_links l join public.dd_documents d on d.id=l.document_id where l.matter_id=m and dd_private.role_for(m,d.front) is not null and (d.classification<>'privileged' or role_name='matter_lead')),'[]'),
  'members',case when role_name='matter_lead' then coalesce((select jsonb_agg(x) from public.dd_matter_members x where x.matter_id=m),'[]') else '[]'::jsonb end,
  'actions',coalesce((select jsonb_agg(a) from public.dd_actions a where a.matter_id=m and (a.finding_id is null or exists(select 1 from public.dd_findings f where f.id=a.finding_id and dd_private.role_for(m,f.front) is not null))),'[]'),
  'workspace',case when role_name in ('matter_lead','reviewer') then coalesce((select jsonb_agg(a) from public.dd_workspace a where a.matter_id=m),'[]') else '[]'::jsonb end,
  'audit',case when role_name='matter_lead' then coalesce((select jsonb_agg(a) from (select * from public.dd_audit a where a.matter_id=m order by a.created_at desc limit 200) a),'[]') else '[]'::jsonb end,
  'file_log',case when role_name='matter_lead' then coalesce((select jsonb_agg(a) from (select * from public.dd_document_access_log a where a.matter_id=m order by a.created_at desc limit 200) a),'[]') else '[]'::jsonb end,
  'walls',case when role_name='matter_lead' then coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'reason',w.reason,'created_at',w.created_at,'consent_ref',w.consent_ref)) from public.dd_walls w where (w.matter_a=m or w.matter_b=m) and w.lifted_at is null),'[]') else '[]'::jsonb end);
 end if;
 if op='download_authorize' then
  select * into obj from public.dd_documents where dd_documents.id=(p->>'id')::uuid and matter_id=m and purged_at is null;
  if obj.id is null or dd_private.role_for(m,obj.front) is null or (obj.classification='privileged' and role_name<>'matter_lead') then raise exception 'Arquivo indisponível.' using errcode='42501';end if;
  insert into public.dd_document_access_log(matter_id,document_id,actor_id,action,result) values(m,obj.id,auth.uid(),'download_url_issued','allowed');
  return jsonb_build_object('path',obj.storage_key,'name',obj.file_name);
 end if;
 if role_name not in ('matter_lead','analyst') then raise exception 'Seu perfil é de leitura.' using errcode='42501';end if;
 if v.status in ('closed','cancelled') and op<>'matter' then raise exception 'Mandato encerrado. Reabra antes de editar.';end if;
 if op='save_state' then
  select * into state from public.dd_requirement_state where dd_requirement_state.id=(p->>'id')::uuid and matter_id=m;
  select front into f from public.dd_requirements where dd_requirements.id=state.requirement_id;
  if state.id is null or coalesce(dd_private.role_for(m,f),'') not in ('matter_lead','analyst') then raise exception 'Requisito indisponível.' using errcode='42501';end if;
  if p->>'status'='not_applicable' and length(trim(coalesce(p->>'note','')))<10 then raise exception 'Justifique a não aplicabilidade.';end if;
  if p->>'status'='compliant' and not exists(select 1 from public.dd_document_links l where l.state_id=state.id) then raise exception 'Vincule uma evidência antes de declarar conforme.';end if;
  update public.dd_requirement_state set answer=left(coalesce(p->>'answer',''),20000),note=left(coalesce(p->>'note',''),10000),status=(p->>'status')::public.dd_requirement_status,
  not_applicable_reason=case when p->>'status'='not_applicable' then p->>'note' else null end,updated_at=now(),
  requested_at=case when p->>'status'='requested' then coalesce(requested_at,now()) else requested_at end,
  received_at=case when p->>'status'='received' then coalesce(received_at,now()) else received_at end where dd_requirement_state.id=state.id;
 elsif op='finding' then
  select r.front into f from public.dd_requirements r join public.dd_requirement_state s on s.requirement_id=r.id where s.matter_id=m and r.id=(p->>'requirement_id')::uuid;
  if f is null or coalesce(dd_private.role_for(m,f),'') not in ('matter_lead','analyst') then raise exception 'Requisito indisponível.';end if;
  if length(trim(coalesce(p->>'title','')))<3 or length(trim(coalesce(p->>'consequence','')))<20 then raise exception 'Informe título e consequência (20 caracteres).';end if;
  id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  select * into old from public.dd_findings where dd_findings.id=id and matter_id=m;
  if exists(select 1 from public.dd_findings where dd_findings.id=id and matter_id<>m) then raise exception 'Achado indisponível.';end if;
  insert into public.dd_findings(id,matter_id,code,requirement_id,front,title,description,consequence,severity,value_brl,value_unquantified,value_basis,mechanism,due_stage,owner_label,created_by)
   values(id,m,'AC-'||upper(left(id::text,8)),(p->>'requirement_id')::uuid,f,p->>'title',p->>'description',p->>'consequence',(p->>'severity')::public.dd_severity,nullif(p->>'value_brl','')::numeric,nullif(p->>'value_brl','') is null,p->>'value_basis',(p->>'mechanism')::public.dd_mechanism,p->>'due_stage',p->>'owner_label',auth.uid())
   on conflict on constraint dd_findings_pkey do update set title=excluded.title,description=excluded.description,consequence=excluded.consequence,severity=excluded.severity,value_brl=excluded.value_brl,value_unquantified=excluded.value_unquantified,value_basis=excluded.value_basis,mechanism=excluded.mechanism,due_stage=excluded.due_stage,owner_label=excluded.owner_label,updated_at=now(),resolved_at=case when coalesce((p->>'resolved')::boolean,false) then now() else null end;
  insert into public.dd_finding_history(matter_id,finding_id,from_severity,to_severity,from_mechanism,to_mechanism,from_value,to_value,actor_id,note) select m,id,old.severity,(p->>'severity')::public.dd_severity,old.mechanism,(p->>'mechanism')::public.dd_mechanism,old.value_brl,nullif(p->>'value_brl','')::numeric,auth.uid(),'Registro pelo portal';
 elsif op in ('member','revoke_member') then
  if role_name<>'matter_lead' then raise exception 'Somente o responsável altera a equipe.';end if;
  if op='member' then
   if p->>'role' not in ('matter_lead','analyst','reviewer','client_observer') then raise exception 'Papel inválido.';end if;
   select auth.users.id into u from auth.users where lower(email)=lower(trim(p->>'email')) and email_confirmed_at is not null;
   if u is null then raise exception 'A pessoa precisa ter conta confirmada no portal.';end if;
   if (p->>'expires_at')::timestamptz<=now() or (p->>'expires_at')::timestamptz>now()+interval '366 days' then raise exception 'Validade entre hoje e 366 dias.';end if;
   insert into public.dd_matter_members(matter_id,user_id,role,front_scope,expires_at) values(m,u,(p->>'role')::public.dd_member_role,array(select jsonb_array_elements_text(coalesce(p->'front_scope','[]'))),(p->>'expires_at')::timestamptz)
   on conflict(matter_id,user_id,role) do update set expires_at=excluded.expires_at,front_scope=excluded.front_scope,revoked_at=null;
  else
   if exists(select 1 from public.dd_matter_members where dd_matter_members.id=(p->>'id')::uuid and matter_id=m and user_id=auth.uid()) then raise exception 'Não revogue seu próprio acesso.';end if;
   update public.dd_matter_members set revoked_at=now() where dd_matter_members.id=(p->>'id')::uuid and matter_id=m;
  end if;
 elsif op='matter' then
  if role_name<>'matter_lead' then raise exception 'Somente o responsável altera o mandato.';end if;
  update public.dd_matters set status=(p->>'status')::public.dd_matter_status,scope_note=p->>'scope_note',contract_ref=p->>'contract_ref',closed_at=case when p->>'status'='closed' then now() else null end,purge_due_at=nullif(p->>'purge_due_at','')::timestamptz where dd_matters.id=m;
 elsif op='action' then
  if nullif(p->>'finding_id','') is not null and not exists(select 1 from public.dd_findings where dd_findings.id=(p->>'finding_id')::uuid and matter_id=m and dd_private.role_for(m,front) in ('matter_lead','analyst')) then raise exception 'Achado indisponível.';end if;
  id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  if exists(select 1 from public.dd_actions where dd_actions.id=id and matter_id<>m) then raise exception 'Ação indisponível.';end if;
  insert into public.dd_actions(id,matter_id,finding_id,title,owner_label,due_date,cost_brl,status,note) values(id,m,nullif(p->>'finding_id','')::uuid,p->>'title',p->>'owner_label',nullif(p->>'due_date','')::date,nullif(p->>'cost_brl','')::numeric,p->>'status',p->>'note') on conflict on constraint dd_actions_pkey do update set title=excluded.title,owner_label=excluded.owner_label,due_date=excluded.due_date,cost_brl=excluded.cost_brl,status=excluded.status,note=excluded.note,done_at=case when excluded.status='done' then now() else null end;
 elsif op='workspace' then
  if role_name<>'matter_lead' then raise exception 'Somente o responsável registra escopo, análise e parecer.';end if;
  if p->>'kind'='financial' then
   if not exists(select 1 from public.dd_documents d where d.id=(p->'body'->>'source_document')::uuid and d.matter_id=m and d.purged_at is null) then raise exception 'Vincule uma fonte existente no cofre.';end if;
   if exists(select 1 from unnest(array['net_income','income_tax','financial_expenses','financial_income','depreciation','adjustments','multiple','net_debt','asking_price']) k where nullif(p->'body'->>k,'') is null) then raise exception 'Complete todos os valores, inclusive zeros explícitos.';end if;
   if (p->'body'->>'multiple')::numeric<=0 then raise exception 'O múltiplo deve ser positivo.';end if;
   -- Recalcula no banco: não aceita resultados financeiros enviados pelo navegador.
   result:=jsonb_build_object('ebitda',(p->'body'->>'net_income')::numeric+(p->'body'->>'income_tax')::numeric+(p->'body'->>'financial_expenses')::numeric-(p->'body'->>'financial_income')::numeric+(p->'body'->>'depreciation')::numeric);
   result:=result||jsonb_build_object('adjusted',(result->>'ebitda')::numeric+(p->'body'->>'adjustments')::numeric);
   result:=result||jsonb_build_object('enterprise_value',(result->>'adjusted')::numeric*(p->'body'->>'multiple')::numeric);
   result:=result||jsonb_build_object('equity_value',(result->>'enterprise_value')::numeric-(p->'body'->>'net_debt')::numeric);
   p:=jsonb_set(p,'{body}',p->'body'||result);
  end if;
  if p->>'kind'='opinion' and p->'body'->>'status'='approved' then
   if (p->>'basis_revision')::bigint<>v.revision then raise exception 'A base mudou. Atualize e revise o parecer.';end if;
   if not exists(select 1 from public.dd_workspace where matter_id=m and kind='scope') then raise exception 'Defina o escopo antes de aprovar.';end if;
   select count(*) into total from public.dd_requirement_state where matter_id=m and status not in ('compliant','not_applicable','finding','not_provided');
   if total>0 then raise exception '% requisitos ainda aguardam conclusão explícita.',total;end if;
   if exists(select 1 from public.dd_findings a where a.matter_id=m and a.resolved_at is null and (coalesce(a.owner_label,'')='' or a.due_stage is null)) then raise exception 'Defina responsável e etapa para todos os achados abertos.';end if;
   if length(trim(coalesce(p->'body'->>'conclusion','')))<50 then raise exception 'Fundamente a conclusão do parecer.';end if;
  end if;
  insert into public.dd_workspace(matter_id,kind,key,body,basis_revision,created_by) values(m,p->>'kind',coalesce(p->>'key',''),p->'body',v.revision,auth.uid()) on conflict(matter_id,kind,key) do update set body=excluded.body,basis_revision=excluded.basis_revision,updated_at=now(),created_by=auth.uid();
 elsif op='upload_authorize' then
  if coalesce(dd_private.role_for(m,p->>'front'),'') not in ('matter_lead','analyst') then raise exception 'Frente indisponível.';end if;
  if p->>'classification'='privileged' and role_name<>'matter_lead' then raise exception 'Somente o responsável envia documento privilegiado.';end if;
  return jsonb_build_object('allowed',true);
 elsif op='register_document' then
  if coalesce(dd_private.role_for(m,p->>'front'),'') not in ('matter_lead','analyst') then raise exception 'Frente indisponível.';end if;
  if split_part(p->>'path','/',1)<>m::text or coalesce(p->>'sha256','')!~'^[a-f0-9]{64}$'
   or not exists(select 1 from storage.objects o where o.bucket_id='vertice-aquisicoes-cofre' and o.name=p->>'path') then raise exception 'Arquivo inválido ou ainda não recebido no cofre.';end if;
  if p->>'classification'='privileged' and role_name<>'matter_lead' then raise exception 'Acesso negado.';end if;
  insert into public.dd_documents(matter_id,storage_key,file_name,mime_type,size_bytes,sha256,classification,front,created_by,scan_status,received_at)
   values(m,p->>'path',p->>'name',p->>'mime',(p->>'size')::bigint,p->>'sha256',p->>'classification',p->>'front',auth.uid(),'pending_scan',now())
   on conflict(matter_id,sha256) do update set received_at=dd_documents.received_at returning dd_documents.id into id;
  insert into public.dd_document_access_log(matter_id,document_id,actor_id,action,result) values(m,id,auth.uid(),'upload_confirmed','allowed');
  result:=jsonb_build_object('id',id);
 elsif op='link' then
  select * into state from public.dd_requirement_state where dd_requirement_state.id=(p->>'state_id')::uuid and matter_id=m;
  select front into f from public.dd_requirements where dd_requirements.id=state.requirement_id;
  if state.id is null or coalesce(dd_private.role_for(m,f),'') not in ('matter_lead','analyst') or not exists(select 1 from public.dd_documents d where d.id=(p->>'document_id')::uuid and d.matter_id=m and dd_private.role_for(m,d.front) is not null and (d.classification<>'privileged' or role_name='matter_lead')) then raise exception 'Evidência ou requisito indisponível.';end if;
  insert into public.dd_document_links(matter_id,state_id,document_id,evidence_location) values(m,state.id,(p->>'document_id')::uuid,p->>'location') on conflict(state_id,document_id) do update set evidence_location=excluded.evidence_location;
 else raise exception 'Operação desconhecida.';
 end if;
 -- Toda mudança de base invalida a aprovação anterior sem apagar o histórico.
 if op<>'workspace' or p->>'kind'<>'opinion' then update public.dd_matters set revision=revision+1,updated_at=now() where dd_matters.id=m;end if;
 insert into public.dd_audit(matter_id,actor_id,action,detail) values(m,auth.uid(),op,jsonb_build_object('record_id',coalesce(p->>'id',p->>'state_id'),'kind',p->>'kind','payload',p));
 return coalesce(result,jsonb_build_object('ok',true));
end;$$;
create function public.dd_portal(op text,m uuid default null,p jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select dd_private.api(op,m,p);$$;
revoke all on all functions in schema dd_private from public,anon,authenticated;
grant execute on function dd_private.api(text,uuid,jsonb) to authenticated;
revoke all on function public.dd_portal(text,uuid,jsonb) from public,anon;
grant execute on function public.dd_portal(text,uuid,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vertice-aquisicoes-cofre','vertice-aquisicoes-cofre',false,15728640,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','image/jpeg','image/png','text/plain']) on conflict(id) do nothing;
-- Zero policies para anon/authenticated: a função autenticada emite URLs de 300 s.
notify pgrst,'reload schema';
