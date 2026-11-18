import { BookOpen, BriefcaseBusiness, Building2, ChartColumn, ClipboardCheck, FileText, FolderOpen, GraduationCap, Handshake, Layers3, LayoutGrid, Network, Settings, ShieldCheck, Target, UsersRound, Wallet, type LucideIcon } from 'lucide-react';

/** Somente apresentação; as rotas e autorizações continuam no Workspace. */
const icons: Record<string, LucideIcon> = {
  'atividades-ensino': GraduationCap, 'programas-pdi': Target, tcc: BookOpen,
  extensao: Handshake, estagio: BriefcaseBusiness, 'atividades-complementares': ClipboardCheck,
  conecta: Network, egressos: UsersRound, 'cpa-autoavaliacao': ClipboardCheck,
  'construcao-curricular': Layers3, 'trilhas-enade': GraduationCap, enade: GraduationCap,
  discursiva: FileText, inclusao: UsersRound, 'acompanhamento-especial': UsersRound,
  'planejamento-estrategico': Target, 'planejamento-semestral': ClipboardCheck,
  metas: Target, plano: ClipboardCheck, diagnostico: ChartColumn, governanca: ShieldCheck,
  cadastro: GraduationCap, emec: Building2, repositorio: FolderOpen, documentos: FolderOpen,
  biblioteca: BookOpen, validacao: ShieldCheck, avaliacao: ClipboardCheck,
  novo_instrumento: ClipboardCheck, equipe: UsersRound, aprendizagem: GraduationCap,
  'integracao-ies': Network, sync: Network, fontes: Network, conexoes: Network,
  billing: Wallet, conta: Wallet, contrato: FileText, modulos: Layers3, catalogo: BookOpen,
  aquisicoes: BriefcaseBusiness, mercado: ChartColumn, reitor: ChartColumn,
  base: Building2, 'gestao-escolar': Building2, ia: Settings,
};
const categories: Record<string, string> = {
  academico: 'Gestão acadêmica', gestores: 'Gestão institucional', cursos: 'Cursos e desempenho',
  dados: 'Dados institucionais', integracoes: 'Dados e integrações', licenciamento: 'Gestão e licenciamento',
  historico: 'Evidências e regulação', 'visao-geral': 'Visão institucional',
};
export function portalModulePresentation(tab: string, macro: string) {
  return {
    icon: icons[tab] ?? (tab.startsWith('escola-') ? GraduationCap : LayoutGrid),
    eyebrow: categories[macro] ?? 'Gestão institucional',
    description: tab === 'atividades-ensino'
      ? 'Registre atividades da graduação e da pós-graduação, com participantes, carga horária e evidências.'
      : undefined,
  };
}
