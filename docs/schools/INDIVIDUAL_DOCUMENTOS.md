# Acompanhamento individual e documentos escolares

## Destinos

Gestão Pedagógica → Acompanhamento Individual (`escola-individual`) e Documentos e Assinaturas (`escola-documentos`). Perfis: direção institucional com segundo fator. Nenhum novo acesso discente/docente. Os cadastros não reutilizam a tabela universitária que exige curso/CPF/e-mail: são próprios da escola e usam matrícula, nome, turma e fonte.

## Alertas explicáveis v1

Observações com início/fim de período, dias previstos/presentes, resultado percentual normalizado, renovação e prazo. Eventos são acrescentados ao histórico, com turma na data, fonte e autor. Intervenções registram ação, responsável, prazo e devolutiva, sem mensagens automáticas.

O painel considera a observação mais recente, até 45 dias, de estudantes ativos. Frequência inferior a 75%, desempenho inferior a 50% ou renovação pendente/não renovada após o prazo geram sinais para apuração. Ausência de dados não vira risco baixo. Não é modelo preditivo validado, probabilidade, diagnóstico nem regra legal de aprovação. Limiares estão identificados como operacionais v1. Não utiliza atributos sensíveis ou inferência de saúde. A validação futura de um modelo exige histórico e desfechos individuais, avaliação retrospectiva e acompanhamento de falsos positivos.

## Documentos

Modelos são criados em rascunho e aprovados explicitamente pela direção. Mudanças criam nova versão; documentos anteriores preservam o texto e o cadastro usados na emissão. A Edge Function autenticada `vertice-school-documents` coleta snapshot pela RPC, gera PDF com pdf-lib 1.17.1, reutiliza identidade visual PNG quando disponível, grava em bucket privado e registra SHA-256, número e protocolo. A conclusão só é marcada após persistência. Protocolo consultável no painel institucional autenticado, não um validador criptográfico público.

As transições da emissão são generating → issued/failed, sem assinatura implícita. Arquivos originais não são substituídos por assinados. Downloads usam URL assinada de 120 segundos, emitida após autorização institucional. As tabelas privadas têm RLS e sem grants diretos a anon/authenticated; escrita do arquivo/metadados de emissão pertence à credencial de serviço.

## Autentique

Credenciais não são armazenadas no navegador, no Git ou no formulário do usuário. Configurar segredo do servidor `AUTENTIQUE_INSTITUTION_KEYS` como objeto JSON indexado pelo UUID institucional. Cada valor pode ser `{ "token": "credencial_da_conta", "mode": "sandbox" }`. String simples também usa sandbox. Somente `mode: production` habilita produção. Não compartilhar chave global implicitamente entre escolas. A interface informa configuração e ambiente, sem revelar o token.

O envio exige lista de signatários e autorização explícita na interface; não foi realizado envio externo nesta implementação. A chamada usa GraphQL multipart, o PDF original com hash conferido e sandbox conforme configuração. Envio concorrente é bloqueado pela transição unsigned → sending. Falha de confirmação deixa unknown e exige conciliação no provedor, sem reenvio automático que possa duplicar convites.

A situação pode ser consultada por botão (não há webhook configurado neste pacote). Assinaturas parciais, completas e recusas são separadas. A cópia assinada é arquivada quando fornecida em URL HTTPS do domínio permitido do provedor e aceita pelos limites. Se não puder ser arquivada, a pendência fica explícita. A confirmação da API não equivale a uma validação criptográfica independente. A homologação externa depende da credencial e de uma conta do provedor; preços, faturamento e autorização institucional são externos ao código.

## Gov.br manual

O gestor baixa o original, assina no portal oficial e devolve o PDF. Não se utiliza a API governamental restrita. O upload exige PDF até 5 MB, diferente do original, e fica manual_pending_review. Conferência humana documentada registra manual_reviewed, nunca alega verificação criptográfica automática. O conteúdo deve ser conferido contra o original, assim como signatários e resultado no VALIDAR/ITI. Hash sozinho não comprova assinatura nem correspondência entre documentos.

## Verificação

Testes de regras e ausência de base, observações antigas, renovação, modelo, autorização e isolamento; SQL transacional cobre revisão vencida, período/frequência inválidos, bloqueio de emissão com modelo em rascunho, snapshot e preservação de versões, assinatura não recebida e negação de usuário não vinculado/anônimo. Todas as fixtures de banco são revertidas. PDF sintético renderizado com Poppler e inspecionado; não é documento real de aluno.
