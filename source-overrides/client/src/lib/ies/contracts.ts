import { z } from "zod";
export const uuid = z.string().uuid();
export const roles = [
  "master_ies",
  "reitor",
  "diretor_geral",
  "pro_reitor_graduacao",
  "diretor_pedagogico",
  "procurador_institucional",
  "presidente_cpa",
  "coordenador",
  "nde",
] as const;
export type Role = (typeof roles)[number];
export const roleNames: Record<Role, string> = {
  master_ies: "Master da IES",
  reitor: "Reitor(a)",
  diretor_geral: "Diretor(a) geral",
  pro_reitor_graduacao: "Pró-reitoria de graduação",
  diretor_pedagogico: "Diretor(a) pedagógico(a)",
  procurador_institucional: "Procurador(a) institucional",
  presidente_cpa: "Presidente da CPA",
  coordenador: "Coordenador(a) de curso",
  nde: "Membro do NDE",
};
export const highManagement: readonly Role[] = [
  "reitor",
  "diretor_geral",
  "pro_reitor_graduacao",
];
const role = z.enum(roles),
  capacity = z.enum(["principal", "adjunto", "membro"]);
export const institutionSchema = z.object({
  institution_id: uuid,
  name: z.string(),
  emec_code: z.string(),
  status: z.enum(["pending_review", "reviewed", "rejected"]),
  provenance: z.literal("manual_unverified"),
});
export type Institution = z.infer<typeof institutionSchema>;
export const detailSchema = institutionSchema.extend({
  public_institution_id: uuid.nullable(),
  source_reference: z.string().nullable(),
  revision: z.number().int().positive(),
});
export type Detail = z.infer<typeof detailSchema>;
export const preferencesSchema = z.object({
  optional_news_email: z.boolean(),
  optional_news_whatsapp: z.boolean(),
  optional_learning_email: z.boolean(),
  optional_learning_whatsapp: z.boolean(),
  notice_version: z.string().optional(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const assignmentSchema = z.object({
  id: uuid,
  institution_id: uuid,
  role,
  course_id: uuid.nullable(),
  capacity,
});
export const contextSchema = z.object({
  assignments: z.array(assignmentSchema),
  preferences: preferencesSchema,
  document_adapter_ready: z.literal(false),
});
export type Context = z.infer<typeof contextSchema>;
export const noticeSchema = z.object({
  version: z.string().min(1),
  kind: z.enum(["communications", "double_check"]),
  body: z.string().min(1),
});
export type Notice = z.infer<typeof noticeSchema>;
export const courseSchema = z.object({
  course_id: uuid,
  name: z.string(),
  code: z.string().nullable(),
});
export type Course = z.infer<typeof courseSchema>;
export const invitationSchema = z.object({
  invitation_id: uuid,
  recipient_email: z.string(),
  role,
  course_id: uuid.nullable(),
  capacity,
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  issued_at: z.string(),
  expires_at: z.string(),
});
export type Invitation = z.infer<typeof invitationSchema>;
export const previewSchema = z.object({
  invitation_id: uuid,
  institution_id: uuid,
  institution_name: z.string(),
  emec_code: z.string(),
  role,
  course_id: uuid.nullable(),
  course_name: z.string().nullable(),
  capacity,
  expires_at: z.string(),
  document_adapter_ready: z.literal(false),
});
export type Preview = z.infer<typeof previewSchema>;
export const policySchema = z.object({
  required: z.boolean(),
  revision: z.number().int().nonnegative(),
  effective_revision: z.number().int().nonnegative(),
  effective_course_id: uuid.nullable(),
  notice_version: z.string().nullable(),
  document_adapter_ready: z.literal(false),
});
export type Policy = z.infer<typeof policySchema>;
export function allowedRoles(
  context: Context,
  institutionId: string,
  global: boolean,
): Role[] {
  if (global) return [...roles];
  const own = context.assignments
    .filter((a) => a.institution_id === institutionId)
    .map((a) => a.role);
  if (own.includes("master_ies"))
    return roles.filter((r) => r !== "master_ies");
  if (own.some((r) => highManagement.includes(r)))
    return roles.filter(
      (r) => r !== "master_ies" && !highManagement.includes(r),
    );
  return [];
}
