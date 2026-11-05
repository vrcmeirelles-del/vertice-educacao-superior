-- Captação BI: tabelas de controle de leads, funil, custos e matrículas captadas
begin;

-- Leads individuais (sem dados pessoais — LGPD: apenas contadores institucionais)
create table if not exists public.vertice_captacao_leads (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
  origem text not null check (length(origem) between 1 and 120),
  curso text check (curso is null or length(curso) between 1 and 250),
  etapa_funil text not null default 'lead' check (etapa_funil in ('lead','contato','visita','inscricao','matricula')),
  periodo text check (periodo is null or length(periodo) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists captacao_leads_inst_idx on public.vertice_captacao_leads(institution_id);
create index if not exists captacao_leads_created_idx on public.vertice_captacao_leads(created_at);

-- Custos de captação por canal/período
create table if not exists public.vertice_captacao_custos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
  canal text not null check (length(canal) between 1 and 120),
  periodo text not null check (length(periodo) between 1 and 20),
  investimento numeric(14,2) not null default 0 check (investimento >= 0),
  matriculas_atribuidas integer not null default 0 check (matriculas_atribuidas >= 0),
  created_at timestamptz not null default now()
);
create index if not exists captacao_custos_inst_idx on public.vertice_captacao_custos(institution_id);

-- Snapshots mensais de captação (agregados para o BI)
create table if not exists public.vertice_captacao_snapshots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.vertice_institutions(id) on delete cascade,
  mes text not null check (length(mes) between 1 and 10),
  total_leads integer not null default 0,
  total_matriculas integer not null default 0,
  investimento_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(institution_id, mes)
);
create index if not exists captacao_snap_inst_idx on public.vertice_captacao_snapshots(institution_id);

-- RLS
alter table public.vertice_captacao_leads enable row level security;
alter table public.vertice_captacao_custos enable row level security;
alter table public.vertice_captacao_snapshots enable row level security;

revoke all on public.vertice_captacao_leads, public.vertice_captacao_custos, public.vertice_captacao_snapshots from anon, authenticated;
grant select, insert, update on public.vertice_captacao_leads to authenticated;
grant select, insert, update on public.vertice_captacao_custos to authenticated;
grant select, insert, update on public.vertice_captacao_snapshots to authenticated;

-- Policies: master pode tudo; gestor pode na sua instituição
create policy captacao_leads_read on public.vertice_captacao_leads for select to authenticated
  using (vertice_private.can_read_institution(institution_id));
create policy captacao_leads_insert on public.vertice_captacao_leads for insert to authenticated
  with check (vertice_private.can_read_institution(institution_id));
create policy captacao_leads_update on public.vertice_captacao_leads for update to authenticated
  using (vertice_private.can_read_institution(institution_id));

create policy captacao_custos_read on public.vertice_captacao_custos for select to authenticated
  using (vertice_private.can_read_institution(institution_id));
create policy captacao_custos_insert on public.vertice_captacao_custos for insert to authenticated
  with check (vertice_private.can_read_institution(institution_id));
create policy captacao_custos_update on public.vertice_captacao_custos for update to authenticated
  with check (vertice_private.can_read_institution(institution_id));

create policy captacao_snap_read on public.vertice_captacao_snapshots for select to authenticated
  using (vertice_private.can_read_institution(institution_id));
create policy captacao_snap_insert on public.vertice_captacao_snapshots for insert to authenticated
  with check (vertice_private.can_read_institution(institution_id));
create policy captacao_snap_update on public.vertice_captacao_snapshots for update to authenticated
  using (vertice_private.can_read_institution(institution_id));

commit;
