# Endereço por instituição

IES e escolas usam `/<slug>` no portal existente. O endereço é criado no banco a partir da sigla (ou nome), com remoção de acentos, bloqueio de rotas reservadas e sufixo numérico em colisões. Não depende do fluxo de cadastro utilizado. Renomear uma instituição não muda seu endereço.

A página consulta somente `vertice_institution_addresses`, contendo nome, tipo, logo e identificador de roteamento. As tabelas acadêmicas continuam privadas, com autenticação, MFA e RLS existentes. O login abre `/master#instituicao=<id>`; o endereço não concede acesso a uma instituição. Instituições arquivadas deixam de ter entrada pública.

Na área Base da Organização, o endereço pode ser copiado. Somente Master autenticado com segundo fator pode alterar o slug. O banco valida formato, unicidade e rotas reservadas e registra a alteração na auditoria. Ao editar o endereço, o anterior deixa de resolver: não há aliases nesta versão.

Validação: build Vite de produção concluído; testes SQL transacionais com rollback para acentuação, nomes reservados, colisões, arquivamento e recusa a alteração sem Master. O typecheck geral apresenta erros anteriores fora dos arquivos alterados. Pré-renderização existente não executou localmente (restrição de IPC; alternativa encontrou importação CSS não suportada), mas a compilação do aplicativo passou. A confirmação de build/deploy no Render é separada desses testes locais.

O escopo desta entrega é acesso ao portal. Captação e exibição de módulos contratados continuam nas áreas existentes após autenticação.
