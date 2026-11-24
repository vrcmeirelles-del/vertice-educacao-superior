# Roteiro de homologação — candidato 1.0-rc.1

Estado inicial: nenhuma regra nova autorizada, nenhuma migração aplicada. Não executar os procedimentos de escrita em produção sem autorização específica.

| Etapa | Evidência exigida | Estado nesta entrega |
|---|---|---|
| Inventário | Catálogo e comparação com cron, workers e eventos reais | Catálogo local pronto; reconciliação atual pendente |
| Adaptadores | Contratos nativos, proveniência e amostras anonimizadas | Pendente |
| Segurança | PostgreSQL descartável, RLS, MFA, revogação e escopo cruzado | Pendente |
| Transações | Concorrência, deduplicação entre execuções, atomicidade e replay | Pendente |
| Interface | Build, testes de navegação e segregação Master/IES | Pendente |
| Sombra | Comparação com fontes, taxa de alertas falsos e amostras insuficientes | Pendente |
| Custos | Orçamento aprovado e medição de CPU, consultas, armazenamento e tráfego | Pendente |
| Reversão | Exercício em ambiente isolado e auditoria preservada | Pendente |
| Aceite | Aprovação independente e autorização explícita para cada escopo | Pendente |

## Sequência recomendada ao desenvolvedor
1. Fixar commit do repositório oficial, identificar contratos e reconciliar com as nove rotinas observadas em 24/11/2026 (não assumir que continuam ativas). Não duplicar jobs; medir também workers externos e automações por evento.
2. Integrar código por branch de desenvolvimento. Mapear 40 regras individualmente, inclusive CPA, PEI e Escolas. Corrigir a persistência candidata e implementar RPCs nativas antes de qualquer escrita. Rodar suíte completa e build.
3. Validar em banco descartável com identidades sintéticas; testar RLS, concorrência e falhas parciais. Nenhuma credencial de produção no pacote.
4. Executar sombra somente após aprovação do ambiente, sem mensagens, notas, intervenções ou alterações de dados acadêmicos. Medir volume, erros e custo. Revisar casos de ausência de dados.
5. Registrar evidências por regra, versão, IES e curso. Revisão independente. Elegibilidade não autoriza implantação. Solicitar autorização expressa para operações concretas, incluindo orçamento e reversão.
6. Após autorização específica, liberar piloto de escopo mínimo, sem ações irreversíveis automáticas; conferir recibos reais de destino. Expandir somente após aceite.

## Reversão proposta (não executada)
Suspender apenas o novo agendamento ou configuração afetada, preservar os nove jobs preexistentes e o histórico, impedir novas intenções e verificar filas em trânsito. Não apagar decisões nem reverter notas automaticamente. Reconciliar entregas já confirmadas com responsáveis e registrar incidente. Validar restauração do código anterior em homologação, mantendo compatibilidade dos registros. Não fazer rollback destrutivo de schema. O mecanismo operacional de suspensão e reversão ainda precisa ser implementado e testado.

## Testes locais
`node --test test/*.test.mjs` — 334 testes aprovados. O gate recebe registros confiáveis simulados; não comprova veracidade de referências. Não há integração com produção nesta entrega.
