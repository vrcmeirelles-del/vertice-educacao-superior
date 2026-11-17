# E1 — Auditoria textual inicial por questão e equivalência dos cadernos ENAMED 2026
**Data:** 17/11/2026 · **Escopo:** PDFs oficiais regulares/reaplicação C1/C2 recuperados e verificados sob SHA-256 + consultas somente leitura em `public.fo_enamed_items`. **Status:** evidência parcial de identidade, não homologação integral de conteúdo nem de gabaritos definitivos.

## Artefatos oficiais
- Corpus GitHub Actions run [44017133303](https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/44017133303), artefato `14299257407`, oito PDFs sob TLS validado; hashes preservados em `INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json`.
- Extração sem OCR: PyMuPDF sobre 24 páginas de questões por caderno, descartando questionário de percepção e capa. Cadernos com **100 questões numeradas 1 a 100 cada**. Atenção: algumas questões ocupam páginas/colunas; essa extração não prova fidelidade de figuras e tabelas.
- `ENAMED_2026_LOCALIZADOR_PAGINAS_400_QUESTOES.json`: página física de início de cada uma das 400 posições (4 cadernos × 100).
- `ENAMED_2026_MAPA_PERMUTACOES_CADERNOS_DRAFT.json`: correspondência editorial preliminar das questões C2 → C1, separadamente para regular e reaplicação, sem divulgar enunciados completos.

## Descoberta: a segunda versão é uma permutação da primeira
| Aplicação | Correspondências por abertura textual normalizada | Mesma alternativa preliminar nas correspondências |
|---|---:|---:|
| Regular: C2→C1 | 100 de 100 | 100 de 100 |
| Reaplicação: C2→C1 | 100 de 100 | 100 de 100 |

Método: comparação das aberturas de enunciado (110 primeiros caracteres normalizados; um item da reaplicação com prefixo extraído de forma ligeiramente distinta obteve similaridade ~98,2%) e confirmação da letra preliminar pela posição transformada. Os mapas são **bijetivos** (cada posição 1–100 aparece exatamente uma vez), não arbitrários. A diferença entre cadernos **não deve duplicar a questão clínica**; conservar cada caderno, posição e gabarito para aplicação e histórico. A correspondência ainda requer conferência integral de alternativas e de imagens antes de virar alias homologado.

## Primeira reconciliação textual F&O × documento oficial: 483 registros
- Consulta `SELECT` de `id, source_url, question_number, left(stem,175)` em lotes de 80.
- Para os regulares C1/C2 foi aplicada a permutação confirmada; para reaplicação C1 usou-se a posição original.
- Comparação **dos 24 primeiros caracteres alfanuméricos normalizados** de cada enunciado armazenado com a abertura da questão no PDF.
- **REG-C1: 200/200 compatíveis**, **REG-C2: 200/200**, **REAP-C1: 83/83**; total **483/483 compatíveis na abertura**, nenhum prefixo inicial discrepante. Nenhuma alteração no banco.
- **Limite incontornável:** prefixo de 24 caracteres não equivale a comparação integral de enunciado/comando/alternativas, nem a revisão clínica. Identidade textual total e integridade de mídias estão PENDENTES. Concordância de gabarito com a versão **preliminar** já tinha sido apurada separadamente (483/483).

## Reaplicação — diagnóstico corrigido
- Reaplicação C1: 100 posições no caderno oficial; F&O `fo_enamed_items` contém 83, faltando **17 posições**: 1, 11, 20, 22, 24, 27, 31, 36, 42, 49, 53, 57, 59, 74, 88, 91, 98.
- Reaplicação C2: também 100 posições oficiais, mas são permutações das mesmas 100 questões do C1, e nenhuma posição de C2 foi encontrada na tabela examinada. Isso representa **100 referências de caderno por criar/conferir**, **não 100 casos clínicos adicionais**.
- A lacuna *candidata* de **conteúdo distinto** no acervo de reaplicação é de 17 questões, sujeita a busca em outras origens. O mapa específico `ENAMED_2026_REAPLICACAO_17_POSICOES_EQUIVALENTES.json` relaciona cada uma das 17 à posição correspondente no C2.
- Guardar identidade de C1/C2, não escolher/descartar caderno por número coincidente; gabaritos mudam de posição e devem ser remapeados conforme aplicação.

## Duplicatas do banco (sem correção)
- Duas linhas por posição nos 100 itens de cada caderno regular (200 duplicações). 57 posições apresentam alguma diferença textual entre cópias; duas posições do C1 regular (Q19 e Q28) diferem no JSON de alternativas, aparentemente por espaçamento/pontuação. **Nenhum ID ou tentativa foi alterado**.
- 191 posições com subtema editorial divergente e 192 com keywords divergentes continuam exigindo julgamento pedagógico.

## Matriz de aceite e segurança
- [x] Arquivos oficiais: quatro cadernos + quatro gabaritos preliminares com TLS/sha256.
- [x] 400 posições oficiais localizadas por página física.
- [x] 200 correspondências entre variantes de caderno, com gabarito preliminar equivalente.
- [x] 483/483 aberturas textuais compatíveis com o PDF na posição correspondente; **apenas prefixo**.
- [ ] Comparação integral de enunciado, comando, alternativas, mídias, tabelas e retificações por item.
- [ ] Gabaritos **definitivos** após a divulgação, com versão, anulações, alterações e novo hash.
- [ ] Revisão médico-pedagógica de competências, temas, subtemas e keywords com duas IAs independentes após os gates normativos.
- [ ] Homologação de acessos reais Master, Reitoria, CPA, Coordenação, NDE, escopo de curso e isolamento entre IES; inspeção da política RLS e SSR não substitui essas sessões.
- [ ] Ponte F&O → Vértice → Sapiens testada com dados sintéticos e indicadores publicados, ainda não observados.
- [ ] Aceite E1 com metodologia oficial completa e validação regulatória.

**Decisão:** E1 segue aberta; E2/E3 somente preparação; issue #170 encaminhada à curadoria mas sem pareceres executados; PR #168 draft, sem merge/deploy. Não gravar alterações em dados de questões, gabaritos ou estudantes.
