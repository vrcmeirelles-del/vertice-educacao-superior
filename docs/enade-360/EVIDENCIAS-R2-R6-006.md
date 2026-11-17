# Evidência 006 — Contratos R2–R6 e matriz metodológica
Registro: 2026-11-16 (America/Araguaina); execução CI: 2026-11-17 UTC.
Estado: TESTES SINTÉTICOS PASSARAM; NÃO HOMOLOGADO CIENTIFICAMENTE.

## Código implementado
- `validator/r2-r6-controls.cjs` com verificação específica R2: notas FG/CE com unidade, n e versão da metodologia; R3: questões e contagens de respostas/faltantes; R4: indicador, escopo, SC, metodologia e versão de fonte; R5: comparação com classes C0–CX, bloqueios de rupturas e de notas brutas entre áreas; R6: hipótese, evidência, limites e aprovação humana.
- `validator/integrated-gate.cjs` passou a chamar o controle específico R2–R6 na mesma instância de relatório, depois do gate básico e intercampos.
- `validator/test-r2-r6.cjs`: 23 casos sintéticos, sendo 5 positivos e 18 negativos; `validator/test-json-schema.py` teve fixtures positivas adaptadas a metadados efetivamente exigidos.
- Workflow `.github/workflows/enade360-contracts.yml` acrescentou a suíte ao CI. Não há deploy.

## Prova de execução
Commit testado: `265afdf8fed2a80d06eee3d12ae14dad7c106c57`.
Run GitHub Actions `43999596607`; job `133760060627`: `completed/success`.
Logs:
- testes semânticos originais: 26/26;
- políticas de edição/SC: 34/34;
- integração intercampos R7: 26/26;
- contratos e controles R2–R6: 23/23;
- JSON Schema Draft 2020-12 + Node: 32/32.
Total **141/141 casos sintéticos aprovados**, zero falhas.
Link: https://github.com/vrcmeirelles-del/vertice-educacao-superior/actions/runs/43999596607 .

## Matriz documental
Arquivo: `MATRIZ-METODOLOGIAS-E-TOLERANCIAS.md`.
Fontes: Nota Técnica 7/2022 (Conceito 2021), Nota Técnica 2/2023 (Conceito 2022), Nota Técnica 6/2024 (Conceito 2023), Nota Técnica 5/2024 (IGC 2022 e transição IDD), Portaria 500/2024 (IDD/CPC/IGC 2023) e páginas oficiais dos indicadores e das planilhas 2022.
Achados: IDD pressupõe dados recuperados do Enem; IGC é indicador institucional de janela trienal; planilhas de 2022 foram atualizadas em 2025. Nenhuma tolerância numérica de reconstrução foi autorizada com base nesses elementos: arredondamento de apresentação não é licença para alterar conceito.

## Limites explícitos
- R2–R6 são guardas semânticos sintéticos, não cálculos de FG, CE, IDD, CPC, IGC nem diagnóstico pedagógico de curso real.
- Regras condicionais profundas ainda não estão integralmente expressas no próprio JSON Schema; parte ocorre no Node.
- Ausência de registros no payload pode não ser distinguida de resultado válido vazio em todos os tipos.
- Checagens de segurança dependentes de flags não substituem controle real de permissões.
- Não se provaram versões/hashes dos arquivos de resultados oficiais, nem o vínculo e-MEC real dos identificadores.
- A matriz 2021–2023 não está integralmente auditada: notas técnicas, precisão e procedimentos de arredondamento por indicador continuam P-NT-001/P-TOL-001.

## Pendências
P-CROSS-001: parcialmente atendida em código/CI isolado (R1–R7), falta integração de dados reais, identificação e-MEC, cobertura de tipos e integração da aplicação.
P-TOL-001: aberta até confirmação de precisão e tolerâncias por edição e indicador.
P-NT-001: aberta (auditoria integral das notas).
P-REF-001: aberta (planilhas oficiais e hashes).
P-ZIP-001: aguardando envio posterior pelo usuário.
Gate científico: BLOQUEADO; sem especialização e sem alteração de produção.
