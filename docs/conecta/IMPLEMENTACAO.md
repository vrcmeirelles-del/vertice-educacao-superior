# Conecta 360° — implementação incremental
Data: 15/11/2026. Base: 905309f9004e8ee9e584da4c6707c221d69c07ac.

## Estado
Implementação inicial em branch de revisão. Não aplicada ao Supabase, não integrada à main e não publicada no Render nesta entrega.
O escopo integral do Prompt Mestre ainda não está concluído ou homologado.

## Entregue no código
- Área Conecta na navegação institucional, preservando repositório, serviços, Supabase e autenticação existentes.
- Vínculos explícitos a matrículas e formações de Egressos 360°, sem nova tabela de pessoas.
- Perfil profissional, interesses, competências, SWOT pessoal, objetivo e prazo.
- Currículo/portfólio PDF da versão salva.
- Oportunidades, estados de divulgação e acompanhamento de candidaturas.
- Preferências separadas por canal e finalidade, com origem registrada e auditoria.
- Configuração de marcos de acompanhamento, sem ativar filas ou disparos.
- Indicadores com numeradores, denominadores, fonte, data, ausência de base e respostas antigas.
- Ligações às metas existentes e criação de ações no 5W2H nativo, sem aprovações automáticas.
- Referências a documentos da Mesa Digital e consulta de estágios e AC vinculados à matrícula.
- Próximos pareceres de planejamento do Sapiens recebem snapshot agregado do Conecta, sem nomes. Pareceres antigos são preservados.
- Reutilização do componente de leituras do Fato & Ordem e acesso ao módulo de aprendizagem existente, sem alterar seu repositório.
- Acesso próprio de estudantes/egressos via sessão expirada/revogável e link de uso único já existentes; não aceita IDs de estudante fornecidos pelo cliente.
- Campos com exemplos, explicações, obrigatoriedade, ajuda contextual e CSS responsivo.

## Segurança
Dados em schema dedicado dentro do projeto institucional existente; RLS habilitada e sem privilégios diretos de tabela para navegador.
RPC de gestão exige MFA e vínculo validado; coordenação/NDE restritos ao curso; CPA recebe apenas agregado.
RPC de autoatendimento exclusiva do service role, derivando identidade da sessão no banco.
Controle de versão para perfil, oportunidades e configuração; operações idempotentes e auditoria.
Nenhum dado sintético gravado em produção. Nenhuma mensagem enviada nesta implementação.

## Verificação executada
- 13 testes PostgreSQL/PGlite aprovados: permissões, MFA, isolamento, vínculos idempotentes, validação de perfil/URLs, versão, preferências, documentos, oportunidades/candidaturas, metas/5W2H, política, CPA, snapshot Sapiens e sessão pessoal.
- 16 testes de interface/navegação aprovados (6 novos e 10 de navegação existente).
- TypeScript sem diagnósticos na composição do pacote-base com os overrides atuais.
- build:static aprovado, incluindo prerender.
- Conferência visual desktop/mobile em navegador: pendente. O navegador disponibilizado recusou a prévia local; não há screenshot de homologação.
- Testes ponta a ponta com usuários reais e provedores externos: pendentes.
Os testes locais usam fixtures de dependências acadêmicas; não substituem homologação no ambiente publicado.

## Implantação preparada
1. Revisar a PR e a migração explícita supabase/migrations/20261115213753_conecta_360_native.sql. Não executar db push indiscriminado.
2. Aplicar a migração no Supabase institucional qvetbbmviatxxatzzuzc.
3. Publicar a alteração da função existente vertice-student-portal preservando verify_jwt=false e seus controles internos; nenhum novo serviço é necessário.
4. Integrar a branch no repositório canônico. Os serviços Render existentes têm deploy automático.
5. Homologar gestão, coordenação, CPA e autoatendimento com usuários autorizados, visual desktop/mobile e regressões de AC/Estágio.
6. Registrar evidências antes de marcar como comprovadamente funcional.

Gestão: Master → instituição → Módulos Acadêmicos → Conecta 360°.
Autoatendimento preparado: /acesso-estudante?ies=<institution_id>&mod=conecta.
Egressos sem registro nominal e contato verificável dependem de conciliação institucional; não são conciliados por nome/e-mail.

## Pendências do Prompt Mestre
- Conciliação assistida estudante–egresso quando as duas bases representam a mesma matrícula; o vínculo acadêmico é a unidade de contagem desta versão, não pessoas únicas.
- Questionários contextuais, respostas em rascunho, coortes e motor de pesquisas por marcos.
- Aplicação efetiva de limites/autorizações às filas existentes de WhatsApp e e-mail e seus recibos; nenhum parâmetro registrado é apresentado como fila ativa.
- Integração de indicações e conversões com GROWTH/CRM e intervenções com KEEP.
- Comunidade de mentoria, empresas/empregadores e seus perfis, convênios e avaliações.
- Portfólio automático completo de TCC, extensão e certificações: apenas evidências referenciadas e consultas de estágio/AC nesta etapa.
- Observatório de mercado regional, conectores autorizados e pesquisa externa com fontes.
- Mapeamento regulatório por versão/ato e indicador aplicável, sem declaração de conformidade.
- Entrevista de carreira pela IA, recomendações individuais e revisão por dois modelos, além do snapshot agregado e motor de planejamento reutilizado.
- Aprovação e gravação de medições oficiais nas metas, rastreabilidade dos resultados e evidências de eficácia; a versão atual não substitui medições aprovadas.
- Homologação ponta a ponta, acessibilidade completa e revisão visual do ambiente publicado.

Esta entrega é um núcleo incremental implementado e testado localmente, não a conclusão dos 21 blocos do Prompt Mestre.
