// Shared deterministic engine: browser preview and authoritative server calculation.
export const ebitdaFields=[
 ['net_income','Lucro ou prejuízo líquido','Resultado final da DRE. Prejuízo deve ser negativo.',true],
 ['income_tax','IRPJ e CSLL no resultado','Somente tributos sobre o lucro registrados na DRE. Benefício fiscal contábil pode ser negativo; não acrescente todos os impostos.',true],
 ['financial_expenses','Despesas financeiras','Juros e outras despesas financeiras reconhecidas na DRE. Não inclua amortização do principal de empréstimos.'],
 ['financial_income','Receitas financeiras','Rendimentos e outras receitas financeiras da DRE. Este valor será subtraído.'],
 ['depreciation','Depreciação','Despesa do período, inclusive a registrada nos custos. Não informe o valor de compra dos bens.'],
 ['amortization','Amortização de intangíveis','Despesa contábil de softwares e outros intangíveis. Não é pagamento de parcelas de empréstimos.'],
 ['depletion','Exaustão, se houver','Normalmente zero em uma IES; informe zero quando não existir.'],
 ['net_revenue','Receita líquida do mesmo período','Valor da DRE após deduções. Usado para a margem EBITDA; não é o saldo recebido no banco.']
];
export const educationGroups=[
 {title:'Receitas brutas reconhecidas',keys:[['undergraduate','Mensalidades de graduação'],['postgraduate','Pós-graduação'],['extension','Extensão e cursos livres'],['other_revenue','Outras receitas de serviços']]},
 {title:'Deduções da receita',keys:[['scholarships','Bolsas e descontos já tratados como dedução'],['cancellations','Cancelamentos e devoluções reconhecidos'],['revenue_taxes','Tributos sobre a receita']]},
 {title:'Custos e despesas do período, sem depreciação e amortização',keys:[['faculty','Docentes: salários, encargos e benefícios'],['staff','Técnicos e administrativos: salários, encargos e benefícios'],['teaching','Biblioteca, laboratórios e materiais acadêmicos'],['technology','Sistemas, plataformas e tecnologia'],['occupancy','Ocupação: aluguéis reconhecidos como despesa, condomínio e manutenção'],['utilities','Energia, água, internet, limpeza e segurança'],['marketing','Captação de alunos, marketing e comissões'],['bad_debt','Perdas e provisões de recebíveis reconhecidas na DRE'],['other_costs','Outros custos e despesas sem duplicar os anteriores']]}
];
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function amount(v,label,signed=false){if(v===''||v===null||v===undefined)throw new Error('Informe '+label+'; use zero quando não houver valor.');if(typeof v==='boolean'||typeof v==='object')throw new Error(label+' inválido.');const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>1e12||(!signed&&n<0)||Math.abs(n*100-Math.round(n*100))>0.001)throw new Error(label+': informe valor válido em reais, com até duas casas decimais.');return round(n);}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw new Error('Informe datas válidas para o período.');return v;}
const words=(v,label,min=3)=>{const s=String(v??'').trim();if(s.length<min||s.length>3000)throw new Error('Preencha '+label+'.');return s;};
export function normalizeEbitda(p){
 const b={version:1,start:date(p.start),end:date(p.end),scope:words(p.scope,'a instituição/unidade abrangida'),basis:p.basis,lease_basis:p.lease_basis,education_enabled:p.education_enabled===true,education:{},evidence_document_id:String(p.evidence_document_id||''),evidence_location:words(p.evidence_location,'a página ou aba da DRE'),note:String(p.note||'').trim().slice(0,3000)};
 if(b.end<b.start)throw new Error('O fim do período deve ser igual ou posterior ao início.');
 if(!['historical','projection'].includes(b.basis))throw new Error('Indique se os números são realizados ou projetados.');
 if(!['expense','ifrs16','unknown'].includes(b.lease_basis))throw new Error('Informe como os aluguéis foram contabilizados.');
 for(const [key,label,,signed] of ebitdaFields)b[key]=amount(p[key],label,signed);
 b.average_students=p.average_students===''||p.average_students===undefined||p.average_students===null?null:amount(p.average_students,'média de alunos ativos');
 if(b.average_students!==null&&b.average_students<=0)throw new Error('A média de alunos ativos deve ser maior que zero.');
 if(b.education_enabled){for(const group of educationGroups)for(const [key,label] of group.keys)b.education[key]=amount(p.education?.[key],label);b.education.other_result=amount(p.education?.other_result,'outros resultados positivos ou negativos',true);b.education.reconciliation=words(p.education?.reconciliation,'a explicação de abrangência, rateios e conciliação',15);}
 return b;
}
export function calculateEbitda(b){
 const ebitda=round(b.net_income+b.income_tax+b.financial_expenses-b.financial_income+b.depreciation+b.amortization+b.depletion);
 const start=new Date(b.start+'T00:00:00Z'),end=new Date(b.end+'T00:00:00Z'),whole=start.getUTCDate()===1&&end.getUTCDate()===new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
 const months=whole?(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1:null;
 const warnings=[];
 if(months!==12)warnings.push('Período diferente de 12 meses completos. Não há anualização automática; compare períodos equivalentes.');
 if(b.basis==='projection')warnings.push('Projeção: resultado previsto, sem confirmação de realização.');
 if(b.lease_basis==='unknown')warnings.push('Tratamento dos aluguéis não confirmado: verificar comparabilidade antes de usar múltiplos.');
 if(b.lease_basis==='ifrs16')warnings.push('Arrendamentos no modelo CPC 06/IFRS 16: depreciação e juros podem elevar o EBITDA comparado ao aluguel como despesa. Compare a mesma base e confira a dívida de arrendamento; não deduza parcelas automaticamente.');
 if(b.net_revenue<=0)warnings.push('Receita líquida nula: margem EBITDA não calculável.');
 if(ebitda<=0)warnings.push('EBITDA nulo ou negativo: não gera faixa de valor por múltiplos positivos de EBITDA.');
 let education=null;
 if(b.education_enabled){const e=b.education,sum=keys=>round(keys.reduce((s,k)=>s+e[k],0)),gross=sum(educationGroups[0].keys.map(k=>k[0])),deductions=sum(educationGroups[1].keys.map(k=>k[0])),costs=sum(educationGroups[2].keys.map(k=>k[0])),net=round(gross-deductions),operating=round(net-costs+e.other_result),difference=round(operating-ebitda),revenueDifference=round(net-b.net_revenue);education={gross_revenue:gross,deductions,net_revenue:net,costs,other_result:e.other_result,ebitda:operating,difference,revenue_difference:revenueDifference,reconciled:Math.abs(difference)<0.01&&Math.abs(revenueDifference)<0.01,payroll_percent:net>0?round((e.faculty+e.staff)/net*100):null,discount_percent:gross>0?round(e.scholarships/gross*100):null,bad_debt_percent:net>0?round(e.bad_debt/net*100):null};if(!education.reconciled)warnings.push('O detalhamento da IES não fecha com a DRE. Confira deduções, perdas, rateios e outros resultados; o EBITDA pela DRE permanece separado.');}
 return {ebitda,margin_percent:b.net_revenue>0?round(ebitda/b.net_revenue*100):null,period_months:months,education,revenue_per_student_month:b.average_students&&months?round(b.net_revenue/b.average_students/months):null,ebitda_per_student_month:b.average_students&&months?round(ebitda/b.average_students/months):null,warnings,formula:'Lucro/prejuízo líquido + IRPJ/CSLL + despesas financeiras − receitas financeiras + depreciação + amortização + exaustão',notice:'EBITDA não é caixa disponível, lucro líquido nem preço de venda. Ajustes extraordinários devem ser apresentados separadamente e comprovados. Nenhuma leitura automática da DRE foi realizada.'};
}
export function ebitdaText(c){if(!c)return '';const b=c.body,r=c.result,m=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);return ['MEMÓRIA DO EBITDA — CONCILIAÇÃO PELA DRE','Abrangência: '+b.scope,'Período: '+b.start+' a '+b.end+'; natureza: '+b.basis,...ebitdaFields.map(([key,label])=>label+': '+m(b[key])),'EBITDA: '+m(r.ebitda),'Margem sobre receita líquida: '+(r.margin_percent===null?'Não calculável':r.margin_percent+'%'),r.formula,'DRE: '+(c.evidence?.file_name||b.evidence_document_id)+'; '+b.evidence_location+'; SHA256 '+(c.evidence?.sha256||'Não disponível'),...(r.education?['Detalhamento gerencial da IES: '+m(r.education.ebitda)+'; diferença para a DRE: '+m(r.education.difference)+'; diferença de receita líquida: '+m(r.education.revenue_difference),'Conciliação e rateios: '+b.education.reconciliation,...educationGroups.flatMap(g=>g.keys.map(([k,l])=>l+': '+m(b.education[k]))),'Outros resultados: '+m(b.education.other_result)]:[]),...r.warnings.map(w=>'ATENÇÃO: '+w),'Observações: '+b.note,r.notice].join('\n');}
