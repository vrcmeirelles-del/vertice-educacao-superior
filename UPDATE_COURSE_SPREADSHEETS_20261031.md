# Dados de cursos a partir das planilhas

O painel de cursos passa a mostrar reprovações agregadas por semestre e a quantidade de matrículas presentes na lista de acompanhamento, com origem e limitações visíveis. RF/RN/RA representam matrículas em disciplinas; não são pessoas únicas. A lista de acompanhamento não tem semestre de seleção informado, e ausência na lista não equivale a risco zero. Nomes, contatos e identificadores de alunos não entram nesse relatório de curso.

As consultas de relatórios percorrem todas as páginas. A edição mais recente substitui o relatório inteiro de matrículas de um curso/semestre/status, evitando manter turmas de versões anteriores junto à nova. Capacidade e disponibilidade não fornecidas pela fonte são nulas, e relatórios ausentes aparecem como não informados. Subtotal e soma das turmas continuam separados para conferência.

TypeScript, 76 testes e build estático aprovados. A migração mantém as políticas de acesso existentes e apenas permite quantitativos de capacidade desconhecidos e o tipo de relatório course_indicators. Os dados privados das planilhas e a carga por curso não são publicados neste repositório.
