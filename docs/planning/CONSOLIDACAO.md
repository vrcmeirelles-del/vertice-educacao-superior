# Consolidação estratégica institucional

A mesma visão é acessível no planejamento do curso (botão Consolidação da alta gestão), no BI do Reitor (Estratégia e execução) e no BI executivo da Direção.

A RPC `vertice_planning_management` consulta os registros existentes, sem duplicar planos ou criar serviços. Reutiliza a verificação institucional e MFA do portal e restringe a consolidação aos perfis de alta gestão. A função privilegiada fica no schema privado com search_path vazio; o wrapper público é SECURITY INVOKER. Nenhum acesso anônimo é concedido.

## Regras

- Uma versão estratégica não arquivada, a mais recente, por curso; rascunho explicitamente identificado.
- Uma versão semestral por curso e período selecionado. Ausência de plano aparece como pendência.
- Normalização de AAAA/01 e AAAA/1 apenas na consulta.
- Estatísticas só são vinculadas quando o código do curso e o registro do período são únicos na instituição. Não há associação por nome aproximado.
- Variação de estoques de matrículas comparada com o semestre imediatamente anterior. Não equivale a retenção ou evasão de coorte.
- TCC/AC/estágio, metas e 5W2H são registros atuais por course_id; não são apresentados como dados exclusivos do semestre.
- Ausência não vira zero. Metas textuais e recursos declarados não são convertidos em resultados ou somados como orçamento aprovado.
- Metas e ações sem curso não são distribuídas entre cursos.
- Vínculo explícito entre objetivo estratégico e indicador, integração PDI e workflow de deliberação permanecem fora desta entrega e aparecem como necessidade de revisão.

## Validação

Build estático aprovado. Testes de resumo, ausência vs zero, variação, ações canceladas, código ambíguo e troca de instituição/erro. Regressões de CoursePlanning e ReitorBI aprovadas (mock legado do ReitorBI emite diagnóstico de maybeSingle ausente). Consultas reais de consolidação e recorte semestral, além de bloqueio sem autenticação, sem vínculo e sem AAL2, realizadas em transações com rollback. Nenhum planejamento foi publicado pelo processo de consolidação.
