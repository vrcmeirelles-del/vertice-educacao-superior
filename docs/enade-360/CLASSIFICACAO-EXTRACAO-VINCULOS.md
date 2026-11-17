# Classificação, extração e vínculos documentais


## Camada de evidências: classificação, extração e vínculos — 17/11/2026

O recorte correto é o repositório de ensino superior: 776 arquivos no conjunto, 771 da UNITOP com objetos presentes no Storage; 515 classificações existentes no conjunto, 511 na UNITOP. Os 11 registros de vertice_documents são da Escola Vértice — Demonstração, sem objetos originais; não representam a ausência de documentos do ensino superior e não foram artificialmente preenchidos.

Foi aplicada a migração 20261117113047_enade360_evidence_text_index: texto e páginas extraídas, SHA-256, método, cobertura parcial e sugestões de palavras-chave na pré-validação existente; busca compartilhada por arquivo/curso/indicador/solicitação/meta. RPC usa security invoker, MFA e perfil de gestão já autorizado, além das RLS existentes. As 14 políticas consultadas, 776 arquivos e 515 classificações permanecem preservados. Contexto sem identidade: autorização false e zero resultados.

O código substitui leitura binária de PDF/ZIP por parsers PDF/DOCX/XLSX/PPTX, com limites e rejeição de imagens sem OCR; preserva páginas/células/partes XML e não envia conteúdo à IA na ação index. Citações sugeridas precisam existir no texto da página indicada; os vínculos permanecem sugeridos até revisão humana. O catálogo institucional estava vazio: não se utilizam códigos e versões regulatórias inventados. A busca foi preparada para ENADE, Sapiens e planejamentos, com origens institucionais separadas dos vínculos do curso.

Validação local: 8 testes de motor/banco e 2 de UI, TypeScript aprovado. Um PDF existente foi realmente extraído: 46 páginas físicas, 69.619 caracteres, SHA-256 8ac0753e25be12d34349ee6d26a9b97e53bdcdd387963b538cfd619c04812c9a. É cópia do Drive do relatório de Direito/Faculdade de Olímpia/2022; não é original autenticado INEP nem UNITOP. Esse teste não é reprodução de indicador. Páginas sem texto exigem conferência e a cobertura parcial é explicitada.

Publicação da função e interface: pendente neste registro. Nenhum dos arquivos privados foi declarado processado em lote. O navegador em nuvem abriu o login do Supabase, sem sessão; o conector retornou erro interno ao recuperar a fonte implantada da função. Não foram emitidas credenciais, ampliadas permissões ou publicadas notas oficiais para contornar a dependência. Evidência: evidencias/20261117-work/evidence-layer-status.json.


## Publicação comprovada da camada documental — 17/11/2026

