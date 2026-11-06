# Procedimento de recuperação de Backups Acadêmicos — Vértice

## Propósito
A aba Backups Acadêmicos recebe RAR, ZIP e BAK até 50 MiB por arquivo em armazenamento privado separado por instituição. O registro guarda formato declarado, assinatura preliminar, SHA-256, origem, usuário e data. Não abre arquivos nem modifica o BI automaticamente.

A opção Solicitar restauração apenas registra uma solicitação técnica. Não há SQL Server ou serviço de restauração automática provisionado; não contratar serviços adicionais sem decisão específica.

## Recuperação segura
1. Preservar o original e registrar SHA-256, competência, instituição, origem e autorização de uso.
2. Inspecionar compactadores em ambiente isolado, com ferramentas apropriadas e verificação contra conteúdo malicioso. Nunca executar arquivos do backup.
3. Se o formato do BAK for confirmado como Microsoft SQL Server, usar RESTORE HEADERONLY, RESTORE FILELISTONLY e RESTORE VERIFYONLY num servidor de laboratório com menor privilégio, nunca diretamente na produção.
4. Restaurar para banco novo e diretórios de arquivos separados, observando compatibilidade de versões. Sem autenticação com os sistemas produtivos.
5. Mapear as tabelas usando o inventário UNI_GIZ e suas chaves/relacionamentos. A relação de 642 tabelas não contém, por si, os registros acadêmicos.
6. Exportar conjuntos de dados agregados e auditáveis por curso, semestre e instituição, preservando rastreabilidade e confidencialidade dos dados pessoais.
7. Só publicar indicadores no BI homologado após análise da fonte, conciliação dos totais e aprovação superior.

## Fontes conhecidas UNICALDAS em 06/11/2026
- RAR de aproximadamente 17,8 MB na raiz da pasta Migração.
- BAK de aproximadamente 45,6 MB dentro da pasta part001.
- CSV com inventário de 642 tabelas no esquema dbo.
- Metadados das pastas part002 a part026 indicaram ausência de arquivos.

## Cuidados
- UUID institucional para segregação. CNPJ para vínculo cadastral, nunca autorização automática de acesso.
- O hash do upload é calculado no cliente; utilize Conferir cópia para recomputar o hash do arquivo armazenado.
- O cabeçalho BAK não é verificado como SQL Server no navegador.
- A integração OneDrive usa a pasta já autorizada para a IES e não aceita caminhos arbitrários.
- O conteúdo de backups não é transmitido a modelos de IA.
- Dados existentes da Vértice não são sobrescritos.
