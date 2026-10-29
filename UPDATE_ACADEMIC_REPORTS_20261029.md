# Cruzamentos acadêmicos e documentos restritos

O painel autenticado consulta dois novos relatórios agregados em public.vertice_academic_reports. A política exige a autorização da instituição e MFA já usadas pelo site. Não foram criadas colunas com nome, CPF ou matrícula de estudante.

Continuidade: interseção por matrícula das relações de alunos do e-ORBIT com filtro MATRICULADO, consultadas em 29/10/2026. Não se trata de coorte de ingresso, e a chave não deduplica pessoas por CPF. Não localizado na relação seguinte não equivale a evasão. Os totais divergem do relatório estatístico, por isso são apresentados separadamente.

Coortes e AV1: histórico de 2023/1 a 2026/2 extraído da planilha institucional consultada em 20/10/2026. Os números da aba Resumo foram conferidos por recálculo da aba Base. O frontend recebe apenas agregados. A ausência de vínculo ou de nota positiva não comprova desistência nem ausência em prova. Dados de 20/10 não são apresentados como atualização das notas em 29/10.

Documentos: sete arquivos restritos foram enviados ao bucket privado existente, com hashes SHA-256 conferidos e registros em vertice_app.documents. Nenhum registro ficou sem objeto. Permanecem pending_scan. O arquivo Base_Integralizacao_Direito_UNITOP_19102026.json não pôde ser baixado pelo conector, que encerrou a conexão. Os demais arquivos ficam no OneDrive conforme orientação do titular. Nenhum original foi excluído. A migração completa e a integração de downloads pela API ainda não foram concluídas.

Validação: TypeScript e build estático; teste transacional de leitura master, bloqueio sem MFA e isolamento de conta sem vínculo. URL Configuration conferida: site www.verticesuperior.com.br e callback /redefinir-senha. A validação de login/senha/MFA pelo titular permanece pendente.
