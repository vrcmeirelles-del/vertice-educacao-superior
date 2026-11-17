# ENAMED e Residência Médica no Discursiva 360°

Escopo: dois perfis educacionais autorais de preparação, sem importação de itens oficiais ou integração com o banco Fato & Ordem. Não há cálculo de nota oficial, equivalência de seleção ou promessa de precisão clínica.

## Implementação

- Modalidades `enamed` e `residencia`, separadas do banco institucional por metadados de cada questão.
- Sete áreas de formação: Clínica Médica, Cirurgia Geral, Pediatria, Ginecologia e Obstetrícia, Medicina de Família e Comunidade, Saúde Mental e Saúde Coletiva.
- Quatorze rascunhos de partida: sete cenários por modalidade. Podem ser carregados no editor; nenhum é homologado automaticamente ou distribuído a cursos sem decisão docente.
- Quatro respostas esperadas e quatro critérios específicos por caso: raciocínio clínico, hipóteses diagnósticas/diferenciais, investigação e conduta/segurança.
- Escala educacional de dez pontos, com pesos positivos editáveis cuja soma precisa ser dez. Não representa pontuação de edital ou exame oficial.
- Versão das referências clínicas obrigatória. Residência exige identificação de programa/edital ou indicação explícita de preparação geral sem edital vinculado.
- Geração usa somente textos extraídos selecionados no acervo autorizado; segunda IA revisa o caso, as fontes e as quatro dimensões. Ausência de fontes suficientes bloqueia geração.
- Correção lê o perfil, os critérios e as respostas clínicas congelados na prova. Não altera retroativamente protocolos nem aplica penalidades não previstas na rubrica. A nota permanece sugestão até homologação docente.
- Contrato compartilhado no frontend e backend: `source-overrides/shared/discursiva-clinical.ts`.
- Trigger privado no PostgreSQL valida também gravações via RPC diretamente: quatro dimensões distintas, respostas específicas, pesos e metadados. A origem clínica é registrada como preparação autoral.
- Homologação de questão clínica exige fontes com evidência textual e referência revisada; rascunhos sem fontes podem ser salvos para elaboração, mas não homologados.
- Provas preservam perfil, área, referências, programa e rubricas no snapshot. Impressão identifica a preparação autoral. QR mantém a vinculação assinada a essa prova/questão.

## Fontes institucionais consultadas para organização das áreas

- INEP, Manual do ENAMED para participantes e IES: https://download.inep.gov.br/educacao_superior/enade/manuais/manual_do_enamed_para_participantes_e_ies.pdf
- INEP, relatório de atividades de 2025, ENAMED: https://www.gov.br/inep/pt-br/relatorio-anual-de-atividades-e-gestao-do-inep-2025/avaliacoes-e-exames-educacionais/avaliacoes-exames-nacionais/enamed

Essas fontes organizam as áreas; não fundamentam automaticamente respostas diagnósticas ou condutas dos rascunhos. Cada questão depende de fontes clínicas próprias e de revisão docente.

## Testes e limites

Os testes verificam metadados, quatro dimensões, bloqueio de homologação sem fonte, snapshot, uso da rubrica clínica na correção e preservação dos fluxos institucionais. As chamadas de IA são simuladas. Ainda é necessária homologação autenticada com casos e manuscritos reais por equipe médica responsável.

A incorporação destes dois perfis não entrega ENEM, OAB ou importação oficial de discursivas do ENADE; esses formatos permanecem fora desta alteração.
