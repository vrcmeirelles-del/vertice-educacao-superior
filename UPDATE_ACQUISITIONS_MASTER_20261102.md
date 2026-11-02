# Correção do modelo aprovado — 02/11/2026

O módulo simplificado foi substituído pela aplicação verde original, na rota
`https://www.verticesuperior.com.br/master/aquisicoes`. O acesso usa a sessão
e o segundo fator do master. A divulgação pública continua em `/aquisicoes`
e no destaque da página inicial.

## Fidelidade ao original

O CSS e a calculadora EBITDA são cópias integrais dos arquivos aprovados em
`web/`. A adaptação do JavaScript limita-se à sessão compartilhada, transporte,
URLs do cofre, vínculo institucional e abertura de equipe separada. As dez abas,
305 requisitos, 32 modelos Word, tabelas CSV, conferência das evidências,
cruzamentos entre frentes, eventos e providências, EBITDA, preço, pareceres e
aprovação permanecem no fluxo original. O motor de análise e os cálculos são
os originais, executados na função `vertice-aquisicoes-green`.

## Preservação

- Dois mandatos locais incorporados, sem substituir o mandato anterior do portal.
- 610 respostas locais, 24 documentos e 341 vínculos contextuais.
- 341 conferências documentais, 305 revisões, 17 eventos e uma avaliação econômica.
- Dois pareceres preservados como versões originais; não se criaram aprovações.
- 1.338 registros de histórico preservados com identificador de origem.
- Hashes de base, contexto econômico e textos dos pareceres comparados entre o
  original e o Supabase, inclusive a indicação de versão atual ou desatualizada.
- O mandato anterior e suas 305 respostas conferidos contra o backup privado.

A cópia local continua intacta. Hash SHA-256 do snapshot original:
`8173c0c42d5ddfca32eefb3503f8c7257217b5e0e2de2d0936d68fb0ab867918`.
O ambiente local não é um espelho sincronizado: novas alterações devem ocorrer
no portal. Uma edição posterior feita apenas no local exige migração adicional.

## Acesso e arquivos

As tabelas têm isolamento por instituição e mandato. O master não recebe leitura
automática de mandatos de outra equipe. A parede de atuação mantém a proibição
de participação com acesso aos dois lados. A função valida login e segundo fator
antes das operações e executa as leituras sob as permissões do participante.

Evidências: `vertice-aquisicoes-cofre`; modelos: `vertice-aquisicoes-modelos`.
Ambos são privados, sem acesso direto do navegador. Downloads de evidências usam
URLs de 300 segundos. Não há credencial administrativa em arquivos públicos.
A autorização temporária da migração é encerrada após a conferência; as rotas
temporárias são removidas da função final.

## Validação

Passaram os testes completos de evidência/revisão/parecer, aprovação e alteração
da base, avaliação de preço e EBITDA com DRE. Passaram os testes de equivalência
do motor, isolamento do schema e dez abas do modelo no modo portal. O transporte
usa Authorization sem cookies entre domínios. A build do portal e a checagem
TypeScript passaram, preservando as melhorias concorrentes do site.

O hash assegura integridade, não autenticidade jurídica nem análise antivírus.
Os pareceres continuam dependendo de análise e aprovação do responsável.
