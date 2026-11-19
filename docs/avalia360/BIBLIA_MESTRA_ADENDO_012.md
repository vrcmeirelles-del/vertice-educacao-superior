# BÍBLIA-MESTRA — VÉRTICE AVALIA 360°
## Adendo cumulativo 012 — Persistência versionada: contrato e ciclo de vida de rascunhos
**Data:** 2026-11-19 · **PR #207** em rascunho · **Estado:** código de domínio escrito, não há salvamento efetivo.

### Preservação da Bíblia-Mestra
Mantidos integralmente os adendos 001–011: motor determinístico curricular/longitudinal, validação de fonte e escopo, temas, competências, imagens, formulário docente, correção futura e integração estratégica.

### O que foi desenvolvido
- `source-overrides/client/src/lib/avalia360/draft-lifecycle.ts`: modelo independente de domínio para rascunhos e versões, sem acesso ao banco.
- `source-overrides/client/src/lib/avalia360/draft-lifecycle.spec.ts`: dez cenários de teste criados, ainda pendente execução do commit correspondente.
- Estados: draft → submitted → validated; reopen volta a draft mediante nova revisão; archived encerra alterações.
- Revisão numérica obrigatória com `expectedRevision` para impedir sobrescrita silenciosa em edições concorrentes.
- Relacionamento imutável entre IES, curso, matriz/versionamento curricular, disciplina e autor.
- Mídias devem ser previamente validadas antes de submeter a prova à homologação.
- Cada alteração produz evento de domínio com autor e números das versões anterior e nova; gravação imutável do evento deverá ser realizada pelo backend futuro.

### Limites obrigatórios
1. `DraftCommand.role`, `authorizedCourseId` e `curriculumReady` são contratos que **somente o backend confiável deve preencher a partir da sessão/BD**. Parâmetros recebidos do navegador não constituem autenticação ou autorização.
2. Este módulo apenas calcula transições. **Não salva no Supabase, não envia arquivo, não publica, não valida um PPC real**.
3. A função de transição é imutável em memória, mas isso não garante transação/concorrência no banco; usar atualização SQL condicional por versão e registrar evento na mesma transação.
4. O fluxo de homologação tem de ser compatibilizado com a política pedagógica da IES antes da produção. Uma rubrica discursiva ainda não possui pontuação estruturada.
5. A SQL anterior é proposta documental; não aplicar até teste isolado de esquema, RLS e perfis.

### Próxima ação de integração
Criar gateway de rascunho com MFA/AAL2, vinculação a matrícula docente e curso, isolamento institucional, escrita transacional e trilha de auditoria. Criar armazenamento privado para imagens com upload autorizado, validação de MIME/binário e SHA-256. Conectar o formulário e executar testes de ponta a ponta com dados sintéticos.

### Evidências anteriores preservadas
GitHub Actions #44632882097: 36/36 testes unitários aprovados.
GitHub Actions #44633144872: Vitest e TypeScript isolado aprovados.
A nova suíte adicionada neste adendo exige **nova execução**; não extrapolar aprovação anterior.

### Aceite
- [x] Contrato de versionamento e eventos escrito na branch.
- [x] Dez testes de domínio escritos.
- [ ] Execução dos novos testes confirmada.
- [ ] Persistência efetiva e transacional.
- [ ] Gateway autorizado e testes multi-IES/curso.
- [ ] Armazenamento de imagens e edição posterior preservados.
- [ ] Interface e homologação operacional.
