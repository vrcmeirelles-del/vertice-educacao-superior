# Classificação, extração e vínculos documentais


## Camada de evidências: classificação, extração e vínculos — 17/11/2026

O recorte correto é o repositório de ensino superior: 776 arquivos no conjunto, 771 da UNITOP com objetos presentes no Storage; 515 classificações existentes no conjunto, 511 na UNITOP. Os 11 registros de vertice_documents são da Escola Vértice — Demonstração, sem objetos originais; não representam a ausência de documentos do ensino superior e não foram artificialmente preenchidos.

Foi aplicada a migração 20261117113047_enade360_evidence_text_index: texto e páginas extraídas, SHA-256, método, cobertura parcial e sugestões de palavras-chave na pré-validação existente; busca compartilhada por arquivo/curso/indicador/solicitação/meta. RPC usa security invoker, MFA e perfil de gestão já autorizado, além das RLS existentes. As 14 políticas consultadas, 776 arquivos e 515 classificações permanecem preservados. Contexto sem identidade: autorização false e zero resultados.

O código substitui leitura binária de PDF/ZIP por parsers PDF/DOCX/XLSX/PPTX, com limites e rejeição de imagens sem OCR; preserva páginas/células/partes XML e não envia conteúdo à IA na ação index. Citações sugeridas precisam existir no texto da página indicada; os vínculos permanecem sugeridos até revisão humana. O catálogo institucional estava vazio: não se utilizam códigos e versões regulatórias inventados. A busca foi preparada para ENADE, Sapiens e planejamentos, com origens institucionais separadas dos vínculos do curso.

Validação local: 8 testes de motor/banco e 2 de UI, TypeScript aprovado. Um PDF existente foi realmente extraído: 46 páginas físicas, 69.619 caracteres, SHA-256 8ac0753e25be12d34349ee6d26a9b97e53bdcdd387963b538cfd619c04812c9a. É cópia do Drive do relatório de Direito/Faculdade de Olímpia/2022; não é original autenticado INEP nem UNITOP. Esse teste não é reprodução de indicador. Páginas sem texto exigem conferência e a cobertura parcial é explicitada.

Publicação da função e interface: pendente neste registro. Nenhum dos arquivos privados foi declarado processado em lote. O navegador em nuvem abriu o login do Supabase, sem sessão; o conector retornou erro interno ao recuperar a fonte implantada da função. Não foram emitidas credenciais, ampliadas permissões ou publicadas notas oficiais para contornar a dependência. Evidência: evidencias/20261117-work/evidence-layer-status.json.
