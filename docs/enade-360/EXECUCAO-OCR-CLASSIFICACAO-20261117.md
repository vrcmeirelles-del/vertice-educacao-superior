# Execução real — extração e classificação documental — 17/11/2026

**Resultado: avanço operacional publicado; homologação científica ainda bloqueada.**

- Os 68 originais restantes foram recebidos pelo acervo autenticado; os 68 SHA-256 conferiram. OCR local reconheceu 509.340 caracteres em 264 páginas de 65 documentos, importados como parciais/revisão obrigatória. Três tentativas com texto insuficiente também receberam versões e auditoria, sem texto inventado. Total UNITOP: **670 completos, 98 parciais e três falhas**, entre 771 arquivos. Os 776 arquivos de todas as instituições e as classificações originais foram preservados.
- Corrigidos o modelo Anthropic retirado, a alternativa efetiva para OpenAI, o registro de hash antes do parser e a validação de citações no prefixo efetivamente transmitido. A Anthropic ainda atingiu timeout nas chamadas reais observadas; o OpenAI respondeu HTTP 200. Isso não representa dupla checagem por duas IAs.
- A sessão Master recuperou o mesmo texto OCR no ENADE 360°, Planejamento Estratégico/Direito e Sapiens/UNITOP. Não foi testada sessão real de Reitoria, Coordenação, NDE ou CPA.
- O PDF do regulamento NPJ gerou um vínculo **sugerido** ao indicador IACG 2017 3.15, com citação da página 3 confirmada no texto da fonte. Zero vínculos foram aprovados. O DOCX teve resumo, mas nenhum vínculo aproveitável; não foi declarado classificado integralmente. A classificação IA de todo o acervo não foi executada.
- PRs [#184](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/184) e [#186](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/186) integradas; quatro e cinco workflows aprovados, respectivamente. Última correção: 16 testes locais, checagem Deno e parser real em CI aprovados. Os testes de banco isolado/provedores simulados não são sessões reais nem homologação científica. Função v7 com JWT obrigatório e cinco arquivos remotos conferidos. Migração `20261117185832_enade360_ocr_provenance_notice` aplicada, mantendo assinatura, grants, RLS e MFA.
- Render: [portal](https://dashboard.render.com/static/srv-dbm52uhsrm7s73f3ojkg/deploys/dep-dbuaavvb9u1s73aaajg0) e [site institucional](https://dashboard.render.com/static/srv-dbbm6q3ncjis7396t7fg/deploys/dep-dbuaavvb9u1s73aaajig) live no commit `1853151e467a558a31ed995ba60f2b8b4859f068`.
- Reconciliação reconfirmada: 289 linhas e-ORBIT, 241 com curso, 48 sem curso, 62 pares instituição/curso, 196 cursos Vértice, **zero equivalências ENADE configuradas**. Há 901 solicitações UNITOP ligadas a metas, mas nenhum dos 771 arquivos está associado a uma dessas solicitações com meta; não declarar integração documental com 5W2H concluída.
- Conceito Enade, IDD, CPC e IGC: **zero indicadores reproduzidos e conciliados nesta execução**. Nova tentativa do microdado 2023 pelo link oficial não entregou arquivo; a inspeção do destino foi bloqueada pela política de URL do navegador. Não há SHA de arquivo não recebido. Não afirmar indisponibilidade geral do INEP. Há zero registros `resultado_oficial` e o trigger de bloqueio científico permanece ativo.

| Situação exigida | Evidência atual |
|---|---|
| A. Código | Correções integradas |
| B. Banco | 65 textos OCR e três falhas, 68 eventos |
| C. Ambiente | v7 e dois deploys live |
| D. Sessões reais | Master e busca em três módulos; demais perfis pendentes |
| E. Dados oficiais | Nenhum indicador reproduzido |
| F. Conciliação INEP | Não concluída |
| G. Aprovação humana | Não concedida |
| H. Homologação científica | **Não homologado** |

Pendências efetivas: fidelidade dos OCR, três arquivos sem texto suficiente, classificação/revisão dos vínculos do acervo, relação comprovada entre arquivos e metas, equivalências de cursos, sessões dos demais perfis, recebimento dos dados oficiais e reprodução/concilição dos indicadores. A especialização por bacharelado e publicação institucional de resultados permanecem bloqueadas.

Recibos: [OCR por arquivo](evidencias/20261117-work/ocr-real-receipt.json), [CI/publicação/sessão/classificação](evidencias/20261117-work/ocr-classification-publication.json). [Captura real do Sapiens](https://chatgpt.com/library?file_id=libfile_2768eb85523c8191b8d3eab90b0aeb34&account_id=personal).
