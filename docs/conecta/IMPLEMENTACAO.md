# Conecta 360° — implementação incremental
Data: 15/11/2026. Base: 905309f9004e8ee9e584da4c6707c221d69c07ac.

## Estado
Núcleo inicial publicado em 15/11/2026. O usuário aplicou a migração SQL, e a estrutura foi conferida no banco. A PR #154 foi integrada à main; a função vertice-student-portal foi atualizada para a versão 2; os dois serviços existentes do Render concluíram o deploy.
O escopo integral do Prompt Mestre ainda não está concluído ou homologado.

## Entregue no código
- Área Conecta na navegação institucional, preservando repositório, serviços, Supabase e autenticação existentes.
- Vínculos explícitos a matrículas e formações de Egressos 360°, sem nova tabela de pessoas.
- Perfil profissional, interesses, competências, SWOT pessoal, objetivo e prazo.
- Currículo/portfólio PDF da versão salva.
- Oportunidades, estados de divulgação e acompanhamento de candidaturas.
- Preferências separadas por canal e finalidade, com origem registrada e auditoria.
- Configuração de marcos de acompanhamento, sem ativar filas ou disparos.
- Indicadores com numeradores, denominadores, fonte, data, ausência de base e respostas antigas.
- Ligações às metas existentes e criação de ações no 5W2H nativo, sem aprovações automáticas.
- Referências a documentos da Mesa Digital e consulta de estágios e AC vinculados à matrícula.
- Próximos pareceres de planejamento do Sapiens recebem snapshot agregado do Conecta, sem nomes. Pareceres antigos são preservados.
- Reutilização do componente de leituras do Fato & Ordem e acesso ao módulo de aprendizagem existente, sem alterar seu repositório.
- Acesso próprio de estudantes/egressos via sessão expirada/revogável e link de uso único já existentes; não aceita IDs de estudante fornecidos pelo cliente.
- Campos com exemplos, explicações, obrigatoriedade, ajuda contextual e CSS responsivo.

## Segurança
Dados em schema dedicado dentro do projeto institucional existente; RLS habilitada e sem privilégios diretos de tabela para navegador.
RPC de gestão exige MFA e vínculo validado; coordenação/NDE restritos ao curso; CPA recebe apenas agregado.
RPC de autoatendimento exclusiva do service role, derivando identidade da sessão no banco.
Controle de versão para perfil, oportunidades e configuração; operações idempotentes e auditoria.
Nenhum dado sintético gravado em produção. Nenhuma mensagem enviada nesta implementação.

## Verificação executada
- 13 testes PostgreSQL/PGlite aprovados: permissões, MFA, isolamento, vínculos idempotentes, validação de perfil/URLs, versão, preferências, documentos, oportunidades/candidaturas, metas/5W2H, política, CPA, snapshot Sapiens e sessão pessoal.
- 16 testes de interface/navegação aprovados (6 novos e 10 de navegação existente).
- TypeScript sem diagnósticos na composição do pacote-base com os overrides atuais.
- build:static aprovado, incluindo prerender.
- Conferência publicada: formulário público da UNITOP e ajuda contextual verificados; painel Master autenticado abriu visão geral, trajetórias, oportunidades, metas e relacionamento sem alertas de erro. Layout Master observado em 1280 e 390 pixels; no recorte móvel, largura do documento 375 px para viewport de 390 px, sem overflow horizontal nessa conferência.
- Teste completo de aluno/egresso (e-mail recebido, resgate do link, edição e gravação), demais perfis e provedores externos: pendente.
Os testes locais usam fixtures de dependências acadêmicas; não substituem homologação no ambiente publicado.

