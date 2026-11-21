import {
  buildPlanningSources,
  checkPlanning,
  type Finding,
} from "./interpretation.ts";
// Sapiens · planejamento por regras (sem IA): o parecer é o conjunto de verificações determinísticas
// calculadas sobre o recorte (interpretation.ts), com catálogo de fontes exatas e hash do snapshot.
export function rulePlanning(checks: Finding[]) {
  const by = (k: string, v: string) => checks.filter((c) => (c as any)[k] === v).length;
  const ranked = [...checks].sort((a, b) => ["alta", "média", "baixa"].indexOf(a.priority) - ["alta", "média", "baixa"].indexOf(b.priority));
  return {
    schema_version: 2,
    summary: checks.length
      ? `Verificações do recorte: ${checks.length} achado(s) — ${by("type", "lacuna")} lacuna(s), ${by("type", "fato")} fato(s) e ${by("type", "tendência")} tendência(s); prioridade alta: ${by("priority", "alta")}. Relatório por regras, sem interpretação por IA.`
      : "Nenhuma inconsistência ou lacuna encontrada pelas verificações do recorte. Relatório por regras, sem interpretação por IA.",
    findings: [] as Finding[],
    recommendations: ranked.filter((c) => c.priority !== "baixa").slice(0, 8).map((c) => ({
      priority: c.priority,
      action: c.type === "lacuna" ? `Completar ou justificar o registro ausente: ${c.text}` : `Analisar e definir encaminhamento: ${c.text}`,
      owner_role: c.audience === "coordenacao" ? "coordenação do curso" : c.audience === "direcao" ? "direção" : "alta gestão",
      timeframe: "até o próximo ciclo de acompanhamento",
      success_indicator: "Achado resolvido ou justificado na próxima análise do recorte",
      rationale: "Verificação calculada sobre os registros citados.",
      finding_ids: [c.id],
    })),
    limitations: [
      "Relatório gerado por regras: lista as verificações calculadas sobre o recorte, sem leitura interpretativa nem causalidade.",
      "Ausência de registro não equivale a zero; contagens não comprovam execução nem alcance de meta.",
    ],
  };
}

export async function analyzePlanning(
  user: any,
  admin: any,
  institutionId: string,
  body: any,
) {
  const { data: job, error } = await user.rpc("vertice_sapiens_planning", {
    p_institution_id: institutionId,
    p_action: "start",
    p_payload: {
      course_id: body.courseId || null,
      semester: body.semester || null,
    },
  });
  if (error)
    return {
      status: error.code === "42501" ? 403 : 400,
      body: { error: error.message },
    };
  try {
    const context = JSON.stringify(job.context);
    const sources = buildPlanningSources(job.context),
      checks = checkPlanning(job.context);
    if (
      new TextEncoder().encode(context).length > 180000 ||
      new TextEncoder().encode(JSON.stringify({ sources, checks })).length >
        65000
    )
      throw new Error("context_too_large");
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(context),
        ),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const result = {
      ...rulePlanning(checks),
      checks,
      sources,
      reference_date: job.context.reference_date,
      audience: job.context.audience,
      traceability:
        "Verificações calculadas por regras sobre o snapshot; cada achado cita registros exatos. Exige revisão humana.",
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 95000)
      throw new Error("context_too_large");
    const review = {
      available: false,
      notes:
        "Relatório por regras, a partir das verificações calculadas no recorte, sem interpretação por IA. Exige revisão humana.",
      issues: [],
      recommendation: "reject_for_human_review",
    };
    const { data: stored, error: saveError } = await admin
      .from("vertice_sapiens_planning_analyses")
      .update({
        status: "pending_review",
        result,
        review,
        generator_model: "regras",
        reviewer_model: null,
        input_hash: hash,
      })
      .eq("id", job.id)
      .eq("status", "generating")
      .select("id,status")
      .single();
    if (saveError || !stored) throw new Error("save_failed");
    return {
      status: 200,
      body: { ok: true, id: stored.id, status: stored.status },
    };
  } catch (e) {
    await admin
      .from("vertice_sapiens_planning_analyses")
      .update({ status: "failed" })
      .eq("id", job.id)
      .eq("status", "generating");
    const code = e instanceof Error ? e.message : "";
    return {
      status: 502,
      body: {
        error:
          code === "context_too_large"
            ? "Recorte muito extenso. Selecione um curso."
            : "Não foi possível concluir o parecer pelo Sapiens. Tente novamente.",
      },
    };
  }
}
