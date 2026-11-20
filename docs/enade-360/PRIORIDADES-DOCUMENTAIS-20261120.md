# Execução das prioridades documentais — 20/11/2026

## Conciliação concluída; recuperação ainda pendente

Consulta ao projeto autorizado `qvetbbmviatxxatzzuzc` em 20/11/2026: a auditoria contém os 65 eventos de importação OCR e três eventos de falha da operação `enade360_local_ocr_20261117`. Dos 65 alvos declarados, 58 pré-validações estão presentes e sete IDs de pré-validação não existem na tabela atual. A causa da ausência não foi comprovada. O recibo histórico permanece intacto; não será reescrito para ocultar a divergência.

`evidencias/ocr-reconciliation-20261120.json` identifica os sete arquivos e os alvos ausentes. A ferramenta `scripts/enade360-reconcile-ocr.mjs` confere existência, identidade do arquivo, SHA-256, método, estado parcial e presença de texto. Recibo e auditoria sozinhos não comprovam persistência. Saída 2 significa divergência, não erro de execução. A ferramenta só lê exportações locais e escreve o relatório local solicitado; não acessa serviços.

## Lotes concretos

O manifesto `evidencias/pending-batches-20261120.json` separa dez originais sem texto, os 33 parciais anteriores e 58 OCR persistidos com revisão de fidelidade pendente. Inclui IDs institucionais, curso quando existente e hashes esperados, sem conteúdo documental ou credenciais. Os sete arquivos divergentes são subconjunto dos dez sem texto. Não reimportar os 58 já existentes.

Sequência: obter originais pela sessão autenticada; verificar SHA-256; executar OCR local nos dez; revisar cobertura por página dos 33 (13 DOCX, 17 PDF e três XLSX); conferir os 58 OCR com seus originais; apresentar o lote resultante para aprovação expressa antes da persistência. Manter estados parciais quando a fidelidade ou a cobertura não estiver validada. Uma importação futura deve gravar versão e auditoria na mesma transação, conferir o resultado persistido e ser idempotente por arquivo/hash/versão de extração. Não reconstruir texto a partir de contagens ou de eventos de auditoria.

O PDF `3c891097-1ec8-5749-ae6a-16c449adf354` já tem OCR parcial; não repetir o parser Edge que atingiu CPU. O histórico pending/processing não se torna sucesso por esse fato.

## Classificação por algoritmo: teste real local concluído

A main consultada (`5f39059`, PR #247) já contém `regras-bm25@2026-11-20`, com IA opcional sujeita à política existente. A lista de funções do Supabase registra `vertice-doc-prevalidate` v11 ACTIVE, JWT obrigatório. A tentativa de recuperar seu bundle retornou erro do serviço; não foi comprovada igualdade byte a byte nesta execução.

Os textos reais persistidos dos três DOCX de horário foram submetidos localmente ao algoritmo da main, com os 58 objetos do catálogo UNITOP consultado. Cada arquivo produziu natureza Horário e uma sugestão ao indicador 1.6, com trecho aceito pelo validador groundedLinks. As sugestões não passaram por aceite pedagógico. Os hashes são iguais; os três registros permanecem distintos. Recibo: `evidencias/classification-dry-run-20261120.json`. Zero chamadas de provedor e zero gravações persistentes. As falhas Anthropic históricas continuam preservadas; este ensaio não é execução autenticada da função publicada nem resolve a causa do 404.

## Bloqueio observado e aceite restante

O navegador em nuvem abriu `/master`, que exibiu “Entre para acessar sua conta”; a tela `/entrar` foi preparada. Sem sessão autenticada e MFA não foi possível baixar os originais privados, executar o lote ou testar a recuperação nas três telas por perfis reais. Não foram criadas sessões, alteradas permissões, reativada IA ou aprovadas evidências.

Depois da autenticação e da aprovação do lote concreto: conferir recuperação por palavra exclusiva do corpo no ENADE 360°, Sapiens e Planejamento; comparar arquivo, hash, instituição e curso; testar curso permitido/negado e outro perfil institucional autorizado, sem fabricar identidades. Registrar versões, resultado e IDs reais. Somente então atualizar o estado operacional de cada pendência.

## Validação

Nove testes locais passaram: cinco cenários de conciliação (alvo ausente, identidade/hash/texto inválidos, auditoria ausente, duplicidade e sete ausências em 65) e quatro testes do classificador existente. Também foi executado o classificador sobre os três textos reais indexados. Nenhuma homologação integral foi concedida.