## Sequência de implantação e homologação
1. Revisar a PR e a migração explícita supabase/migrations/20261115213753_conecta_360_native.sql. Não executar db push indiscriminado.
2. Aplicar a migração no Supabase institucional qvetbbmviatxxatzzuzc.
3. Publicar a alteração da função existente vertice-student-portal preservando verify_jwt=false e seus controles internos; nenhum novo serviço é necessário.
4. Integrar a branch no repositório canônico. Os serviços Render existentes têm deploy automático.
5. Gestão Master e acessos de consulta conferidos em produção. Completar homologação de coordenação, CPA e autoatendimento com usuários autorizados, revisão das demais telas em desktop/mobile e regressões funcionais completas de AC/Estágio.
6. Registrar evidências antes de marcar como comprovadamente funcional.

Gestão: Master → instituição → Módulos Acadêmicos → Conecta 360°.
Autoatendimento preparado: /acesso-estudante?ies=<institution_id>&mod=conecta.
Egressos sem registro nominal e contato verificável dependem de conciliação institucional; não são conciliados por nome/e-mail.

## Pendências do Prompt Mestre
- Conciliação assistida estudante–egresso quando as duas bases representam a mesma matrícula; o vínculo acadêmico é a unidade de contagem desta versão, não pessoas únicas.
- Questionários contextuais, respostas em rascunho, coortes e motor de pesquisas por marcos.
- Aplicação efetiva de limites/autorizações às filas existentes de WhatsApp e e-mail e seus recibos; nenhum parâmetro registrado é apresentado como fila ativa.
- Integração de indicações e conversões com GROWTH/CRM e intervenções com KEEP.
- Comunidade de mentoria, empresas/empregadores e seus perfis, convênios e avaliações.
- Portfólio automático completo de TCC, extensão e certificações: apenas evidências referenciadas e consultas de estágio/AC nesta etapa.
- Observatório de mercado regional, conectores autorizados e pesquisa externa com fontes.
- Mapeamento regulatório por versão/ato e indicador aplicável, sem declaração de conformidade.
- Entrevista de carreira pela IA, recomendações individuais e revisão por dois modelos, além do snapshot agregado e motor de planejamento reutilizado.
- Aprovação e gravação de medições oficiais nas metas, rastreabilidade dos resultados e evidências de eficácia; a versão atual não substitui medições aprovadas.
- Homologação ponta a ponta, acessibilidade completa e revisão visual do ambiente publicado.

Esta entrega é um núcleo incremental implementado e testado localmente, não a conclusão dos 21 blocos do Prompt Mestre.

## Evidências da publicação — 15/11/2026
- PR: https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/154 (integrada).
- Commit de aplicação publicado: d4ed7d911b410c4c0042f25a15a8de8d6126e68e.
- Edge Function existente: vertice-student-portal, versão 2, ACTIVE; código publicado comparado com a branch e correspondente. A configuração verify_jwt=false já existia; a autenticação permanece dentro da função e da sessão validada.
- Render vertice-portal: dep-dbt32hvf3r2c73f1fi60, live.
- Render vertice-educacao-superior: dep-dbt32hvf3r2c73f1fi20, live.
- version.json do domínio www.verticesuperior.com.br e do portal confirmou o commit publicado.
- Banco: oito tabelas com RLS; zero privilégios diretos de tabela para navegador; RPC pessoal restrita a service_role; gatilho Sapiens habilitado.
- Oito consultas do RPC de gestão verificadas no banco real em transação de leitura, com claims de teste de um Master existente. Esta verificação não substitui autenticação ponta a ponta dos demais perfis.
- Endpoint real recusou sessões inválidas com HTTP 401/session_invalid em Conecta, AC e Estágio.
- Nenhuma trajetória fictícia foi inserida e nenhum e-mail ou WhatsApp foi enviado para teste.
- Master UNITOP: https://www.verticesuperior.com.br/master#instituicao=1f5fd5b4-93c6-4626-834d-136884915587&aba=conecta
- Autoatendimento UNITOP: https://www.verticesuperior.com.br/acesso-estudante?ies=1f5fd5b4-93c6-4626-834d-136884915587&mod=conecta

O núcleo está publicado e parcialmente verificado em produção. As pendências funcionais e de homologação listadas acima permanecem abertas; o Prompt Mestre integral não está concluído.


