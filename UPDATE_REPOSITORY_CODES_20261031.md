# Códigos dos documentos por curso

O prefixo fixo DIR dos modelos passa a ser substituído pelo código cadastrado do curso, preservando zeros à esquerda: Direito UNITOP, código 027, usa 027-NDE-01. Na ausência de código, utiliza-se abreviatura estável do nome, sem artigos nem grau acadêmico. Documentos institucionais usam IES.

A regra abrange catálogo, configuração, envio, administração, arquivos, histórico e CSV. As novas exigências salvam o código do curso; as existentes são apresentadas com o prefixo atual. Uma identidade canônica interna reconhece os modelos legados e atuais, evitando duplicidade no checklist e separação indevida da série histórica. Códigos personalizados são preservados.

Validação: TypeScript, 63 testes e build estático passaram. Inclui testes de zeros iniciais, abreviações, códigos personalizados, identidade do catálogo, histórico misto e exportação CSV. Não houve migração do banco nem alteração dos caminhos dos arquivos.
