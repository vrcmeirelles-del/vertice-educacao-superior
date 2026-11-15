# Gestão escolar integrada

Sete destinos novos no Workspace de instituições com tier escolas: escola-bi, escola-permanencia, escola-financeiro, escola-dados, escola-projetos, escola-estagio e escola-captacao. O Superior preserva seus módulos. A autorização continua institucional, com segundo fator e perfis de direção; não foram concedidos novos acessos aos estudantes ou professores. As telas usam a RPC vertice_school_operations, sem acesso direto à nova tabela privada.

## Fontes e decisões

- O BI e a permanência consultam vertice_school_classes, vertice_school_segments e vertice_school_indicators. Filtros: ano letivo, etapa e turma. Médias são declaradas por turma, com escala na fonte; não são somadas. Contagens são vínculos, não alunos únicos. Falta de dados não vira zero. Abandono declarado e transferência permanecem distintos. Não há previsão individual de risco ou cálculo de evasão por comparação de estoques.
- Finanças usa registros por unidade ou turma e mês. Série agrega os fechamentos vinculados às turmas correspondentes. Unidade não soma novamente os registros das turmas. Cartões somam somente registros concluídos e exigem campos completos. Saldo a receber é posição, não fluxo somável entre meses. Saldo operacional de caixa não é lucro nem EBITDA. A simulação exige parâmetros explícitos e não grava resultados como fatos.
- Importação CSV UTF-8: modelo, prévia, confirmação e lote atômico de até 200 turmas. Registros duplicados são rejeitados; nenhuma substituição silenciosa. Edição exige revisão atual. Exportação neutraliza fórmulas. A cópia JSON contém somente fontes desta RPC, não um backup integral de Supabase.
- Projetos/atividades: categoria, responsável, PPP/planejamento, horas, participações, produtos e evidências; não há certificação automática.
- Estágio escolar: referência interna do estudante, concedente, supervisor, período, termo, horas, avaliação e dossiê. Não gera documentos jurídicos nem valida documentos ou horas automaticamente. Destina-se às ofertas que utilizem estágio, sem criar curso superior fictício.
- Captação: contagens declaradas por canal/coorte/período. Não há deduplicação automática nem envio de mensagens.

Todos os registros novos exigem fonte e data. Cada gravação gera trilha com autor, antes/depois e horário. Não há exclusão destrutiva. Registros operacionais podem ser arquivados. Importações e edições usam a escola do usuário, sem aceitar vínculos de outra instituição/ano.

## Planejamento e Sapiens

O contexto escolar do Sapiens inclui os novos dados por ano, com fontes e revisão original. Referência individual do estudante e supervisor do estágio não entram no contexto. Para estágio, só entram horas declaradas e estado do registro. O parecer continua aguardando revisão humana e não executa recomendações.

## Validação e limites

Testes cobrem ausência versus zero, bases de taxas incompatíveis, saldo sem custos completos, CSV com aspas/quebras/acentos, fórmulas em exportação, lotes inválidos e escopo institucional da UI. SQL transacional cobre criação/edição, duplicidades, revisão vencida, lote atômico, escola versus Superior, usuário não vinculado, anônimo e contexto agregado do Sapiens. As transações de teste são revertidas.

Conectores automáticos da secretaria, restauração integral de backups, acompanhamento individual longitudinal, assinatura/emissão documental e homologação com dados reais de cada escola são etapas próprias; não se tornam funcionais apenas por existir este painel.