## Atualização — acesso de 72 horas e parceiros

Esta atualização substitui o fluxo anterior de acesso do Conecta que exigia e-mail e usava link único de 30 minutos. Os fluxos acadêmicos de AC e Estágio conservam seu mecanismo próprio.

- Conecta: matrícula e CPF conferidos na base da IES; não exige e-mail. Links aleatórios de 256 bits, armazenados no banco somente como hash, reutilizáveis por 72 horas. Cada sessão derivada expira junto com o link, sem prorrogação no resgate. Sair revoga o link e todas as sessões derivadas.
- Escopo de sessão separa Conecta de AC/Estágio. Contratos de gestão mantêm Supabase Auth, segundo fator e curso autorizado.
- E-mail e telefone autodeclarados são opcionais e atualizáveis no perfil profissional, sem sobrescrever o cadastro acadêmico.
- Relacionamento → Links de acesso e parceiros apresenta URLs públicas da IES, sem tokens pessoais. Estudantes e parceiros recebem seu link privado depois da validação/cadastro.
- Portal público: /conecta-parceiros?ies=UUID. Organização, responsável e ao menos um contato; propostas de emprego, estágio, campo, evento, extensão, formação, mentoria e ação institucional. O link pessoal de acompanhamento dura 72 horas. Não existem busca pública de contatos ou leitura de estudantes.
- Empresas e parceiros: revisão do cadastro pela gestão institucional; propostas revisadas no recorte autorizado. Justificativa obrigatória e trilha de auditoria. Aprovação de cadastro concilia por CPF/CNPJ na mesma IES, sem reativar organizações bloqueadas ou mesclar por nome.
- Aprovação de proposta cria oportunidade publicada; campo de estágio fica under_review; projeto de extensão fica em planejamento, revisão pendente, com parceiro vinculado. Isso não aprova convênio, horas, execução ou contratação.
- Meta opcional na revisão cria acompanhamento no 5W2H nativo, com responsável e prazo. Sapiens recebe somente contagens agregadas das propostas, além dos indicadores do Conecta.
- Limites de tentativa são atômicos no banco e contabilizam falhas antes de validar credenciais ou propostas. Nenhum envio de e-mail ou WhatsApp é acionado por esta atualização.

### Verificação técnica desta atualização

Dados sintéticos apenas em banco PostgreSQL local via PGlite, sem inserir testes em produção. Suíte original e nova suíte: acesso sem e-mail, CPF incorreto, link reutilizável, limite fixo de 72h, expiração, revogação de todas as sessões, isolamento de IES, bloqueio de sessão acadêmica, MFA, CPA sem contatos, autorização por curso, cadastro sem e-mail, não publicação pelo portal, aprovação com 5W2H, campos/projetos pendentes de análise acadêmica, conciliação de parceiro e bloqueio de reativação. O teste HTTP usa a função Edge real transpilada com cliente de banco local e proíbe envios externos. Testes de interface cobrem campos de acesso e contatos opcionais e links públicos sem segredos. TypeScript e build de produção devem passar antes do merge.

### Limites e próximas frentes

Esta entrega não constitui homologação integral de todos os oito eixos. Continuam pendentes: conciliação longitudinal estudante/egresso com histórico; questionários, rascunhos e pesquisas por coorte; filas reais de WhatsApp/e-mail com entrega/resposta/cancelamento; indicações e conversões CRM/GROWTH; intervenções KEEP; comunidade/avaliação de mentorias e portfólio automático completo de TCC/extensão/certificações; observatório regional; orientação individual por IA com revisão; mapeamento regulatório aplicável e avaliação longitudinal dos resultados. A ponte de aprendizagem/leitura e o Sapiens existentes não comprovam esses fluxos. São necessários testes de ponta a ponta com identidades reais autorizadas de aluno, egresso, coordenação, CPA e gestão, além de validação humana institucional.
