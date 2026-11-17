# E1 — TLS OFICIAL E HOMOLOGAÇÃO DE PERFIS: EXECUÇÃO DE 17/11/2026
**Classificação:** evidência operacional; não equivale a parecer jurídico/clínico ou autenticação de PDF. **E1 ABERTA**.

## Escopo e herança
Lidos Bíblia-Mestra v2.1, Plano, Diário, registro de 11 URLs oficiais obtidas do DOM do Inep e contratos da PR #168. Preservadas as decisões de não tratar a URL como hash, não atualizar gabaritos definitivos, não eliminar duplicatas e não importar dados reais de IES antes da fase autorizada.

## 1. Cadeia de recuperação e autenticação
- Catálogo oficial de provas/gabaritos ENAMED: `https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos`; DOM renderizado com browser em GitHub Actions run `43999991024`, 11 links identificados e vinculados ao órgão.
- Relatório de verificação `curl` sob TLS padrão no run `44016278762`: **8 URLs prioritárias testadas, 0 arquivos recuperados**. Uma conexão retornou `curl 35` (reset), as demais `curl 60` (cadeia de certificação não verificável pelo cliente). Artefato `enamed-e1-curl-tls-evidence`; nenhum PDF no ZIP e nenhum hash de prova.
- Container local: DNS indisponível para `www.gov.br` e `download.inep.gov.br`, por isso não é possível usar seu resultado para atestar indisponibilidade pública geral.
- **Nova rota implementada** em `scripts/enamed/render_inep_public_catalog.py`: após a tentativa Python HTTPS, testar `Playwright APIRequestContext` com `ignore_https_errors=False`, hostname oficial preservado, limite de 30 MiB, assinatura inicial `%PDF-`, marcador `%%EOF`, SHA-256 e cópia de evidência. **Não permite** desativar a verificação TLS nem converter hash local em autenticidade/versão definitiva. Commit `a6f63ba1801fbf299fcd8a2085f9f45884e62f24`.
- A execução dessa rota no Actions `44016278762` estava **em andamento** na verificação documental desta entrada. Um sucesso futuro deve ser atestado pelo ZIP do artefato, pelos hashes e pela identidade no catálogo; uma falha não autoriza baixar com `curl -k`.

## 2. Versões e cobertura pendentes
- Tabela F&O `fo_enamed_items`: 483 registros (dois cadernos regulares com 200 linhas cada, 83 linhas reaplicação C1); reaplicação C2 ainda **sem registro nessa tabela**, embora a publicação Inep liste C2.
- Cópias por posição: 200 duplicações; 57 enunciados, 2 conjuntos de alternativas, 6 temas, 191 subtemas e 192 listas de palavras-chave divergentes. Inexistência de divergência entre duas cópias de gabarito não valida a resposta contra o Inep.
- **Passagem à curadoria**: issue #170 aberta como fila, **não** como parecer de duas IAs/médico já executado. Só liberar comparações e revisão clínica individual após obtenção de documentos integrais autenticados; preservar IDs/attempts.

## 3. Homologação por perfil — controle de evidências
| Perfil | Rota/visibilidade conhecida pelo código | Prova necessária | Estado |
|---|---|---|---|
| Master | ENADE 360°, abrangência multi-IES | sessão Master autorizada com MFA AAL2, leitura isolada por instituição selecionada | **não executado** |
| Reitoria/Direção | ENADE 360° na IES | autenticação real, acesso permitido somente à própria IES | **não executado** |
| CPA | ENADE 360° no menu | escopo institucional e bloqueio das ações não permitidas | **não executado** |
| Coordenação | Trilhas ENADE, mas não aba institucional ENADE | decisão sobre visão por curso, sessão vinculada, bloqueio entre cursos | **não executado** |
| NDE | Trilhas ENADE, não aba institucional ENADE | vínculo legítimo, MFA e bloqueio entre cursos | **não executado** |
| Docente com escopo | política RLS pode permitir agregados por curso/discipina com AAL2 | sessão com escopo ativo, teste negativo sem escopo | **não executado** |
| Outra IES / leitor | acesso não autorizado à outra IES deve retornar nenhum registro | duas IES sintéticas isoladas; sem dados reais | **não executado** |

**Evidência estrutural da política real:** `vertice_learning_course_metrics` tem RLS ativa `learning_metrics_read`, autorizando instituição/papel ou MFA `aal2` mais escopo acadêmico ativo. `member_role` exige AAL2 até para Master. Isso verifica a definição, não o comportamento com JWT real. Última consulta somou **0 métricas**, portanto nem mesmo um login autorizado comprovaria sincronização F&O→Vértice hoje.

**Browser conectado:** tool de leitura de abas recusou acesso porque a conversa não tinha contexto de extensão/navegador originário. Sem sessões legítimas disponíveis, nenhuma homologação interativa foi declarada.

## 4. CI distinto de autenticação
- GitHub Actions run `43998145208` passou TypeScript em Node 22 e 24; execução anterior do portal registrou **415** testes principais e outras suítes aprovadas.
- Após inclusão de quatro testes SSR de ENAMED em `source-overrides/vitest.config.ts`, houve execução posterior documentada na Bíblia v2.1 como **419 testes principais**, além de TypeScript aprovado. Testes SSR não exercitam sessão autenticada nem as políticas de RLS em produção.
- O novo commit da rota de download em `a6f63ba...` tem testes/CI próprios; registrar resultados separadamente quando finalizados, sem inferir aprovação da versão atual a partir de commits antigos.

## Portas de aceite
- [ ] Ter prova/gabarito integral cuja origem, data, caderno e status oficial estejam verificados, com SHA-256 de cada binário.
- [ ] Resolver diferenças de caderno regular e reaplicação e validar 483/483 itens.
- [ ] Ler/validar as notas metodológicas completas por edição.
- [ ] Executar roteiro de autenticação real por perfil, teste negativo de acesso cruzado, MFA, course scope e mobile.
- [ ] Validar vínculo e sincronização com dados sintéticos ponta a ponta.
- [ ] Aceite documental, médico e regulatório antes de qualquer reindexação/apuração oficial.

**Decisão:** manter E1 sem aceite, PR #168 draft, produção Vértice e F&O intacta, sem falsa homologação de documentos ou permissões.
