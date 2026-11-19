# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 008 — Portão de qualidade, execução de testes e priorização
**Data:** 2026-11-19 | **PR:** #207 (rascunho) | **Situação:** configuração de testes corrigida; homologação pendente.

### Preservação das decisões anteriores
Seguem válidos integralmente os adendos 001 a 007. O motor longitudinal e a construção curricular são a base; o formulário permite objetivas/discursivas e anexos de imagem; o catálogo deve ser validado; persistência somente após segurança e testes; autonomia docente permanece central. Nada foi publicado em produção nesta etapa.

### Descoberta comprovada nesta etapa
O arquivo `source-overrides/vitest.config.ts` selecionava exclusivamente testes `server/**/*.test.ts` e `client/src/components/area/InstitutionTabs.test.tsx`. As suítes `client/src/lib/avalia360/*.spec.ts` não eram incluídas em `npm test`.

### Correção realizada
Foi acrescentado `client/src/lib/avalia360/**/*.spec.ts` à propriedade `test.include` do Vitest, sem remover as suítes preexistentes.

### Como executar a suíte em ambiente isolado
A partir do diretório `source-overrides`, após instalar dependências respeitando o lockfile e o ambiente oficial:
```sh
pnpm exec vitest run client/src/lib/avalia360
pnpm exec tsc --noEmit
```
Registrar versões de Node/pnpm, data, SHA do commit, saída integral, contagem de testes e eventuais falhas. Se `tsconfig` não existir, localizar o TypeScript configurado no pipeline real, sem inventar um comando de build.

### Critérios mínimos antes da integração
1. Vitest: todos os testes existentes e novos aprovados.
2. TypeScript/TSX: compilação e revisão do código sem erros atribuíveis à PR.
3. Staging: catálogo SQL e controle de autorização testados isoladamente.
4. Segurança: separação multi-IES, MFA/RBAC, direitos de imagem, storage e emissão de links temporários.
5. Pedagogia: avaliação com questões de dois ou mais períodos e critérios curriculares de PPC real.
6. Confiabilidade: arquivo de imagem preservado até exportação de prova e aplicação digital.
7. Operação: somente publicar após aceite de coordenação e validação de volta (rollback).

### Riscos abertos
- Não há evidência de execução bem-sucedida da suíte nem dos serviços no ambiente real.
- O SQL permanece apenas documental e não deve ser tratado como migration aplicável.
- A PR contém motor, adaptadores, catálogo e formulários, mas ainda não há gateway de persistência.
- Leitura semântica dos enunciados e correção de discursivas continuam fora da primeira versão algorítmica.
- Testes GitHub Actions podem estar indisponíveis por cota; consultar status, não inferir aprovação.

### Próximos entregáveis técnicos
**A. Qualidade do núcleo** — executar suite, corrigir falhas, revisão de segurança e contrato de dados.
**B. Serviço institucional** — autenticação e autorização por instituição/curso, gravação de rascunhos e anexos privados.
**C. Avaliação operacional** — provas, versões, correção objetiva por QR/OMR, rubricas discursivas e testes de ponta a ponta.
**D. Inteligência longitudinal** — resultados por tema/competência, alertas, Sapiens 360°, Fato & Ordem, Planejamento Estratégico e validação psicométrica.

**Regra de fechamento:** 'implementado' não equivale a 'testado'; 'testado' não equivale a 'homologado'; 'homologado' não equivale a 'publicado'.