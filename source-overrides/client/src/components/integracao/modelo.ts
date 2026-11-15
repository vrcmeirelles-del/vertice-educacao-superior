export const estados=['Implementado','Integrado','Comprovadamente funcional','Demonstrativo','Não confirmado','Bloqueado','Homologação humana'] as const;
export const escopos=['Aluno sintético','Turma sintética','Curso sintético','IES sintética'] as const;
export type Evidence={id:string;data:string;modulo:string;estado:string;branchOrigem:string;branchDestino:string;ambiente:string;url:string;origem:string;entidade:string;testes:string;evidencia:string;falha:string;causa:string;correcao:string;autenticacao:string;autorizacao:string;manual:string;revisor:string};
export type Decision={id:string;data:string;tipo:string;escopo:string;versao:string;procedimento:string;reversao:string;responsavel:string;referencia:string;estado:string};
export type Review={id:string;data:string;meta:string;anterior:string;proposta:string;motivo:string;indicador:string;fonte:string;responsavel:string;prazo:string};
export type Package={schemaVersion:1;registros:Evidence[];decisoes:Decision[];revisoes:Review[];checks:string[]};
export const emptyPackage=():Package=>({schemaVersion:1,registros:[],decisoes:[],revisoes:[],checks:[]});
export const evidenceKeys=['id','data','modulo','estado','branchOrigem','branchDestino','ambiente','url','origem','entidade','testes','evidencia','falha','causa','correcao','autenticacao','autorizacao','manual','revisor'];
const decisionKeys=['id','data','tipo','escopo','versao','procedimento','reversao','responsavel','referencia','estado'];
const reviewKeys=['id','data','meta','anterior','proposta','motivo','indicador','fonte','responsavel','prazo'];
export function safeReference(value:string){if(!value)return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password&&['github.com','dashboard.render.com'].includes(u.hostname);}catch{return false;}}
export function metadataOnly(value:string){return !/(?:\b\d{3}[. -]?\d{3}[. -]?\d{3}[- ]?\d{2}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:bearer\s+\S+|sk-proj-\S+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)|(?:token|api_key|password|senha|secret)\s*[:=]\s*\S+)/i.test(value);}
function strings(row:unknown,keys:string[]){if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Registro inválido.');const r=row as Record<string,unknown>;if(Object.keys(r).some(k=>!keys.includes(k))||keys.some(k=>typeof r[k]!=='string'||(r[k] as string).length>2000))throw Error('Campos ausentes, desconhecidos ou acima do limite.');if(!Number.isFinite(Date.parse(r.data as string)))throw Error('Data inválida.');if(!metadataOnly(Object.values(r).join(' ')))throw Error('Conteúdo potencialmente pessoal ou credencial recusado.');}
export function validatePackage(raw:unknown):Package{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Pacote inválido.');const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1||Object.keys(r).some(k=>!['schemaVersion','registros','decisoes','revisoes','checks'].includes(k)))throw Error('Formato não reconhecido.');
 for(const k of ['registros','decisoes','revisoes','checks'])if(!Array.isArray(r[k])||(r[k] as unknown[]).length>500)throw Error('Lista inválida ou acima de 500 registros.');
 for(const v of r.registros as Evidence[]){strings(v,evidenceKeys);if(!estados.includes(v.estado as typeof estados[number])||!safeReference(v.url))throw Error('Estado ou URL recusados.');if(['Integrado','Comprovadamente funcional'].includes(v.estado)&&(!v.testes.trim()||!v.evidencia.trim()||!v.entidade.trim()||!v.revisor.trim()||!v.branchOrigem.trim()||!v.branchDestino.trim()))throw Error('Estado declarado exige versões, vínculo, teste, evidência e revisor.');}
 for(const v of r.decisoes as Decision[]){strings(v,decisionKeys);if(!['Proposta','Em revisão','Aguardando aprovação','Aprovação declarada','Recusada'].includes(v.estado))throw Error('Estado de decisão inválido.');if(v.estado==='Aprovação declarada'&&(!v.referencia.trim()||!v.versao.trim()||!v.responsavel.trim()||!v.procedimento.trim()||!v.reversao.trim()))throw Error('Aprovação declarada exige referência, versão, responsável, procedimento e reversão.');}
 for(const v of r.revisoes as Review[])strings(v,reviewKeys);
 for(const v of r.checks as unknown[])if(typeof v!=='string'||!/^((dev|hom|prod)-\d+)$/.test(v))throw Error('Checklist inválido.');
 const ids=[...(r.registros as Evidence[]),...(r.decisoes as Decision[]),...(r.revisoes as Review[])].map(v=>v.id);if(new Set(ids).size!==ids.length)throw Error('Identificadores duplicados.');
 return structuredClone(raw) as Package;
}
export function overdue(date:string,now=Date.now()){const t=Date.parse(date);return Number.isFinite(t)&&now-t>7*86400000;}
export const checkpoints={
 dev:['Identificar commits de origem e destino, contrato e responsável.','Conferir vínculo recíproco de IES, curso e matrícula, sem nomes como chave.','Validar esquema, escala da nota, competência, calendário e proveniência.','Testar evento repetido, fora de ordem, reprocessamento e revogação.','Usar somente identidades sintéticas no ambiente fictício.','Anexar teste de autorização, MFA e isolamento entre IES.'],
 hom:['Fixar versão candidata e procedimento autorizado antes do teste.','Conciliar aluno/vínculo, tentativa, resultado e indicador nas duas plataformas.','Conferir negativas de acesso e revogação do vínculo.','Validar nulos, não corrigidos, anuladas, denominador e período.','Reproduzir falha, testar correção e anexar evidência sanitizada.','Obter revisão humana por módulo e aprovação institucional do resultado.'],
 prod:['Aprovação explícita vinculada à versão, ação, ambiente e responsável.','Conferir escopo de acesso sem copiar credenciais.','Revisar backup, reversão e janela com o operador autorizado.','Aprovar separadamente merge, migração, banco, convite, configuração e publicação.','Confirmar implantação e conciliação com fontes autorizadas após execução.','Registrar monitoramento, prazo de revalidação e incidente sem dados restritos.']
};
