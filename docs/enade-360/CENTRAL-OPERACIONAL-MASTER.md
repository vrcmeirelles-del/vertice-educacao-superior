# ENADE 360° — acompanhamento operacional no Master

Implementação na fonte única `vrcmeirelles-del/vertice-educacao-superior`.
Workspace Render conferido: **Virgílio Meirelles | Projetos**, ID `tea-d925voi8qa3s73csvir0`.

## Resultado preparado

Entrada no menu Master, cartão na visão inicial e atalho na Central de Homologação.
Rota planejada: `/master#enade-operacao=1`.
Mesmo portal, Supabase Auth, MFA/AAL2, instituições e cursos existentes. Não há novo
Site hospedado, serviço, repositório, login ou banco paralelo.

Dezessete frentes: núcleo genérico de bacharelados, GitHub, Supabase/migrações,
Render, PDF/DOCX, OCR/CPU, classificação/IA, indexação, Sapiens, Planejamento,
R2, R3, R4, R5, R6, validação científica e autenticação/MFA.

Cada revisão identifica ambiente, escopo institucional/curso, status, versão,
branch, URL, migração, proveniência, falha, causa provável (hipótese), correção,
dependências, riscos, decisões e próximos passos. Os quatro níveis de teste
registram execução, validação, resultado e evidência separadamente.

Checklists de desenvolvimento, homologação e produção com justificativas e URLs;
histórico cumulativo paginado; comparação das revisões carregadas; exportação
JSON do recorte com aviso de histórico incompleto. As referências anteriores e
posteriores são documentais, congeladas no commit inspecionado, não consultam nem
homologam o banco atual.

## Controles

- A RPC verifica Master e JWT AAL2 em toda leitura/escrita. A tabela privada tem
  RLS, sem grants diretos para `anon` ou `authenticated`.
- Curso deve pertencer à IES. Núcleo genérico não herda aceite institucional e
  escopos de curso não se propagam ao núcleo ou a outros cursos/ambientes.
- Identidade e timestamp são obtidos no servidor. Identidade interna não é
  exposta na projeção do cliente/exportação.
- Revisões são eventos novos, sem update/delete disponível. Revisão esperada e
  lock por escopo recusam escrita concorrente desatualizada. Repetir o mesmo ID
  com o mesmo conteúdo é idempotente; conteúdo diferente é recusado.
- Status fortes exigem versão e URL. Funcionamento comprovado exige testes
  autenticados e reais validados com resultado **passou**, em homologação ou
  produção, sem falha/dependência pendente ou teste parcial/falho.
- “Pronto para homologação” não presume aceite científico. “Homologado” exige
  aceite humano e os checklists correspondentes. Nova versão reinicia os testes
  e checklists na interface.
- Registro de autorização exige ação, alvo exato, versão, ambiente, URL de aceite
  e confirmação explícita. Não executa merge, banco, migração, deploy ou mudança
  de produção. Também não altera documentos, indicadores ou o gate científico.
- Não há sincronização automática com GitHub/Render: são registros com links e
  evidências. Nenhum segredo de provedor foi incorporado.
- Campos são metadados; a interface orienta a não inserir dados pessoais, tokens
  ou conteúdo restrito. Não há importação automática de documentos privados.

## Migração preparada, não aplicada

`20261118013000_enade360_master_operations.sql` adiciona apenas o diário privado e
a RPC `vertice_enade360_operations`; não reescreve registros acadêmicos existentes.
Sem a migração, a interface apresenta indisponibilidade e bloqueia gravações.
Aplicação somente no projeto/ambiente explicitamente autorizado. Projeto de produção
identificado pelo conector: `qvetbbmviatxxatzzuzc` (`vertice-educacao-superior`).
Nenhuma migração foi aplicada nesse projeto por esta tarefa.

## Validação local

- 27 testes: 11 regras/estado, seis interface e dez banco PostgreSQL embarcado
  PGlite 0.5.16. Identidades e dados são **sintéticos**; não é sessão Supabase real.
- TypeScript e compilação estática do portal, com fonte-base + source-overrides.
- Verificador de fonte canônica aprovado.
- Conferência visual em navegador local: overview, documentos, detalhes e formulário.
  A prévia usa mock de API identificado como sintético e não é rota de produção.
- Imagem: `evidencias/20261117-operations-master/preview-local-sintetica.jpg`.

A suíte está em `.github/workflows/enade360-operations.yml`. Os runtimes de teste
usam os lockfiles já existentes de `types-runtime` (jsdom 27.2.0) e
`evidence-runtime` (PGlite 0.5.16). Nenhuma dependência de produção foi adicionada.

## Aprovação final e sequência controlada

Esta implementação é uma proposta revisável. Não foi feito merge, aplicada
migração ou iniciada publicação por esta tarefa.

O serviço `vertice-educacao-superior` (`srv-dbbm6q3ncjis7396t7fg`), vinculado ao
mesmo repositório, e `vertice-portal` (`srv-dbm52uhsrm7s73f3ojkg`) têm deploy
**automático por commit em main**. Portanto, aprovar o merge implica autorizar o
início dessas publicações existentes. Não criar outro serviço para testar.

Após aprovação específica: verificar projeto Supabase/ambiente, aplicar a
migração autorizada, integrar a PR, acompanhar os deploys existentes, conferir
commit servido e executar a jornada real com Master/AAL2. Não declarar essa
jornada executada com base nos testes locais. Reitoria, Coordenação, NDE, CPA e
reprodução/aceite científico do ENADE continuam dependentes de evidência própria.
