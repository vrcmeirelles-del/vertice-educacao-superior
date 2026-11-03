import { z } from "zod";
import {
  contextSchema,
  institutionSchema,
  detailSchema,
  noticeSchema,
  previewSchema,
  courseSchema,
  invitationSchema,
  policySchema,
  uuid,
  type Role,
  type Preferences,
} from "./contracts";
export class IesError extends Error {
  constructor(public kind: string) {
    super(kind);
  }
}
export const messages: Record<string, string> = {
  feature_disabled:
    "O cadastro e os convites institucionais estão temporariamente desativados. Novas operações estão bloqueadas; escritas já confirmadas permanecem registradas.",
  verified_session_required:
    "Confirme seu e-mail e o segundo fator de uma conta previamente ativada para continuar.",
  access_denied: "Sua conta não tem autorização para esta ação neste escopo.",
  high_management_required:
    "Esta decisão exige uma atribuição de alta gestão nesta instituição.",
  scope_unavailable:
    "Esta instituição não está disponível no seu escopo atual.",
  registration_conflict:
    "Já existe um cadastro com esses dados. Consulte a lista antes de cadastrar novamente.",
  stale_registration:
    "O cadastro mudou desde a revisão. Reabra os dados antes de decidir.",
  stale_policy:
    "A política mudou. Consulte a versão atual antes de decidir novamente.",
  invitation_unavailable:
    "Convite indisponível, expirado ou incompatível com a conta conectada.",
  invitation_cooldown:
    "Aguarde cinco minutos antes de gerar outro convite para este destinatário.",
  invitation_conflict:
    "Já existe um convite pendente para este perfil e escopo. Revogue-o antes de gerar outro.",
  assignment_conflict:
    "Este vínculo já existe. O convite não substituiu o perfil atual.",
  invalid_registration:
    "Confira o nome da instituição, o código e-MEC e o tamanho da referência informada.",
  valid_emec_required: "O cadastro exige um código e-MEC válido.",
  invalid_invitation:
    "Confira o e-mail, o perfil, a composição e o curso selecionado.",
  invalid_scope:
    "O curso selecionado não pertence a esta instituição ou não está disponível.",
  invalid_search: "Confira o termo de busca antes de tentar novamente.",
  invalid_page:
    "Não foi possível consultar esta página. Volte à lista inicial.",
  review_unavailable:
    "Este cadastro não está mais disponível para revisão. Atualize a lista.",
  registration_unavailable: "O cadastro solicitado não está disponível.",
  reopen_unavailable:
    "Somente uma instituição existente com revisão recusada pode ser reaberta.",
  notice_required:
    "Consulte o aviso de comunicação vigente antes de salvar suas preferências.",
  risk_notice_required:
    "Consulte o aviso vigente e confirme conscientemente o risco para este escopo.",
  document_integration_blocked: "A integração documental está indisponível.",
  invalid_response:
    "O servidor retornou dados inesperados. A operação não foi confirmada.",
  request_failed:
    "Não foi possível confirmar a operação. Confira os dados atualizados antes de tentar novamente.",
  busy: "Aguarde a conclusão da operação atual.",
};
export function errorMessage(error: unknown) {
  return error instanceof IesError
    ? (messages[error.kind] ??
        "Não foi possível concluir esta ação. Atualize os dados e revise o escopo.")
    : messages.request_failed;
}
type RpcTransport = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
// One lifetime per signed-in user and mounted IES view. No query cache or token persistence.
export class IesApi {
  private alive = true;
  private writing = false;
  private writingListeners = new Set<(writing: boolean) => void>();
  get isWriting() {
    return this.writing;
  }
  onWriting(listener: (writing: boolean) => void) {
    this.writingListeners.add(listener);
    listener(this.writing);
    return () => {
      this.writingListeners.delete(listener);
    };
  }
  private disabled = false;
  registrationReceipt: {
    id: string;
    revision: number | null;
    kind: "registered" | "reopened";
  } | null = null;
  private disabledListeners = new Set<() => void>();
  onDisabled(listener: () => void) {
    this.disabledListeners.add(listener);
    if (this.disabled) listener();
    return () => {
      this.disabledListeners.delete(listener);
    };
  }
  constructor(private rpc: RpcTransport) {}
  dispose() {
    this.alive = false;
    this.disabledListeners.clear();
    this.writingListeners.forEach((listener) => listener(false));
    this.writingListeners.clear();
    this.registrationReceipt = null;
  }
  async call<T>(
    name: string,
    args: Record<string, unknown>,
    schema: z.ZodType<T>,
    write = false,
  ): Promise<T> {
    if (!this.alive) throw new IesError("cancelled");
    if (this.disabled) throw new IesError("feature_disabled");
    if (write && this.writing) throw new IesError("busy");
    if (write) {
      this.writing = true;
      this.writingListeners.forEach((listener) => listener(true));
    }
    try {
      const result = await this.rpc(name, args);
      if (!this.alive) throw new IesError("cancelled");
      if (result.error?.message === "feature_disabled") {
        this.disabled = true;
        this.disabledListeners.forEach((listener) => listener());
      }
      if (result.error)
        throw new IesError(
          Object.hasOwn(messages, result.error.message)
            ? result.error.message
            : "request_failed",
        );
      const parsed = schema.safeParse(result.data);
      if (!parsed.success) throw new IesError("invalid_response");
      return parsed.data;
    } catch (e) {
      if (e instanceof IesError) throw e;
      throw new IesError("request_failed");
    } finally {
      if (write) {
        this.writing = false;
        this.writingListeners.forEach((listener) => listener(false));
      }
    }
  }
  context() {
    return this.call("vertice_ies_my_context", {}, contextSchema);
  }
  institutions(after: string | null = null) {
    return this.call(
      "vertice_ies_list_institutions",
      { p_after: after, p_limit: 20 },
      z.array(institutionSchema),
    );
  }
  notices() {
    return this.call("vertice_ies_notices", {}, z.array(noticeSchema));
  }
  detail(id: string) {
    return this.call(
      "vertice_ies_registration_detail",
      { p_ies: id },
      detailSchema,
    );
  }
  register(name: string, emec: string, source: string) {
    return this.call(
      "vertice_ies_register",
      { p_name: name, p_emec_code: emec, p_source_reference: source || null },
      uuid,
      true,
    ).then((id) => {
      this.registrationReceipt = { id, revision: null, kind: "registered" };
      return id;
    });
  }
  review(id: string, approve: boolean, revision: number) {
    return this.call(
      "vertice_ies_review_registration",
      { p_ies: id, p_approve: approve, p_expected_revision: revision },
      z.null(),
      true,
    );
  }
  reopen(id: string, revision: number) {
    return this.call(
      "vertice_ies_reopen_registration",
      { p_ies: id, p_expected_revision: revision },
      z.number().int().positive(),
      true,
    ).then((revision) => {
      this.registrationReceipt = { id, revision, kind: "reopened" };
      return revision;
    });
  }
  courses(id: string, query = "") {
    return this.call(
      "vertice_ies_list_courses",
      { p_ies: id, p_query: query, p_limit: 100 },
      z.array(courseSchema),
    );
  }
  invites(id: string, after: string | null = null) {
    return this.call(
      "vertice_ies_list_invites",
      { p_ies: id, p_after: after, p_limit: 20 },
      z.array(invitationSchema),
    );
  }
  issue(
    id: string,
    email: string,
    role: Role,
    course: string | null,
    capacity: string,
    hash: string,
  ) {
    return this.call(
      "vertice_ies_issue_invite",
      {
        p_ies: id,
        p_email: email,
        p_role: role,
        p_course: course,
        p_capacity: capacity,
        p_token_hash: hash,
      },
      z
        .array(z.object({ invitation_id: uuid, expires_at: z.string() }))
        .length(1),
      true,
    );
  }
  revoke(id: string) {
    return this.call(
      "vertice_ies_revoke_invite",
      { p_invitation: id },
      z.null(),
      true,
    );
  }
  preview(token: string) {
    return this.call(
      "vertice_ies_preview_invite",
      { p_token: token },
      previewSchema,
    );
  }
  accept(token: string) {
    return this.call(
      "vertice_ies_accept_invite",
      { p_token: token },
      uuid,
      true,
    );
  }
  preferences(p: Preferences, version: string) {
    return this.call(
      "vertice_ies_set_preferences",
      {
        p_optional_news_email: p.optional_news_email,
        p_optional_news_whatsapp: p.optional_news_whatsapp,
        p_optional_learning_email: p.optional_learning_email,
        p_optional_learning_whatsapp: p.optional_learning_whatsapp,
        p_notice_version: version,
      },
      z.null(),
      true,
    );
  }
  policy(id: string, course: string | null) {
    return this.call(
      "vertice_ies_get_review_policy",
      { p_ies: id, p_course: course },
      policySchema,
    );
  }
  setPolicy(
    id: string,
    course: string | null,
    required: boolean,
    version: string,
    ack: boolean,
    revision: number,
  ) {
    return this.call(
      "vertice_ies_set_review_policy",
      {
        p_ies: id,
        p_course: course,
        p_required: required,
        p_notice_version: version,
        p_acknowledged: ack,
        p_expected_revision: revision,
      },
      z.number().int().positive(),
      true,
    );
  }
}
