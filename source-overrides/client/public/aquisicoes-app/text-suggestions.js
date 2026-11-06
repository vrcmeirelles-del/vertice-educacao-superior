/** Sugestões controladas em formulários de aquisições, sem alteração de nomenclatura das APIs.
 * Somente escolha explícita transfere texto; opção "Outro" preserva edição livre.
 * Nunca sugere CNPJ, nomes de instituições, valores de risco, datas ou pareceres favoráveis.
 */
export const acquisitionSuggestions={
 title:["Plano de diligência documental","Providência regulatória pendente de comprovação","Conferência de informações acadêmicas","Tratamento de achado de due diligence"],
 scope:["Revisão documental com delimitação de fontes, períodos, premissas e pendências.","Análise acadêmico-regulatória limitada às informações compartilhadas no mandato."],
 description:["Descrever o achado, os documentos examinados, o período de referência e as limitações da análise.","Registrar a divergência identificada e indicar os documentos necessários para confirmar a situação."],
 consequence:["Potencial impacto regulatório a ser dimensionado após conferência das evidências.","Possível consequência financeira e operacional, sujeita a avaliação técnica e documental."],
 note:["Pendente de conferência documental e validação por responsável habilitado.","Identificar evidência examinada, data, divergência e providência recomendada."],
 answer:["Informação não comprovada pelos documentos examinados até esta etapa.","A documentação apresentada requer análise adicional, com identificação da versão e da fonte."],
 how:["Conferir fonte, período e documento, registrar achado e acompanhar a ação corretiva."],
 conclusion:["Parecer preliminar: não constitui aprovação de aquisição nem substitui due diligence completa.","Conclusão condicionada à análise documental, verificação dos riscos e validação dos responsáveis."],
 declaration:["Informação sujeita à conferência com documentos e validação da equipe.","Não há evidência suficiente para confirmar esta declaração na etapa atual."],
 justification:["A informação apresentada ainda depende de documento comprobatório.","A providência proposta requer revisão de risco e confirmação da fonte."],
 comment:["Conferir versão, data, responsável e integridade do documento citado.","Solicitar evidência complementar antes da conclusão da análise."],
 location:["Identificar documento, página ou aba em que a informação pode ser conferida."],
 rationale:["A situação identificada demanda conferência da documentação e verificação do impacto."],
 risk:["Risco potencial ainda não quantificado. Submeter a análise técnica e documental."],
 evidence:["Documento: [nome/versão]. Página ou aba: [informar]. Responsável pela conferência: [identificar]."]
};
export function decorateAcquisitionForm(container=document){
 const known=new Set(Object.keys(acquisitionSuggestions));
 container.querySelectorAll("form textarea, form input").forEach(input=>{
  const name=(input.dataset.field||input.getAttribute("name")||"").replace(/^field_/,"").toLowerCase();
  if(!known.has(name)||input.dataset.suggestionsAttached==="1"||["hidden","checkbox","radio","file","date","number"].includes(input.type)||input.disabled)return;
  input.dataset.suggestionsAttached="1";
  const values=acquisitionSuggestions[name];
  if(!values?.length)return;
  const select=document.createElement("select");
  select.className="acq-suggestion-select";
  select.setAttribute("aria-label","Sugestões para "+name);
  select.innerHTML='<option value="">Sugestões para preenchimento — escolher</option>'+values.map((text,i)=>'<option value="'+i+'">'+text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</option>').join('')+'<option value="outro">Outro — escrever livremente</option>';
  const other=document.createElement("textarea");
  other.rows=3;other.hidden=true;other.placeholder="Digite sua redação personalizada";
  other.setAttribute("aria-label","Outro — texto personalizado");
  other.className="acq-suggestion-other";
  other.addEventListener("input",()=>{
   input.value=other.value;input.dispatchEvent(new Event("input",{bubbles:true}));
  });
  select.addEventListener("change",()=>{
   const custom=select.value==="outro";
   other.hidden=!custom;
   if(select.value==="")return;
   input.value=custom?"":values[Number(select.value)]??input.value;
   input.dispatchEvent(new Event("input",{bubbles:true}));
   if(custom){other.value="";other.focus();}else input.focus();
  });
  const info=document.createElement("small");
  info.className="acq-suggestion-note";
  info.textContent="Rascunho sugerido. Revise a situação real e a fonte antes de salvar.";
  input.insertAdjacentElement("afterend",info);
  input.insertAdjacentElement("afterend",select);
  select.insertAdjacentElement("afterend",other);
 });
}
