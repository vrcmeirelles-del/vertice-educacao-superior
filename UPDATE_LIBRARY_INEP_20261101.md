# Biblioteca INEP no portal /master

A biblioteca foi integrada ao site real `https://www.verticesuperior.com.br/master`,
no mesmo login e segundo fator. Na lista de instituicoes, ha o atalho
**Biblioteca INEP**; dentro da instituicao, ha uma aba com esse nome ao lado
do Repositorio. Disponivel aos vinculos autorizados da instituicao, inclusive
coordenadores cadastrados como Equipe.

Consulta por codigo ou nome, dimensao, indicador, formato e referencias a
preencher. A UNITOP recebeu 210 documentos: 196 DOCX, 10 PDF, 4 XLSX,
incluindo 37 REF. Sao 58 indicadores e D0-Apoio. Codigos e nomes originais,
pares Word/PDF e metadados foram preservados.

Arquivos ficam no bucket privado `vertice-biblioteca-inep`, sem policies de
acesso direto para anon/authenticated. A tabela `vertice_inep_library` tem
institution_id, RLS e somente leitura para usuarios vinculados com MFA aal2.
A Edge Function `vertice-inep-library` verifica o usuario com Auth, consulta
o documento sob a RLS da sessao e emite URL de 300 segundos. Download e
registrado em `vertice_audit`; nao cria evidencia nem muda cobertura.

Validacao: TypeScript, 91 testes da aplicacao, build estatico, testes SQL com
rollback (tenant/MFA/inativos/visitante/Storage/escrita) e verificacao dos 210
objetos por SHA-256 durante transferencia. Sem login, a API retorna 401.
As configuracoes, usuarios, senhas e documentos enviados nao foram alterados.

Fontes atuais estao em `source-overrides/` e no ZIP de fontes completo.
O site compilado esta em `vertice-static.zip`; nao incluir os arquivos Word/PDF
da UNITOP em public/ ou no pacote estatico.

Migracao aplicada: `20261101224102_institutional_inep_library.sql`.
Nao reaplicar em banco onde essa versao ja esteja registrada.
Na funcao, a verificacao JWT do gateway fica desativada para compatibilidade
com as chaves atuais; o corpo sempre valida a sessao via `auth.getUser()` e
reaplica RLS/MFA. Nao retirar essa validacao.
