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