A PR [#175](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/175) foi integrada no commit `c266140afcb9c81d612a5c7917d476329e3aff6a`, após nove workflows aprovados no head `27d60d8a99c0a3183b64c58ad5fbde9050e51744`. A função existente vertice-doc-prevalidate foi publicada na versão 3, com verify_jwt=true; os três arquivos recuperados da implantação conferem byte a byte com a fonte preparada. O erro de recuperação da versão anterior não impediu a verificação da versão nova.

Render: institucional `dep-dbu6n0ijnfac73e5ceig` e portal `dep-dbu6n0ijnfac73e5cem0`, ambos live em 17/11 às 11:58:52 (Brasília). A busca compartilhada e as ações de indexação estão integradas à interface. As requisições HTTP reais sem sessão para indexação e busca foram negadas com 401. A migração mantém as políticas e os dados existentes.

Contagem final: 776 arquivos/515 classificações existentes preservados; zero fontes privadas indexadas nesta execução e zero vínculos IA criados. Na UNITOP, 768 dos 771 arquivos já possuem vínculo de curso, três são institucionais e nenhum possui vínculo de meta. A busca recupera relações existentes e não cria associações a metas por suposição.

A autenticação segura no navegador expirou sem confirmação; em uma aba nova, /master exibiu “Entre para acessar sua conta”. Portanto a etapa de processamento do acervo privado permanece pendente de sessão real com MFA. O catálogo institucional de instrumentos continua sem registros configurados: a classificação por códigos e versões requer fonte/catalogação verificável, enquanto os indicadores já cadastrados nos arquivos permanecem preservados. O lote não foi dado como processado, e esta publicação técnica não homologa indicadores oficiais.

Evidências: [estado final](evidencias/20261117-work/evidence-layer-status.json), [função publicada](evidencias/20261117-work/evidence-function-deployment.json), [negação HTTP](evidencias/20261117-work/evidence-anonymous-http.json), [arquivos servidos](evidencias/20261117-work/evidence-published-assets.json).

A inspeção dos JavaScripts efetivamente servidos localizou a RPC vertice_evidence_search e o controle de extração dos resultados no chunk compartilhado PlanningManagement, em ambos os domínios. As verificações em chunks individuais que não contêm o módulo foram mantidas no recibo; o scan de dependências identifica os arquivos corretos e seus SHA-256. Isso comprova presença do código publicado, sem substituir teste autenticado do processamento privado.


## Catálogo de referência aplicado e origem preservada — 17/11/2026

Aplicada no Supabase a migração `20261117153003_enade360_official_reference_catalog`. A UNITOP passou de zero para um catálogo ativo, IACG de reconhecimento/renovação de reconhecimento, edição outubro/2017, com 58 objetos. Foram conferidos todos os títulos, 35 textos de aplicabilidade e respectivas páginas físicas em uma cópia da publicação INEP redistribuída no repositório oficial da UFAL: 908.787 bytes, 54 páginas, SHA-256 `bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768`. O catálogo registra as URLs canônica e de obtenção, data, hash e limitações. A igualdade binária com o servidor INEP não foi comprovada; a rota direta respondeu 503. O original recebido foi preservado no [pacote de fonte](https://chatgpt.com/library?file_id=libfile_5860a77abee08191a7e61ec06bcc1cf5&account_id=personal).

O catálogo permite sugerir códigos de uma referência rastreável; não contém critérios para calcular conceitos, não aprova vínculos e não aplica automaticamente indicadores a cursos. Dois títulos existentes abreviados (2.15 e 3.15) foram completados somente no novo catálogo, sem reescrever classificações históricas. Não foi ativado instrumento proposto de 2026 como norma vigente.

Verificação posterior no banco: um catálogo, 58 objetos e correspondência exata com o arquivo de referência; 776 arquivos, 515 classificações, 771 arquivos UNITOP, zero pré-validações e zero vínculos IA. Políticas de acesso dos catálogos idênticas antes/depois. Nove testes locais de extração/banco aprovados, incluindo execução e repetição idempotente da migração em PostgreSQL isolado; a autenticação desses testes é sintética e não substitui sessão real. As 58 verificações do PDF usaram bytes reais e não constituem reprodução científica de indicador.

A nova conferência do navegador em nuvem abriu /master e recebeu “Entre para acessar sua conta”. O controle da sessão anterior pela extensão não está disponível nesta execução. Nenhuma credencial foi fabricada nem proteção removida: o lote privado permanece em zero processados. A reprodução e conciliação científica de Conceito Enade, IDD, CPC e IGC seguem sem comprovação; publicação de resultados oficiais bloqueada.

Evidências: [catálogo](fontes/iacg2017-reconhecimento-catalog.json), [verificação do PDF](evidencias/20261117-work/reference-catalog-extraction.json), [conferência do banco](evidencias/20261117-work/reference-catalog-database.json). Integração GitHub/CI deste bloco: a confirmar após publicação da branch.


### Integração e publicação confirmadas — catálogo IACG 2017

PR [#176](https://github.com/vrcmeirelles-del/vertice-educacao-superior/pull/176) integrada no commit `147dee06c1b405fea9a0d5b21af650ad735f9b4f`, após cinco workflows aprovados no head `55211f5aa6173c1281b31fab34c48d12e5055cb2`. O workflow de evidências executou nove testes e a verificação Deno da função existente. Render institucional `dep-dbu793tckfvc73cc19q0` live às 12:37:31 de 17/11 (Brasília); portal `dep-dbu793tckfvc73cc19u0` live às 12:37:29. Os alertas de segurança mantiveram as contagens anteriores, sem achados para as duas tabelas de catálogo. Esta confirmação resolve a pendência de integração/publicação do registro anterior; mantém pendentes a sessão autenticada, o lote privado e a homologação científica. [Recibo de publicação](evidencias/20261117-work/reference-catalog-publication.json).
