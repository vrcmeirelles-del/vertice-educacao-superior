# Aquisições no portal master

Atualização: 02/11/2026. Decisão expressa do titular: utilizar o projeto Supabase
existente da Vértice, com estruturas e cofre exclusivos, sem novo projeto pago.
Esta decisão substitui a orientação anterior de manter o módulo apenas local.

## Acessos

- Divulgação: `/aquisicoes`, também destacada na página inicial e em Soluções.
- Operação: `/master/aquisicoes`, com o mesmo login e segundo fator do master.
- Supabase: `qvetbbmviatxxatzzuzc`.
- Cofre: `vertice-aquisicoes-cofre`, sempre privado, sem policies de acesso direto.
- Arquivos: função autenticada `vertice-aquisicoes-files`; download de 300 segundos.

## Operação

1. Cadastre a instituição contratante no master e abra um novo mandato.
2. Identifique alvo, lado da operação e checagem de conflitos.
3. Registre o escopo e utilize os 305 requisitos do instrumento fixado ao mandato.
4. Envie evidências ao cofre e vincule-as aos requisitos com indicação de página/aba.
5. Registre respostas, análise, achados, mecanismo contratual e providências.
6. A análise financeira usa fonte do cofre e premissas explícitas. O banco
   recalcula EBITDA, ajustes, valor da operação e patrimônio indicativo.
7. Redija a conclusão; a aprovação exige conclusão explícita dos requisitos.
   Alterações posteriores da base tornam a aprovação anterior desatualizada.
8. Exporte tracker, matriz de risco e relatório. O navegador permite salvar em PDF.

O master pode abrir mandatos; só acessa o conteúdo dos mandatos em que possui
participação válida. O segundo mandato para o mesmo alvo exige referência
documental, equipe separada e responsável diferente. A parede impede participação
com acesso a conteúdo nos dois lados, mesmo com consentimento. O responsável de
cada mandato concede, renova e revoga participações; pode restringir por frente.

## Limites observáveis

- O hash é calculado no recebimento; isso não valida o conteúdo jurídico nem
  equivale a antivírus. Arquivos entram como aguardando conferência.
- Há registro imutável de mudanças e de solicitações autorizadas de download.
  Uma URL já emitida permanece válida até expirar, por no máximo 300 segundos.
- A data de retenção é contratual e acompanhada no painel. Não existe eliminação
  automática de cofre nesta versão; apagar definitivamente exige procedimento
  próprio e decisão do titular, preservando a auditoria necessária.
- Os registros locais anteriores foram preservados e não foram enviados ao
  Supabase. Os 305 requisitos são catálogo, não dados de cliente.
- Os campos de resposta destinam-se à análise institucional. Não cadastrar CPF,
  identificação de aluno, senhas, justificativas individuais ou dados pessoais
  desnecessários. O escopo e o contrato devem delimitar finalidade, documentos
  necessários, acesso e retenção antes do recebimento de um acervo real.
- Declarações e referências da publicidade descrevem o serviço de consultoria;
  a ferramenta não decide viabilidade jurídica nem garante aprovação regulatória.

## Fontes de implantação

Fonte/release desta integração em `.local/integracao-master-work` e
`.local/integracao-master-release`, dentro deste diretório. O repositório publicado
é `vrcmeirelles-del/vertice-educacao-superior`; o módulo está em
`source-overrides/client/src/components/acquisitions/`.

Migração aplicada: `acquisitions_master_portal`. Os dados institucionais
existentes, biblioteca e cálculos anteriores não são alterados pelo módulo.

## Verificações

`node --test tests/master-portal.test.mjs`: PostgreSQL embarcado real, checando
MFA, gravação, 305 requisitos, isolamento de equipe, frente, privilégio documental,
parede, expiração/revogação, imutabilidade, recálculo e aprovação/desatualização.

A validação remota de abertura e edição é transacional e termina com rollback;
não cria instituição nem deixa mandato de teste no banco de produção.
