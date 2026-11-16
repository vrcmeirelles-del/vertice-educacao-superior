# Inteligência de Mercado — primeira versão

Integração nativa em Master → Instituição → Gestão e Acessos → Inteligência de Mercado. Usa o login, MFA e Supabase existentes. O módulo de mandatos de aquisições e seu cofre permanecem independentes desta inteligência pública.

## Entregue

- Ficha por operação e escopo, chave estável para deduplicação, estágios distintos de negociação, anúncio, contrato, aprovação, conclusão e integração. Unificação de mantidas não equivale a compra societária.
- Fatos, inferências, fontes, datas de publicação/conferência, valor informado, matrículas e ano de referência, territórios, cursos e exposição.
- Escalas justificadas de oportunidade, risco, urgência e esforço; vazio é não dimensionado. A triagem é `max(oportunidade, risco) × urgência / esforço`: alta ≥10, média ≥4, baixa <4. Não é probabilidade nem previsão financeira.
- Cenário comercial exclusivo do Master: unidades elegíveis × preço mensal informado, exigindo premissas. Não representa receita contratada.
- Histórico imutável, proteção de revisões concorrentes e atualização sem criar versão para conteúdo inalterado.
- Criação explícita de ação no 5W2H vinculada a meta do mesmo escopo, com confirmação humana, responsável e prazo. Ação nasce não iniciada e sem validação. Repetição retorna o mesmo vínculo.
- Coleta diária às 03h de Brasília por cron no Supabase. Fontes iniciais fixas: ABMES, listagem do CADE, páginas de RI Yduqs e Ânima, documentos recentes Afya/SEC. Apenas descoberta de publicações para conferência, sem IA, inferência automática de status ou criação de ação.
- URLs coletadas não se duplicam. A última observação é atualizada. Páginas sem data conhecida preservam data nula e primeira descoberta separada da data do fato. Primeira coleta pode incluir antecedentes.
- Resultados e falhas por fonte aparecem na interface. A ausência de candidatos não prova ausência de negócios. Coleta cobre listagens selecionadas, não todos os processos, PDFs, CVM ou e-MEC.

## Acesso

Master: institucional e comercial; gestão: somente sua instituição. Coordenação/NDE: exige curso autorizado. A base de produção ainda utiliza papéis legados `gestor/equipe/leitor`; para equipe, acesso a mercado exige vínculo ativo de curso em `vertice_learning_staff_scope`. Não houve migração global de RBAC nem ampliação de acesso a outros módulos. Leitor sem acesso ao módulo. Demais papéis descritos no código ficam sujeitos ao suporte do cadastro real.

Tabelas privadas com RLS, sem acesso direto do navegador. RPC pública invoker delega a gateway privado que confere identidade, MFA, instituição, perspectiva e curso. Coletor aceita somente JWT de Master/MFA ou segredo exclusivo do cron guardado no Vault. Não coleta documentos de mandatos nem usa o cofre privado. O segredo não integra o código ou o navegador.

## Validação executada

- Seis testes unitários: ausência vs zero, triagem, cenário com premissas, esquemas de URL, deduplicação de publicações, destaque ABMES, filtro temporal e caminhos SEC.
- SQL transacional executado no Supabase com rollback: acesso sem login, sem MFA, concorrência, preservação de histórico, evidência primária obrigatória nos estágios avançados, ação idempotente não validada, vínculo de curso, bloqueio institucional/comercial e outra IES. Fixtures sintéticas não permanecem no banco.
- TypeScript do pacote composto e compilação estática passaram.
- Coleta executada de ponta a ponta pelo agendamento interno e Edge Function, com registros persistidos. Horário diário cadastrado; recorrência futura ainda não observada.
- Verificação visual desktop/mobile e jornada com sessão real ainda pendentes. Chromium local não iniciou por restrição do ambiente. Build e testes de banco não substituem homologação visual.

## Próximas ampliações

Classificação assistida por IA e revisão editorial; conciliação automática com Censo/e-MEC com ano de referência; fontes configuráveis por IES; alertas personalizados; objetivos estratégicos estruturados e múltiplas ações por operação. Não constam como concluídos nesta versão. O atalho para o planejamento e a ação vinculada a meta já existem; não há alteração automática de plano publicado.
