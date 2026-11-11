export const demoCourses=[
 {id:'direito',name:'Direito',short:'DIR',students:360,capacity:500,coordinator:'Coordenação de Direito',shift:'Noturno'},
 {id:'administracao',name:'Administração',short:'ADM',students:180,capacity:320,coordinator:'Coordenação de Administração',shift:'Noturno'},
 {id:'pedagogia',name:'Pedagogia',short:'PED',students:210,capacity:300,coordinator:'Coordenação de Pedagogia',shift:'Matutino'},
 {id:'sistemas',name:'Sistemas de Informação',short:'SI',students:140,capacity:240,coordinator:'Coordenação de Sistemas',shift:'Noturno'},
 {id:'enfermagem',name:'Enfermagem',short:'ENF',students:260,capacity:300,coordinator:'Coordenação de Enfermagem',shift:'Integral'},
 {id:'contabeis',name:'Ciências Contábeis',short:'CC',students:150,capacity:280,coordinator:'Coordenação de Contábeis',shift:'Noturno'},
];
export type DemoInstitutionMode = 'faculdade' | 'centro' | 'universidade' | 'escola';
export const demoInstitutionProfiles: Record<DemoInstitutionMode, { name: string; short: string; subtitle: string; description: string; revenue: number; cost: number; depreciation: number; debt: number; cash: number }> = {
 escola: {name:'Escola Vértice',short:'EV',subtitle:'Escola privada · Fund. I/II e Médio · 620 alunos',description:'Gestão escolar inteligente: ENEM 360°, egressos, rematrícula, indicadores IDEB/SAEB, governança e documentos com IA.',revenue:4464000,cost:3800000,depreciation:120000,debt:400000,cash:250000},
 faculdade: {name:'Faculdade Vértice',short:'FV',subtitle:'Faculdade isolada · 6 cursos',description:'Gestão integrada de uma faculdade, com foco na consolidação da graduação, captação e reconhecimento de cursos.',revenue:12000000,cost:10800000,depreciation:200000,debt:1500000,cash:500000},
 centro: {name:'Centro Universitário Vértice',short:'CUV',subtitle:'Centro universitário · 12 cursos',description:'Estrutura institucional ampliada, múltiplas coordenações, governança da reitoria e indicadores comparativos.',revenue:30000000,cost:26100000,depreciation:700000,debt:4200000,cash:1800000},
 universidade: {name:'Universidade Vértice',short:'UV',subtitle:'Universidade multicampi · 18 cursos',description:'Visão estratégica de universidade com oferta multicampi fictícia, pós-graduação, pesquisa e comitês de gestão.',revenue:75000000,cost:66100000,depreciation:2100000,debt:14000000,cash:5200000},
};
export type DemoCourse = typeof demoCourses[number];
const additionalCourses: DemoCourse[] = [
 {id:'psicologia',name:'Psicologia',short:'PSI',students:290,capacity:420,coordinator:'Coordenação de Psicologia',shift:'Matutino'},
 {id:'engenharia',name:'Engenharia Civil',short:'EC',students:180,capacity:320,coordinator:'Coordenação de Engenharia',shift:'Noturno'},
 {id:'arquitetura',name:'Arquitetura e Urbanismo',short:'ARQ',students:200,capacity:280,coordinator:'Coordenação de Arquitetura',shift:'Integral'},
 {id:'biomedicina',name:'Biomedicina',short:'BIO',students:185,capacity:260,coordinator:'Coordenação de Biomedicina',shift:'Integral'},
 {id:'farmacia',name:'Farmácia',short:'FAR',students:240,capacity:340,coordinator:'Coordenação de Farmácia',shift:'Noturno'},
 {id:'fisioterapia',name:'Fisioterapia',short:'FIS',students:220,capacity:320,coordinator:'Coordenação de Fisioterapia',shift:'Matutino'},
 {id:'medicina-veterinaria',name:'Medicina Veterinária',short:'VET',students:350,capacity:480,coordinator:'Coordenação de Veterinária',shift:'Integral'},
 {id:'odontologia',name:'Odontologia',short:'ODO',students:310,capacity:400,coordinator:'Coordenação de Odontologia',shift:'Integral'},
 {id:'nutricao',name:'Nutrição',short:'NUT',students:205,capacity:320,coordinator:'Coordenação de Nutrição',shift:'Noturno'},
 {id:'letras',name:'Letras',short:'LET',students:180,capacity:240,coordinator:'Coordenação de Letras',shift:'Matutino'},
 {id:'computacao',name:'Ciência da Computação',short:'CIC',students:350,capacity:460,coordinator:'Coordenação de Computação',shift:'Noturno'},
 {id:'mestrado-educacao',name:'Mestrado em Educação',short:'MED',students:120,capacity:160,coordinator:'Coordenação da Pós-graduação',shift:'Integral'},
];
export function demoInstitutionCourses(mode: DemoInstitutionMode): DemoCourse[] {
 const scale = mode === 'faculdade' ? 1 : mode === 'centro' ? 1.25 : 1.8;
 const base = demoCourses.map(c => ({...c,students:Math.round(c.students*scale),capacity:Math.round(c.capacity*scale)}));
 if (mode==='faculdade') return base;
 const extra = additionalCourses.slice(0,mode==='centro'?6:12).map(c=>({...c,students:Math.round(c.students*(mode==='centro'?1:1.3)),capacity:Math.round(c.capacity*(mode==='centro'?1:1.3))}));
 return [...base,...extra];
}
export type EvidenceStatus='validated'|'review'|'pending'|'returned';
export type DemoEvidence={id:string;course:string;title:string;dimension:string;status:EvidenceStatus;owner:string;deadline:string;file:string;note:string};
const evidenceKinds=[['PPC e matriz curricular','Organização didático-pedagógica'],['Atas do NDE','Corpo docente e tutorial'],['Relatório da CPA e plano de melhoria','Organização didático-pedagógica'],['Quadro de titulação docente','Corpo docente e tutorial'],['Bibliografia e acervo','Infraestrutura'],['Laboratórios e acessibilidade','Infraestrutura']];
export const evidenceLabels:Record<EvidenceStatus,string>={validated:'Revisado no cenário',review:'Aguardando revisão',pending:'Sem documento',returned:'Devolvido para ajuste'};
export function initialDemoEvidence(courses: DemoCourse[]=demoCourses):DemoEvidence[]{return courses.flatMap((c,i)=>evidenceKinds.map(([title,dimension],j)=>{const status:EvidenceStatus=(['validated','validated','review','pending','returned','validated'] as EvidenceStatus[])[(j+i)%6];return {id:`${c.id}-${j}`,course:c.id,title,dimension,status,owner:c.coordinator,deadline:['2026-11-12','2026-11-18','2026-11-24'][j%3],file:status==='pending'?'':`${c.short}-${['PPC','NDE','CPA','DOCENTES','ACERVO','INFRA'][j]}-EXEMPLO.pdf`,note:status==='returned'?'A versão do documento não identifica o período de referência.':status==='pending'?'Falta vincular o documento ao item.':'Documento fictício disponível para explorar o fluxo.'};}));}
export function evidenceSummary(rows:DemoEvidence[]){return {total:rows.length,validated:rows.filter(r=>r.status==='validated').length,review:rows.filter(r=>r.status==='review').length,pending:rows.filter(r=>['pending','returned'].includes(r.status)).length};}
export function demoEconomics(revenue:number,cost:number,depreciation:number,multiple:number,debt:number,cash:number){const ebit=revenue-cost;const ebitda=ebit+depreciation;return {ebit,ebitda,margin:revenue?ebitda/revenue*100:0,enterprise:ebitda*multiple,equity:ebitda*multiple-debt+cash};}
export const ddFronts:Record<string,string>={REG:'Regulatória',QUA:'Qualidade e avaliação',ACA:'Acadêmica',FIN:'Financeira',TRIB:'Tributária',TRA:'Trabalhista',SOC:'Societária',IMO:'Imobiliária',CON:'Alunos e consumidor',DAD:'Dados e LGPD'};
export const defaultGoals=[
 {id:'ppc',title:'Revisar o PPC de Direito e registrar a deliberação do NDE',owner:'Coordenação de Direito',date:'2026-11-18',progress:40},
 {id:'evidencias',title:'Organizar as evidências para a revisão interna do curso',owner:'Procuradoria institucional',date:'2026-11-24',progress:55},
 {id:'acolhimento',title:'Executar o acompanhamento do ingresso e do início das aulas',owner:'Atendimento e coordenações',date:'2026-11-30',progress:25},
];
export type DemoGoal=typeof defaultGoals[number];
export function executiveDemoText(evidence:DemoEvidence[],goals:DemoGoal[],economics:ReturnType<typeof demoEconomics>,institutionName='Faculdade Vértice',courses:DemoCourse[]=demoCourses){const s=evidenceSummary(evidence);return `VÉRTICE EDUCAÇÃO SUPERIOR\nRELATÓRIO EXECUTIVO — CENÁRIO FICTÍCIO\n${institutionName} · Referência ilustrativa 2026/2\n\n1. VISÃO DA OPERAÇÃO\n${courses.length} cursos, ${courses.reduce((n,c)=>n+c.students,0)} matrículas e ${courses.reduce((n,c)=>n+c.capacity,0)} vagas no cenário.\n\n2. PREPARAÇÃO DOCUMENTAL\n${s.total} itens: ${s.validated} revisados no cenário; ${s.review} aguardam revisão; ${s.pending} sem documento ou devolvidos. A revisão simulada não constitui avaliação oficial.\n\n3. PENDÊNCIAS PARA A GESTÃO\n${evidence.filter(r=>r.status!=='validated').slice(0,8).map(r=>`${courses.find(c=>c.id===r.course)?.name} — ${r.title}: ${evidenceLabels[r.status]}. Responsável: ${r.owner}.`).join('\n')}\n\n4. PLANO DE AÇÃO\n${goals.map(g=>`${g.title} — ${g.progress}% no cenário. Responsável: ${g.owner}. Prazo: ${g.date}.`).join('\n')}\n\n5. CENÁRIO ECONÔMICO ILUSTRATIVO\nEBITDA: R$ ${economics.ebitda.toLocaleString('pt-BR')}. Margem: ${economics.margin.toFixed(1)}%. Os valores e múltiplos são hipóteses de simulação; não representam avaliação de empresa ou recomendação de preço.\n\n6. ENTREGAS PARA UM ESCOPO DE CONSULTORIA\nDiagnóstico com fontes e lacunas; matriz de evidências; plano com responsabilidades e prazos; reunião de acompanhamento e memória das decisões. Escopo a definir em contratação.\n\nTodos os dados desta experiência são fictícios. Não é relatório de cliente, parecer de aquisição ou avaliação do INEP/MEC.`;}
