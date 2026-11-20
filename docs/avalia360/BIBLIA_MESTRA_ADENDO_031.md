# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 031 — Correção da emissão de provas com imagens
**Data:** 20/11/2026 | **Escopo:** prévia isolada da PR #207.

### Falha real observada
Na página de homologação, o professor criou questão discursiva de Direito Civil I — Parte Geral, incluiu imagem PNG e selecionou três estudantes fictícios da turma 2A. A seção de PDF exibia `Questão 1: a emissão PDF ainda não incorpora imagens.` e não gerava o documento. A imagem também estava sem descrição acessível e sem declaração do direito de uso. O campo Semestre estava vazio, mas não era o bloqueio reportado pelo gerador demonstrativo.

### Correção implementada
- `individualized-pdf.ts`: incorpora PNG e JPEG do arquivo local ao PDF; WebP é convertido para PNG via canvas quando o navegador oferece `createImageBitmap`. Inclui imagem na posição do enunciado/apoio ou junto à alternativa relacionada, com tamanho proporcional e legenda.
- A validação de PDF deixa de bloquear todas as imagens; exige descrição acessível, direito de uso declarado, formato aceito e alternativa existente quando aplicável. Não imprimir imagem sem confirmação de direitos, nem omiti-la silenciosamente.
- `ClassBatchPublisher.tsx`: conserva tentativa de download automático, mas disponibiliza também **Baixar PDF gerado** com URL local temporária enquanto a página estiver aberta.
- `individualized-pdf.spec.ts`: novos casos de PDF com PNG sintético e de bloqueios por ausência de acessibilidade e direitos.
- **O padrão de resposta esperado e a rubrica docente continuam reservados**: não são impressos no PDF discente. QR permanece apenas demonstrativo, sem registro no banco.

### Limites e homologação
- O PNG do caso do professor não foi copiado dos dados do navegador para ambientes externos; use o próprio anexo ao repetir o teste.
- A prévia não consulta a base oficial de alunos nem registra tokens QR no Supabase.
- Imagens ainda não são armazenadas permanentemente no Banco de Questões local. O PDF carrega diretamente arquivos que continuam na sessão do navegador.
- Antes de comunicar homologação, confirmar suíte unitária e implantação do commit no Render.
- Manter adendos 001–030 integralmente vigentes.
