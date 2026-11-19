# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 005 — Pré-análise segura, rastreabilidade e impedimento de parecer indevido
**Data:** 2026-11-19 | **PR:** #207, rascunho | **Estado:** código registrado, não homologado nem publicado.

### O que permanece
Todos os requisitos dos adendos 001–004 permanecem vigentes: gestão curricular integrada, autonomia docente, longitudinalidade, exame externo, finalidade pedagógica, motor determinístico antes de interface, isolamento institucional e futura correção com QR Code e rubricas. A persistência SQL segue apenas como proposta em `docs/avalia360/sql/CATALOGO_PERSISTENCIA_V1_REVISAO.sql`; não foi executada.

### Nova entrega em código
- `source-overrides/client/src/lib/avalia360/assessment-preflight.ts`: validador puro que impede parecer favorável sem escopo coerente, matriz publicada, adaptador pronto e catálogo validado.
- `source-overrides/client/src/lib/avalia360/assessment-preflight.spec.ts`: casos de teste escritos para instituição divergente, competência inexistente, versão curricular incompatível, catálogo adulterado, duplicidade de itens e desacordo entre períodos.

### Portas de segurança do algoritmo
1. Escopo institucional e de curso derivado de um serviço confiável, nunca de afirmação feita pelo navegador. A constante `authorizedBy:'backend'` é só marca de contrato; **não autentica ninguém** e não substitui verificações reais de MFA e RBAC.
2. Matriz curricular publicada e coerente com a instituição, o curso e sua versão.
3. Catálogo com vínculos de competência e período validados; divergências entre adaptador e catálogo impedem parecer.
4. Temas/competências de questões referenciados exclusivamente por IDs do catálogo validado.
5. Questões inválidas (identificadores duplicados, pontos incorretos ou resultados impossíveis) impedem emissão de parecer válido.
6. Nenhum componente chama LLM, atribui nota, corrige discursiva ou grava dados.
7. Toda recomendação continua consultiva, explicável e submetida à avaliação humana.

### Evidência de integração existente
Consultas read-only ao projeto Supabase `vertice-educacao-superior` localizaram tabelas curriculares no schema `vertice_app`, com RLS ativo, e revelaram permissões de escrita potencialmente permissivas, a revisar. Nenhuma migração nem alteração de política foi realizada.

### Limites e pendências críticos
- O validador é uma função pura: sem gateway de autenticação e sem consulta aos registros reais, NÃO há segurança operacional completa.
- O contrato compara projeções; deve evoluir para análise com versão congelada e assinatura criptográfica da fonte autorizada.
- O catálogo e o adaptador deverão obter informações por gateway com seleção de instituição e curso validada no backend.
- Falta executar localmente ou via CI as suítes Vitest. Os arquivos de testes escritos não constituem evidência de aprovação.
- Persistência em esquema privado requer teste de RLS, grants, integridade, validação humana, imutabilidade de versão e rollback em ambiente isolado.
- Deverão ser acrescentadas regras de pesos, rubricas discursivas, metodologias de amostra e concordância pedagógica antes da homologação.

### Próximo portão de qualidade
**Executar testes automatizados e revisão de código**, corrigir falhas, testar SQL em instância isolada e só então conectar um gateway institucional e os formulários docentes. Não liberar merge, deploy nem alterar dados de produção na ausência dessas evidências.

### Critérios de aceite
- [x] Arquivo de pré-análise escrito e versionado.
- [x] Sete cenários de teste codificados para o preflight.
- [x] Verificação de divergência de períodos entre fonte curricular e catálogo.
- [ ] Compilação TypeScript/Vitest comprovada.
- [ ] Execução de testes e revisão de CI.
- [ ] Segurança de gateway e perfis testada com credenciais autorizadas.
- [ ] Migração de catálogo homologada em staging.
- [ ] Aprovação acadêmica e publicação.
