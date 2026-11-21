/**
 * Avalia 360° — interpretação da análise de itens (Teoria Clássica dos Testes).
 * Regras explícitas e versionadas, sem IA. Os números vêm do servidor
 * (vertice_avalia_item_analysis); aqui só se aplicam faixas de leitura.
 * Referências das faixas: Ebel (1965) para discriminação; faixas usuais de
 * facilidade e de consistência interna. O NDE pode revisar os limiares.
 */
export const ANALYSIS_RULES = {
 version: '2026.11-1',
 minSample: 10,          // abaixo disso, sem recomendação por item
 smallSample: 30,        // entre 10 e 29: interpretar com cautela
 nonFunctionalShare: 0.05, // alternativa errada escolhida por menos de 5%
 omissionShare: 0.2,     // mais de 20% em branco
} as const;

export interface OptionStat {optionId:string;correct:boolean;n:number;nUpper:number;nLower:number}
export interface ItemStat {
 questionId:string;order:number;kind:'objetiva'|'discursiva';statement:string;points:number;
 declaredDifficulty:number|null;sourceBankId:string|null;correctOptionId:string|null;
 n:number|null;p:number|null;pUpper:number|null;pLower:number|null;discrimination:number|null;pointBiserial:number|null;
 blanks:number|null;multiples:number|null;options:OptionStat[]|null;
}
export interface AnalysisResult {
 applicationId:string;classLabel:string;appliedOn:string;status:'open'|'closed';
 sheets:number;complete:number;groupSize:number;meanScore:number|null;sdScore:number|null;maxScore:number;
 alpha:number|null;scoreDistribution:Array<{bin:number;count:number}>;items:ItemStat[];
}
export type Recommendation='manter'|'revisar'|'revisar_gabarito'|'amostra_insuficiente'|'sem_dados';
export interface ItemReading {
 facility:string;observedLevel:1|2|3|4|5|null;discrimination:string;flags:string[];
 recommendation:Recommendation;distractors:Array<{optionId:string;flag:'nao_funciona'|'atrai_melhores'|null}>;
}

export function facilityLabel(p:number|null):string{
 if(p===null)return '—';
 if(p>=0.9)return 'muito fácil';if(p>=0.7)return 'fácil';if(p>=0.3)return 'média';if(p>=0.15)return 'difícil';return 'muito difícil';
}
/** Mesma escala do campo "Dificuldade estimada" (1 = muito fácil … 5 = muito difícil). */
export function observedLevel(p:number|null):1|2|3|4|5|null{
 if(p===null)return null;
 if(p>=0.9)return 1;if(p>=0.7)return 2;if(p>=0.3)return 3;if(p>=0.15)return 4;return 5;
}
export function discriminationLabel(d:number|null):string{
 if(d===null)return '—';
 if(d>=0.4)return 'muito boa';if(d>=0.3)return 'boa';if(d>=0.2)return 'marginal';return 'fraca';
}
export function reliabilityLabel(alpha:number|null):string{
 if(alpha===null)return 'não calculável';
 if(alpha>=0.8)return 'boa';if(alpha>=0.7)return 'aceitável';if(alpha>=0.6)return 'questionável';return 'baixa';
}
export function sampleLabel(n:number):string{
 if(n<ANALYSIS_RULES.minSample)return 'insuficiente: indicadores não interpretáveis';
 if(n<ANALYSIS_RULES.smallSample)return 'pequena: interprete com cautela';
 return 'adequada';
}

export function readItem(item:ItemStat,complete:number):ItemReading{
 const flags:string[]=[];
 const distractors:ItemReading['distractors']=[];
 if(item.n===null||item.p===null)return {facility:'—',observedLevel:null,discrimination:'—',flags,recommendation:'sem_dados',distractors};
 const level=observedLevel(item.p);
 let review=false,key=false;
 if(item.pointBiserial!==null&&item.pointBiserial<0){flags.push('Correlação negativa com o restante da prova: verifique o gabarito.');key=true;}
 else if(item.pointBiserial!==null&&item.pointBiserial<0.2){flags.push('Baixa correlação com o restante da prova.');review=true;}
 if(item.discrimination!==null&&item.discrimination<0.2){flags.push('Discriminação fraca: não separa quem domina de quem não domina.');review=true;}
 if(item.p>=0.9){flags.push('Quase todos acertaram: pouca informação sobre a turma.');review=true;}
 if(item.p<0.15){flags.push('Quase ninguém acertou: conteúdo não trabalhado, enunciado confuso ou gabarito incorreto.');review=true;}
 if(item.declaredDifficulty&&level&&Math.abs(item.declaredDifficulty-level)>=2)
  flags.push('Dificuldade declarada (nível '+item.declaredDifficulty+') distante da observada (nível '+level+').');
 if(item.blanks&&item.n&&item.blanks/item.n>ANALYSIS_RULES.omissionShare)flags.push('Muitas respostas em branco.');
 if(item.kind==='objetiva'&&item.options){
  const correct=item.options.find(o=>o.correct);
  for(const o of item.options.filter(x=>!x.correct)){
   let flag:'nao_funciona'|'atrai_melhores'|null=null;
   if(correct&&o.nUpper>0&&(o.nUpper>o.nLower||o.nUpper>correct.nUpper))flag='atrai_melhores';
   else if(o.n/item.n<ANALYSIS_RULES.nonFunctionalShare)flag='nao_funciona';
   distractors.push({optionId:o.optionId,flag});
  }
  if(distractors.some(d=>d.flag==='atrai_melhores')){
   flags.push('Alternativa errada atrai o grupo de maior desempenho: possível ambiguidade ou segunda resposta defensável.');
   if(correct&&item.options.some(o=>!o.correct&&o.nUpper>correct.nUpper))key=true;else review=true;
  }
  const dead=distractors.filter(d=>d.flag==='nao_funciona').map(d=>d.optionId);
  if(dead.length)flags.push('Alternativa(s) '+dead.join(', ')+' quase não escolhida(s): não funcionam como distratores.');
 }
 const recommendation:Recommendation=complete<ANALYSIS_RULES.minSample?'amostra_insuficiente':key?'revisar_gabarito':review?'revisar':'manter';
 return {facility:facilityLabel(item.p),observedLevel:level,discrimination:discriminationLabel(item.discrimination),flags,recommendation,distractors};
}
export const recommendationLabel:Record<Recommendation,string>={
 manter:'Manter',revisar:'Revisar a questão',revisar_gabarito:'Verificar gabarito',
 amostra_insuficiente:'Amostra insuficiente',sem_dados:'Sem dados',
};
