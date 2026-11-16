# Identidade visual UNITOP — validação de 16/11/2026

**Resultado: validação parcial. Não homologado de ponta a ponta.**

## Evidências no ambiente publicado

| Verificação | Resultado e limite |
|---|---|
| PRs #142, #143, #144 | Integradas à `main`; conferência direta de metadados e fontes. |
| Publicação da interface | `/version.json` retornou SHA `0026446566452fa2bb7280883966eeb3d19642f6`, build de 16/11/2026 00:17:39 UTC (15/11, 21:17:39 em Brasília). Os dois serviços Render existentes indicaram essa revisão como `live`. |
| Cadastro UNITOP | Consulta somente de leitura: `logo_data` em PNG, 300 × 120 px; `header_text` = `Centro Universitário UNITOP`; `theme_color` = `#333333`; validação do banco retornou `true`. |
| Integridade | `updated_at` = `2026-11-15 19:19:31.188801+00`; fingerprint do JSON = `bb7c17521253dba7a783d1f188ec14da`. Nenhuma operação de escrita foi enviada ao cadastro. |
| Salvamento autorizado | Wrapper `public.vertice_save_document_branding` e função privada instalados. O código exige usuário não anônimo, AAL2 e função institucional; `has_role` admite Master. Isso é inspeção do código instalado, não comprovação de uma sessão Master. |
| Acesso pela interface | `/master#instituicao=1f5fd5b4-93c6-4626-834d-136884915587` apresentou pedido de login. A tentativa pelo formulário seguro recebeu “E-mail ou senha não validados”. Não foi realizada nova tentativa automática. |
| Exibição real e salvamento | Pendentes: painel com Master, seletor no site autenticado, prévia real, carregamento da logo no cartão, recuperação do PNG do Storage, salvamento e reapresentação após recarga. |

## Falha reproduzida no gerador de documentos

A função publicada `vertice-inep-library`, versão 21, ainda lê `logo_url`,
`display_name` e `brand_color`. O painel atual grava `logo_data`, `header_text`
e `theme_color`, os mesmos campos encontrados na UNITOP. Na v21, o predicado
`hasBranding` não reconhece esse objeto canônico e toma o caminho de download
do original por URL assinada.

A reprodução executou **uma cópia do código publicado com registros e arquivos
sintéticos em ambiente local**; não foi feito download autenticado em produção.
Cinco dos dez testes do gerador falharam nessa cópia. A inspeção também encontrou
uma divergência de fonte: o arquivo do gerador em `main` era anterior à v21 e
retornava somente URL assinada, sem seu processamento DOCX.

## Proposta no repositório oficial

O arquivo de `supabase/functions/vertice-inep-library/index.ts` incorpora a base
v21 inspecionada e passa a consumir o contrato canônico do painel. Mantém a
compatibilidade de leitura com os campos antigos e a restrição de URLs legadas
ao Storage do próprio projeto, sem seguir redirecionamentos.

A proposta inclui PNG embutido no DOCX, texto e cor no cabeçalho; mantém a
proporção 300:120 no desenho; respeita remoção explícita da logo; usa o nome
cadastrado quando o nome do cabeçalho está vazio; e retorna erro explícito
quando não consegue ler a identidade visual. Auth/RLS continuam sendo avaliados
antes do acesso administrativo ao Storage. Não há mudanças de grants, políticas
ou cadastro institucional.

Os modelos precisam conter os marcadores de cabeçalho já usados pela v21. Os
testes não homologam todos os modelos reais, campos divididos entre vários
trechos de XML ou outros geradores de TCC/AC/Estágio/PDF.

## Testes automatizados

| Camada | Aprovados | O que foi exercitado |
|---|---:|---|
| Gerador DOCX | 10 | Contrato, imagem/nome/cor, dois cabeçalhos, proporção, remoção, compatibilidade legada, URL externa, falha de leitura, negativas de autenticação/acesso e fluxo de PDF sem transformação. Supabase é fixture. |
| Processamento de imagens | 6 | PNG/JPEG/WebP sintéticos, FileReader/JSDOM, codecs/canvas nativos, centralização e dimensões, rejeição de tamanho/tipo/conteúdo inválido. |
| Autorização PostgreSQL/PGlite | 8 | Definições SQL capturadas; claims e vínculos sintéticos; Master/gestor, AAL1, anônimo, sem usuário, leitor, instituição distinta, conflito de versão, payload inválido e bloqueio de UPDATE direto. |
| Formulário React | 7 | RPC e revisão, conflito e erro de autorização, leitura sem botão de envio, validação, prévia local sem gravação até Salvar e atualização das props. Mocks de RPC e decodificação. |
| Cartão de navegação | 12 | Dez testes existentes e dois de renderização com/sem logo; não é conferência visual em navegador. |
| **Total** | **43** | Todos locais; não equivalem à homologação em produção. |

Build estático concluído. Checagem TypeScript estrita do arquivo proposto
concluída usando os tipos instalados do SDK e uma declaração mínima da API
Deno; não foi executado o runtime Deno/Supabase local. `git diff --check` passou.
Os testes completos do portal e os pipelines GitHub Actions não foram executados
como parte desta validação.

## Continuação necessária

1. Concluir o login Master e o MFA no navegador compartilhado.
2. Abrir Dados da Instituição → Cadastro → Identidade visual; conferir a logo
   existente no painel e no cartão, sem salvar.
3. Selecionar arquivos sintéticos somente para processamento/prévia, testar
   falhas e descartar o estado local antes de sair; não substituir a logo real.
4. Revisar/integrar a proposta e publicar especificamente a Edge Function no
   projeto existente. Esta entrega não aplica a proposta em produção.
5. Conferir um DOCX real autorizado, seus cabeçalhos e a identidade do cartão.
6. Se houver necessidade de testar gravação no cadastro real, apresentar antes
   o payload, os efeitos em revisão/auditoria e obter autorização expressa.

Fontes: PRs [142](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/142),
[143](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/143),
[144](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/144),
[versão publicada](https://www.verticesuperior.com.br/version.json), leituras
do projeto Supabase existente, metadados Render e testes locais desta proposta.
