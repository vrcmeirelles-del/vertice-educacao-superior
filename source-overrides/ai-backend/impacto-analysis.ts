/**
 * Impacto Analysis Engine — Orquestrador de análises de IA
 *
 * Responsável por:
 * 1. Receber solicitação de análise (documental, estrutural, projeto, etc.)
 * 2. Registrar na tabela vertice_ai_analyses
 * 3. Processar via document-parsers existente
 * 4. Classificar achados com tipos e confiança
 * 5. Registrar achados com referências de fonte
 *
 * [Não verificado] Este módulo usa a infraestrutura de IA já existente
 * (vertice-ai-review). O processamento de embeddings (RAG/pgvector)
 * será adicionado quando a decisão arquitetural for tomada.
 *
 * Restrição: IA restrita à alta gestão conforme
 * supabase/access/restrict_document_ai_to_senior_management.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Tipos
// ============================================================

export type AnalysisType = 'documental' | 'estrutural' | 'projeto' | 'evidencia' | 'curricularizacao' | 'cruzamento' | 'conformidade';

export interface AnalysisRequest {
  institutionId: string;
  analysisType: AnalysisType;
  projectId?: string;
  courseId?: string;
  documentIds?: string[];
  requestedBy: string;
  modelOverride?: string;
}

export interface FindingInput {
  findingType: 'informacao_comprovada' | 'informacao_parcial' | 'inferencia_ia' | 'informacao_nao_localizada' | 'pendente_validacao' | 'inconsistencia' | 'lacuna' | 'recomendacao';
  title: string;
  description: string;
  confidence: number; // 0.0 a 1.0
  conformityStatus?: 'conforme' | 'parcialmente_conforme' | 'nao_conforme' | 'nao_identificado' | 'nao_aplicavel' | 'aguardando_validacao';
  justification?: string;
  severity: 'critico' | 'alto' | 'medio' | 'baixo' | 'informativo';
  recommendation?: string;
  sources?: {
    documentName: string;
    documentVersion?: string;
    documentId?: string;
    pageNumber?: number;
    sectionTitle?: string;
    textExcerpt?: string; // max 500 chars
  }[];
}

// ============================================================
// Orquestrador
// ============================================================

export async function createAnalysis(
  supabase: SupabaseClient,
  request: AnalysisRequest,
): Promise<{ analysisId: string } | { error: string }> {
  // Verificar permissão (alta gestão apenas)
  const { data: role } = await supabase.rpc('vertice_private.has_impacto_role', {
    p_institution_id: request.institutionId,
    p_role: 'master',
  });

  // Fallback: verificar outros papéis senior
  if (!role) {
    const { data: seniorRoles } = await supabase
      .from('vertice_impacto_roles')
      .select('role')
      .eq('institution_id', request.institutionId)
      .eq('user_id', request.requestedBy)
      .eq('active', true)
      .in('role', ['master', 'reitor', 'pro_reitoria'])
      .limit(1);

    if (!seniorRoles || seniorRoles.length === 0) {
      return { error: 'Acesso restrito à alta gestão (master, reitor, pró-reitoria).' };
    }
  }

  // Criar registro da análise
  const { data: analysis, error } = await supabase
    .from('vertice_ai_analyses')
    .insert({
      institution_id: request.institutionId,
      analysis_type: request.analysisType,
      project_id: request.projectId || null,
      course_id: request.courseId || null,
      document_ids: request.documentIds || [],
      model_used: request.modelOverride || 'claude-sonnet-4-20250514',
      status: 'pendente',
      requested_by: request.requestedBy,
    })
    .select('id')
    .single();

  if (error || !analysis) {
    return { error: `Erro ao criar análise: ${error?.message || 'desconhecido'}` };
  }

  return { analysisId: analysis.id };
}

export async function recordFindings(
  supabase: SupabaseClient,
  analysisId: string,
  institutionId: string,
  findings: FindingInput[],
): Promise<{ count: number } | { error: string }> {
  let count = 0;

  for (const finding of findings) {
    // Inserir achado
    const { data: findingRecord, error: findingError } = await supabase
      .from('vertice_ai_findings')
      .insert({
        analysis_id: analysisId,
        institution_id: institutionId,
        finding_type: finding.findingType,
        title: finding.title,
        description: finding.description,
        confidence: finding.confidence,
        conformity_status: finding.conformityStatus || null,
        justification: finding.justification || null,
        severity: finding.severity,
        recommendation: finding.recommendation || null,
      })
      .select('id')
      .single();

    if (findingError || !findingRecord) continue;

    // Inserir referências de fonte
    if (finding.sources && finding.sources.length > 0) {
      const refs = finding.sources.map(s => ({
        finding_id: findingRecord.id,
        document_name: s.documentName,
        document_version: s.documentVersion || null,
        document_id: s.documentId || null,
        page_number: s.pageNumber || null,
        section_title: s.sectionTitle || null,
        text_excerpt: s.textExcerpt?.slice(0, 500) || null,
      }));

      await supabase.from('vertice_ai_source_references').insert(refs);
    }

    count++;
  }

  // Atualizar análise
  await supabase.from('vertice_ai_analyses').update({
    findings_count: count,
    status: 'concluida',
    completed_at: new Date().toISOString(),
  }).eq('id', analysisId);

  return { count };
}

export async function markAnalysisFailed(
  supabase: SupabaseClient,
  analysisId: string,
  reason: string,
): Promise<void> {
  await supabase.from('vertice_ai_analyses').update({
    status: 'falha',
    completed_at: new Date().toISOString(),
    validation_notes: reason,
  }).eq('id', analysisId);
}

// ============================================================
// Análise de projeto (sem embeddings — regras estáticas)
// ============================================================

export function analyzeProjectCompleteness(project: Record<string, any>): FindingInput[] {
  const findings: FindingInput[] = [];

  // Campos obrigatórios do Impacto
  const requiredFields: [string, string][] = [
    ['social_problem', 'Problema social não identificado'],
    ['general_objective', 'Objetivo geral não definido'],
    ['methodology', 'Metodologia não descrita'],
    ['target_community', 'Comunidade atendida não identificada'],
    ['beneficiary_profile', 'Perfil do público beneficiário ausente'],
  ];

  for (const [field, message] of requiredFields) {
    if (!project[field] || String(project[field]).trim().length < 10) {
      findings.push({
        findingType: 'lacuna',
        title: message,
        description: `O campo "${field}" está vazio ou insuficiente (menos de 10 caracteres). Este é um campo obrigatório para projetos de extensão conforme as DCNs.`,
        confidence: 1.0,
        severity: 'alto',
        recommendation: `Preencher o campo com informações detalhadas antes de submeter para aprovação.`,
      });
    }
  }

  // Verificar objetivos específicos
  if (!project.specific_objectives || project.specific_objectives.length === 0) {
    findings.push({
      findingType: 'lacuna',
      title: 'Objetivos específicos ausentes',
      description: 'O projeto não possui objetivos específicos definidos.',
      confidence: 1.0,
      severity: 'medio',
      recommendation: 'Definir ao menos 2 objetivos específicos mensuráveis.',
    });
  }

  // Verificar carga horária
  if (!project.total_hours || project.total_hours < 1) {
    findings.push({
      findingType: 'inconsistencia',
      title: 'Carga horária não definida',
      description: 'O projeto não possui carga horária total estimada.',
      confidence: 1.0,
      severity: 'critico',
      recommendation: 'Definir a carga horária conforme o PPC do curso.',
    });
  }

  // Verificar datas
  if (!project.start_date || !project.end_date) {
    findings.push({
      findingType: 'lacuna',
      title: 'Período de execução não definido',
      description: 'O projeto não possui datas de início e/ou término.',
      confidence: 1.0,
      severity: 'medio',
      recommendation: 'Definir o período de execução com datas concretas.',
    });
  }

  // Se tudo preenchido, registrar conformidade
  if (findings.length === 0) {
    findings.push({
      findingType: 'informacao_comprovada',
      title: 'Projeto com campos obrigatórios preenchidos',
      description: 'Todos os campos obrigatórios do módulo Impacto estão preenchidos.',
      confidence: 1.0,
      conformityStatus: 'conforme',
      severity: 'informativo',
    });
  }

  return findings;
}
