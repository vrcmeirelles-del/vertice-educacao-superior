# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 023 — Corrigida a descoberta e ativação do botão de análise
**Data local:** 2026-11-20 | **Produção:** intocada.

### Relato do usuário
O usuário informou que o botão de análise não estava disponível no site de demonstração.

### Diagnóstico
- Código publicado possuía `Analisar metadados declarados` na seção 3.
- O botão estava condicionalmente desabilitado por `!questions.length || invalidCatalog`. A interface não expunha a razão da indisponibilidade, e os campos estavam abaixo da área de edição de questões.
- A última implantação ativa no Render correspondia ao commit com esse comportamento.
- A verificação direta HTTP pelo ambiente de ferramentas não estava disponível; portanto não houve comprovação de interação em navegador do usuário.

### Correção em código
- Adicionados atalhos visíveis no cabeçalho: **Preencher informações do algoritmo** e **Ver análise pedagógica**.
- O botão **Analisar metadados declarados** foi mantido visível e habilitado; ao clicar sem dados suficientes, são mostradas instruções: adicionar questão, preencher curso e disciplina e concluir informações curriculares declaradas.
- A análise de cobertura continua identificada como **preliminar e não homologada pelo PPC**, sem atribuição de nota ou validação semântica.
- Os adendos 001–022 e a separação entre produção e demonstração permanecem preservados.

### Evidência de publicação
- GitHub commit `6df290d6ce4eda63f0c0e2ec75bc4de6c4981b68`.
- Render serviço `vertice-avalia360-homolog`, deploy `dep-dbvv1unlk1mc73bus5f0`, status **live**, finalizado em **2026-11-20T07:04:52.285009Z**.
- URL https://vertice-avalia360-homolog.onrender.com
- CI GitHub Actions **#44692243208**: 67/67 testes unitários e 20/20 PostgreSQL isolados aprovados. Isso não substitui homologação visual em dispositivo real.

### Limites
- Esta implantação vale apenas para o site de prévia no Render, não para `verticesuperior.com.br`.
- Não há conexão real Supabase, upload permanente ou PPC validado nessa demonstração.
- Navegador do usuário pode exibir versão em cache; recarregamento completo pode ser necessário.
