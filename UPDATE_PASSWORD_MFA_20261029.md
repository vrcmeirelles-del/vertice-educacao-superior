# Redefinição de senha com autenticação em dois fatores

Os logs de autenticação mostraram a recusa `AAL2 session is required to update email or password when MFA is enabled`. A tela de recuperação classificava qualquer mensagem contendo `session` como sessão expirada, ocultando a exigência do segundo fator.

Os formulários de /entrar e /redefinir-senha agora consultam o nível de autenticação e os fatores TOTP verificados antes de alterar a senha. Quando necessário, solicitam o código do autenticador, validam com challengeAndVerify e liberam o salvamento após a elevação da sessão para AAL2. A configuração do MFA e as permissões de acesso não foram alteradas.

Cinco testes verificam o fator confirmado, sessão já elevada, matrícula de fator incompleta, falha de consulta e a distinção entre AAL2 e sessão expirada. TypeScript e build estático passaram. O teste real com código do autenticador e nova senha depende do titular; nenhuma senha foi alterada nesta operação.
