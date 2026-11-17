# E1 — RECUPERAÇÃO DOS BINÁRIOS E VERIFICAÇÃO DE PERFIS
**Consulta:** 16/11/2026 (logs do GitHub em UTC já podem estar em 17/11). **Estado:** PARCIAL, sem aceite E1 e sem homologação de sessão autenticada.

## Fontes primárias consultadas
- Portal: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos (lista dois cadernos regulares e dois de reaplicação em 2026, com gabaritos preliminares).
- Notícia Inep publicada 20/10/2026 confirma gabarito **preliminar** da reaplicação e data prevista 04/12/2026 para o definitivo: https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/enamed-2026-inep-divulga-gabarito-preliminar-da-reaplicacao-da-prova
- Edital 71/2026 republicado: https://download.inep.gov.br/enamed/edital_71_de_28_de_maio_de_2026.pdf?term=dpoc

## Tentativas efetivamente executadas de obtenção binária
1. `requests` no ambiente local: `www.gov.br` e `download.inep.gov.br` não resolveram DNS.
2. Ferramenta pública de consulta aos URLs `https://download.inep.gov.br/enamed/provas_e_gabaritos/2026_caderno_1.pdf` e `.../2026_caderno_1_reaplicacao.pdf` retornou 502 ou timeout. **URLs originadas do cadastro F&O — não homologadas.**
3. GitHub Actions `ENAMED E1 - recuperar documentos públicos do INEP`, run **43999397676**, consultou com sucesso o HTML oficial do catálogo, mas encontrou **0 URLs PDF diretamente expostas**, 0 PDFs baixados. Evidência: artefato `enamed-e1-oficial-pdfs-unverified`; a coleção não demonstra fonte inexistente, mas HTML que não expõe links estáticos.
4. Segunda execução com diagnóstico HTML, run **43999518665**, confirmou `catalog_excerpt` vazio para `Prova Objetiva`, também 0 candidatos e 0 PDFs. Possível necessidade de conteúdo carregado por JavaScript, sem confirmação de tecnologia específica.
5. Tentativa com navegador automatizado, run **43999660361**, falhou no preparo do Chromium porque Playwright 1.56 não suporta Ubuntu 26.04 do runner padrão. Workflow corrigido para Ubuntu 24.04 (commit `4feb641631a0e0ea27042c66b4e1ee465180519f`); sua nova execução **ainda não estava concluída no momento deste relatório**. Resultado posterior deve ser checado, não presumido.
6. Ferramentas versionadas: `scripts/enamed/verify_inep_artifacts.py` (hash PDF/ZIP offline), `scripts/enamed/discover_public_inep_pdfs.py` (links estáticos e downloads vinculados ao domínio oficial) e `scripts/enamed/render_inep_public_catalog.py` (renderização dinâmica), com relatórios de evidências em artefatos de Actions.

**Estado dos documentos:** nenhum PDF oficial integral recuperado/comprovado nesta rodada até o ponto documentado; SHA-256 **não aferido**; status de gabaritos F&O como `definitivo` segue em revisão **sem alteração**. A autenticação de um arquivo exige confirmar que o link foi realmente publicado pelo órgão, que o caderno e a edição coincidem, que o PDF está íntegro, e registrar hash e data. Um hostname permitido, isoladamente, não comprova a proveniência.

## Cobertura F&O (SQL leitura)
Tabela pública `fo_enamed_items`: 483 registros; regular C1 200/100 posições, regular C2 200/100, reaplicação C1 83/83; reaplicação C2 **0** nessa tabela. Em `information_schema.tables` existem `fo_enamed_items` e `fo_enamed_attempts`; não foi inspecionado todo o armazenamento/arquivos. A lacuna C2 permanece **candidata**, não ausência definitiva de todo o ecossistema.

## QA/TypeScript e matriz de perfis
- Commit `ae19a8847c9ea4b0fe2935634be24ac7d34523e9`: **oito workflows concluíram success**, incluindo TypeScript completo em Node 22/24, build estático e os testes dos contratos.
- Log do job `133755296117` do run `43998145208`: TypeScript `tsc --noEmit` passou; 415 testes da suíte principal passaram, além de outras 214, 19 e 30 aprovações de suites específicas, e build Vite concluído.
- **Lacuna descoberta:** `EnamedEnvironment.test.tsx` não aparecia na execução principal (a configuração Vitest limitava a lista de arquivos). Alterado `source-overrides/vitest.config.ts` no commit `ce99687268ebb4440e7e5c3393306c8c1e5438c7` para incluir explicitamente os quatro testes SSR de navegação e visibilidade ENAMED. O resultado do HEAD posterior não deve ser inferido da aprovação anterior.
- Em SQL read-only da Vértice, tabela `vertice_learning_course_metrics` mantém RLS `learning_metrics_read` para authenticated, com `can_read_institution`+ `has_role` para papéis institucionais ou MFA `aal2` e `vertice_learning_staff_scope` ativo para curso e disciplina. `vertice_private.member_role` exige `aal2`, inclusive para Master. Condição estrutural de permissão **não equivale** a teste com sessões de usuários reais.
- Navegação: Master, Reitoria, Direção, Gestor e CPA têm `enade` institucional; coordenador/NDE têm apenas `trilhas-enade`; sem alargamento automático de acesso.
- A ferramenta de leitura de abas do navegador conectado falhou por ausência de contexto de navegador; não foi possível abrir sessões reais de Master/CPA/Coordenação/NDE ou validar mobile com credenciais.

## Matriz de aceite real (não presumido)
| Perfil | Regra visível | Consulta autenticada comprovada? |
|---|---|---|
| Master | ENADE 360; banco exige MFA e papel | NÃO |
| Reitoria/Direção | ENADE 360; escopo IES | NÃO |
| CPA | ENADE 360; escopo IES | NÃO |
| Coordenação/NDE | Trilhas ENADE; não ENADE 360 no menu | NÃO |
| Docente vinculado | Escopo ativo + MFA (política de métricas) | NÃO |
| Outro tenant | Deve ser negado fora da IES | NÃO |

**Critérios que bloqueiam homologação:** logins reais autorizados em ambiente de homologação, testes de outra instituição/cursos/disciplinas, inspeção de DOM e mobile, fluxo vazio/erro, efeito de MFA/escopo; corpus e gabaritos autênticos antes de diagnósticos oficiais.

## Decisão
Manter PR #168 draft; não integrar à main nem ativar índices oficiais no Sapiens. Instrumental de coleta e testes em desenvolvimento é independente do aceite da E1; nenhuma escrita F&O/Vértice nesta passagem.
