const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function num(value,label,{min=-1e12,max=1e12}={}){
 if(value===''||value===null||value===undefined||typeof value==='boolean'||typeof value==='object')throw new Error(`Informe ${label}; use zero quando não houver valor.`);
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(`${label}: valor fora do intervalo aceito.`);return n;
}
export function calculateValuation(input,source){
 const text=(v,label)=>{if(typeof v!=='string'||v.trim().length<3||v.length>3000)throw new Error(`Informe ${label}.`);return v.trim();};
 const body={version:1,method:input.method,scope:text(input.scope,'a abrangência da avaliação'),assumptions:text(input.assumptions,'as premissas e fontes'),valuation_date:input.valuation_date,
  debt:num(input.debt,'a dívida financeira e os itens equivalentes',{min:0}),cash:num(input.cash,'o caixa excedente disponível',{min:0}),non_operating:num(input.non_operating,'os ativos não operacionais líquidos'),equity_adjustments:num(input.equity_adjustments,'os demais ajustes ao valor dos sócios')};
 if(typeof body.valuation_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.valuation_date)||Number.isNaN(Date.parse(body.valuation_date))||new Date(body.valuation_date).toISOString().slice(0,10)!==body.valuation_date)throw new Error('Informe uma data-base válida.');
 const warnings=['Estimativa gerencial baseada nas premissas informadas; não representa preço garantido ou laudo aprovado.','Dívida, caixa, contingências e ativos devem abranger a mesma entidade, data-base e base de arrendamentos.'];
 let enterprise;
 if(input.method==='multiple'){
  if(!source?.id||source.body?.basis!=='historical'||source.result?.period_months!==12)throw new Error('Selecione um EBITDA realizado de 12 meses, registrado com a DRE. Não há anualização automática.');
  body.multiple=num(input.multiple,'o múltiplo',{min:0.01,max:100});body.ebitda_adjustment=num(input.ebitda_adjustment,'o ajuste comprovado ao EBITDA');
  const base=num(source.result.ebitda,'o EBITDA registrado');body.source_id=source.id;body.source_ebitda=base;
  body.adjusted_ebitda=round(base+body.ebitda_adjustment);
  if(body.adjusted_ebitda<=0)throw new Error('Múltiplos de EBITDA exigem EBITDA ajustado positivo. Considere fluxo de caixa para este cenário.');
  enterprise=body.adjusted_ebitda*body.multiple;
  warnings.push('O múltiplo é uma premissa do responsável; o sistema não fornece benchmark de mercado.');
  if(source.body.lease_basis==='unknown')warnings.push('A base de arrendamentos da DRE está pendente de confirmação.');
 }else if(input.method==='dcf'){
  body.wacc=num(input.wacc,'a taxa de desconto anual (%)',{min:0.01,max:100})/100;
  body.growth=num(input.growth,'o crescimento perpétuo anual (%)',{min:-99,max:50})/100;
  if(body.wacc<=body.growth)throw new Error('A taxa de desconto deve superar o crescimento na perpetuidade.');
  if(!Array.isArray(input.cash_flows)||input.cash_flows.length!==5)throw new Error('Informe cinco fluxos anuais.');
  body.cash_flows=input.cash_flows.map((n,i)=>num(n,`o fluxo de caixa livre do ano ${i+1}`));
  if(body.cash_flows[4]<=0)throw new Error('O fluxo do quinto ano deve ser positivo para este modelo de perpetuidade.');
  body.present_flows=body.cash_flows.map((n,i)=>round(n/(1+body.wacc)**(i+1)));
  body.terminal_value=round(body.cash_flows[4]*(1+body.growth)/(body.wacc-body.growth));
  body.present_terminal=round(body.terminal_value/(1+body.wacc)**5);
  enterprise=body.present_flows.reduce((a,b)=>a+b,0)+body.present_terminal;
  warnings.push('Use fluxos de caixa livres da operação após tributos operacionais, investimentos e variação de capital de giro, antes do financiamento.','Projeções anuais ao final de cada período; taxa nominal e crescimento precisam estar na mesma moeda e base.');
 }else throw new Error('Selecione um método de avaliação.');
 const enterprise_value=round(enterprise),equity_value=round(enterprise_value-body.debt+body.cash+body.non_operating+body.equity_adjustments);
 if(!Number.isFinite(equity_value)||Math.abs(equity_value)>1e15)throw new Error('Resultado fora dos limites; reveja as premissas.');
 if(equity_value<0)warnings.push('O valor estimado para os sócios é negativo neste cenário.');
 return {body,result:{enterprise_value,equity_value,warnings,formula:'Valor da operação − dívida + caixa excedente + ativos não operacionais líquidos + demais ajustes'}};
}
