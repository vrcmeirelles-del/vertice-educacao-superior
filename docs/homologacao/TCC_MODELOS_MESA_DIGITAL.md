# TCC 360 — modelos eletrônicos e Mesa Digital

## Origem e escopo

Estruturas identificadas na pasta OneDrive `Documentos Virgilio/Ensino/01-Instituicoes/Coordenação Uninassau/TCC`, especialmente `Modelos`, `Normas` e `Editais`. Foram lidos os documentos estruturantes de TCC I/II e modelos institucionais. Duas extrações iniciais falharam; a leitura dos respectivos arquivos por ID Graph foi concluída. As pastas de trabalhos de alunos e pagamentos não foram importadas.

Há referências antigas e misturadas a UNINASSAU, UNAMA, Farmácia, Pedagogia e anos distintos. Elas não foram adotadas como regra de outras IES. Não foram copiados nomes de alunos, notas históricas, assinaturas, CPF/RG, contatos pessoais ou PDFs integrais de normas ABNT. Os modelos são formulários neutros de dados e textos declarados. Não certificam formatação ABNT, originalidade, aprovação ética ou assinatura.

## Aba Modelos e PDF

Documentos vinculados a um TCC já cadastrado e ao seu curso, sem criar uma carteira paralela:

1. Convite de orientação.
2. Aceite do orientador.
3. Projeto de pesquisa — TCC I.
4. Acompanhamento das orientações.
5. Avaliação/aprovação do projeto — estrutura CCG-FOR-70.
6. Qualificação — TCC I.
7. Carta de depósito.
8. Declaração de autoria e originalidade.
9. Ata de defesa — estrutura CCG-FOR-24.
10. Autorização de publicação — estrutura CCG-MDL-24.
11. Termo de uso de imagem.
12. Roteiro/registro da versão final — TCC II.
13. Dossiê documental de TCC.
14. Edital e programação de defesas (minuta da coordenação, vinculada ao trabalho de referência).

Os textos e as regras específicas devem ser preenchidos segundo o regulamento da IES. Não se fixa quantidade de autores, penalidade de 20%, limite de 5% de revisões bibliográficas, calendário antigo ou autorização presumida. Os campos de notas deste modelo usam a escala 0–10 das fichas analisadas; não são lançamentos acadêmicos. A média exibida é a média aritmética simples das notas preenchidas, inclusive zero; campos vazios não entram no cálculo. A regra institucional deve constar da minuta.

## Acesso e integridade

Gestor/master pode trabalhar nos modelos da instituição. Para equipe, é exigido vínculo ativo no TCC por e-mail institucional ou autoria do cadastro nos modelos gerais. Aceite, depósito e acompanhamento exigem orientador/coorientador/professor da disciplina; ata e qualificação exigem examinador/revisor/professor da disciplina; aprovação de projeto e edital exigem gestão. A emissão exige MFA pelo contrato existente do portal. Leitor não escreve.

Rascunhos podem ser retomados. Instituição, trabalho e curso são verificados no servidor; o título vem do cadastro de TCC. O trabalho não pode ser substituído em um formulário existente. Campos fora da definição são descartados. Revisão otimista e trava transacional controlam gravações simultâneas. O cliente não recebe INSERT/UPDATE na tabela de formulários nem escrita nas definições dos modelos.

Ao emitir, o PDF inclui protocolo, revisão, conta emissora, conteúdo e anexos com hash SHA-256. O registro é `gerado`: não é aprovação, assinatura, consentimento de terceiros, depósito público nem concessão de horas. A API não altera a etapa do TCC, notas, versões finais aprovadas ou visibilidade do acervo.

A emissão arquiva PDF no repositório do curso (Mesa Digital) e em Gestão Documental, com os originais dos anexos e vínculo ao trabalho. Entra como enviado/não classificado para conferência humana. A pré-análise documental existente é acionada; eventual erro é informado. O espelhamento externo OneDrive continua sujeito às restrições anteriores e não foi homologado por esta entrega.

Arquivos: PDF/PNG/JPG, até 5 MB cada, 20 anexos e 20 MB no total; PDF composto até 30 MB. Manuscrito/original é obrigatório para versão final e dossiê. Os PDFs anexados são cópias no composto; assinaturas digitais devem ser conferidas nos originais. Para retornar documento assinado ou corrigido, usar **Nova emissão / anexar versão assinada**, mantendo o protocolo anterior como referência e reenviando os originais. A geração não verifica criptograficamente assinaturas.

## Validação e conferência

- Testes PostgreSQL embarcado: papéis, vínculo, MFA, isolamento institucional, título canônico, campos desconhecidos, revisão obsoleta, bloqueio de escrita direta, notas inválidas, consentimento sem escolha, original obrigatório, emissão de todos os modelos, repetição sem duplicidade e etapa acadêmica preservada. Inclui o guard existente de caminhos/conta de upload do repositório.
- Testes de interface: rascunho retido após erro, emissão incompleta bloqueada, leitor sem controles de escrita e resposta RPC de uma linha normalizada.
- Testes PDF/schema: campos de cada modelo, consentimento explícito, zero/ausência na média e renderização customizada. A suíte de Extensão é repetida porque o renderizador é compartilhado.
- Checagem TypeScript, suíte geral e build estático do portal composto.
- Conferência visual de uma ata sintética com dois avaliadores, notas zero e oito. Nenhum dado real foi usado.

### Homologação no portal

1. Coordenação cadastra trabalho fictício explicitamente identificado como teste; vincula curso, autores e orientador.
2. Participante autenticado cria um rascunho e o reabre.
3. Conferir que autor não emite aceite, aprovação ou ata sem o papel apropriado.
4. Orientador prepara aceite/acompanhamento; coordenação prepara aprovação; banca prepara ata.
5. Emitir PDF, abrir anexos e conferir protocolo, conta emissora, título, curso e semestre.
6. Verificar original e PDF na Gestão Documental e no repositório do curso, enviados/não classificados.
7. Conferir que notas, etapa, horas e visibilidade do acervo não mudaram com a emissão.
8. Retornar uma versão assinada por nova emissão vinculada ao protocolo anterior; gestor confere o original.
9. Verificar o espelhamento externo separadamente, quando aplicável.
