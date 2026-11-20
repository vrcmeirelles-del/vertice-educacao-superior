# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 030 — Padrão de resposta esperado nas questões discursivas
**Data:** 20/11/2026 | **Escopo:** PR #207, prévia isolada, sem alteração de dados de produção.

### Requisito
Incluir em cada questão discursiva um campo `Padrão de resposta esperado`, distinto da rubrica de correção, para apoiar a futura avaliação algorítmica estruturada, o feedback e o aproveitamento longitudinal.

### Alterações implementadas
- `question-draft.ts`: `expectedAnswer?:string` na estrutura da questão, obrigatório na validação de uma discursiva completa, não aplicável a objetivo.
- `Avalia360Studio.tsx`: textarea **Padrão de resposta esperado** para questões discursivas, com aviso de referência privada que não será impressa na prova do aluno; `checkDraft` indica ausência.
- `QuestionDraftEditor.tsx`: mesmo campo no formulário de autoria de questões separado.
- `draft-api.ts`: serialização de `expectedAnswer` para o snapshot da questão discursiva, separada da rubrica e da pontuação.
- `question-bank.ts`: questões discursivas armazenadas no banco local demonstrativo exigem o padrão esperado; cópias reutilizadas preservam-no independentemente.
- `rule-curation.ts`: alerta determinístico `MISSING_EXPECTED_ANSWER`; não apresenta parecer semântico nem inventa respostas jurídicas.
- `individualized-pdf.ts`: impede emissão de discursiva sem o padrão esperado, mas omite a resposta-modelo e a rubrica do documento entregue ao estudante.
- Testes específicos de validação, banco, snapshot, curadoria e emissão de PDF adicionados à suíte.

### Limites
- O padrão é conteúdo autoral do docente, não produzido automaticamente pelo algoritmo, e deve ser revisado antes de uso.
- Sua existência não garante mérito jurídico, fidelidade ao PPC, equivalência semântica ou correção automática das respostas manuscritas.
- A correção futura poderá estruturar critérios de correspondência e evidências com revisão humana, após definição do algoritmo e testes.
- Na prévia, banco de questões e rascunhos ficam no armazenamento local do navegador; o banco institucional exige autenticação, MFA, RLS e homologação.
- O conteúdo modelo não deve aparecer em PDF de prova discente nem nos tokens QR.
- **A PR permanece em desenvolvimento e não foi incorporada ao portal oficial.**

### Próximos testes
- [ ] Verificar interface do campo em questão discursiva na prévia publicada.
- [ ] Validar persistência e reutilização no mesmo navegador.
- [ ] Testar com questão fictícia e confirmar omissão da resposta esperada no PDF.
- [ ] Homologar endpoints privados e papéis institucionais antes de conectar a dados reais.

Preservar integralmente os adendos 001–029.
