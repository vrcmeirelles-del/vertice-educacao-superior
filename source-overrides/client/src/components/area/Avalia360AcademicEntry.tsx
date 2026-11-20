/** Acesso independente ao Estúdio Avalia 360° durante a homologação.
 * A versão demonstrativa é isolada do login e dos dados da Vértice.
 * NÃO embutir credenciais, tokens ou listas reais de alunos.
 */
const PREVIEW_URL='https://vertice-avalia360-homolog.onrender.com';
export default function Avalia360AcademicEntry(){
 return <section aria-label="Avalia 360° — módulo Acadêmico" style={{background:'#F6F9FD',borderRadius:16,padding:20,color:'#173b66'}}>
  <div style={{background:'#fff',border:'1px solid #dce7f4',borderRadius:16,padding:20}}>
   <p style={{fontSize:12,fontWeight:800,letterSpacing:1,color:'#164b92',margin:'0 0 7px'}}>MÓDULOS ACADÊMICOS · VÉRTICE</p>
   <h2 style={{fontSize:27,margin:'0 0 9px',color:'#123e78'}}>Avalia 360°</h2>
   <p style={{fontSize:15,lineHeight:1.6,margin:'0 0 15px'}}>
    Estúdio de avaliações, curadoria pedagógica por regras, questões objetivas e discursivas,
    parâmetros longitudinais e provas individualizadas de demonstração.
   </p>
   <div role="note" style={{padding:'13px 16px',background:'#fff5e7',borderLeft:'4px solid #be7b23',borderRadius:9,fontSize:14,lineHeight:1.6}}>
    <strong>Ambiente de homologação.</strong> O Estúdio ainda funciona em um endereço isolado.
    Não utilize nomes reais de estudantes nem documentos institucionais confidenciais:
    nesta etapa não existe conexão autenticada com a base acadêmica da Vértice.
    A produção de avaliações oficiais, emissão de QR identificáveis no banco e correção
    automática permanecem desabilitadas até homologação.
   </div>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20,alignItems:'center'}}>
    <a href={PREVIEW_URL} target="_blank" rel="noopener noreferrer"
     style={{display:'inline-block',padding:'13px 20px',borderRadius:10,background:'#164b92',color:'#fff',textDecoration:'none',fontWeight:750}}>
     Abrir Estúdio Avalia 360° — demonstração
    </a>
    <span style={{fontSize:13,color:'#52657b'}}>O Estúdio abre em outra aba, sem compartilhar sua sessão institucional.</span>
   </div>
   <h3 style={{fontSize:17,margin:'24px 0 9px'}}>O que pode ser testado</h3>
   <p style={{lineHeight:1.7}}>
    Elaboração de questões, diagnóstico estrutural, composição orientada pelo professor,
    prévia de caderno e PDF com turma fictícia 2A e QR de demonstração.
    O vínculo a competências oficiais e o registro real de notas ainda não estão homologados.
   </p>
  </div>
 </section>;
}
