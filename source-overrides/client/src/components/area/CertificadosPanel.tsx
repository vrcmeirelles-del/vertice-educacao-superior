// Certificados com código de verificação. Quem tem direito e a carga horária vêm do banco
// (horas validadas da extensão; minutos da atividade de ensino validada). Emitir e revogar exigem
// gestão com MFA, conferido pelas RPCs. O PDF é gerado no navegador a partir do que foi emitido.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cargaHoraria, verifyUrl, type CertificateData, type CertificateKind } from '@/lib/certificate-pdf';

type Emitido = CertificateData & { id: string; outdated: boolean };
type Linha = { holderRef: string; holderName: string; minutes: number; certificate: Emitido | null };
type Props = { kind: CertificateKind; sourceId: string };

const erro = (m: string) => /acesso negado|MFA/.test(m) ? 'Emissão disponível só para a gestão do módulo, com segundo fator confirmado (e, no ensino, com a atividade validada).'
  : /signatário/.test(m) ? 'Informe nome e cargo de quem assina.' : /justificativa/.test(m) ? 'Informe a justificativa da revogação.'
  : 'Não foi possível concluir. Nada foi alterado.';

export default function CertificadosPanel({ kind, sourceId }: Props) {
  const [aberto, setAberto] = useState(false), [linhas, setLinhas] = useState<Linha[] | null>(null), [titulo, setTitulo] = useState(''), [instituicao, setInstituicao] = useState('');
  const [nome, setNome] = useState(''), [cargo, setCargo] = useState(''), [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false), [aviso, setAviso] = useState(''), [falha, setFalha] = useState('');

  const carregar = useCallback(async () => {
    setFalha('');
    const r = await supabase.rpc('vertice_certificate_roster', { p_kind: kind, p_source: sourceId });
    if (r.error) { setLinhas(null); setFalha(erro(r.error.message ?? '')); return; }
    setTitulo(r.data?.title ?? ''); setInstituicao(r.data?.institution ?? ''); setLinhas((r.data?.eligible ?? []) as Linha[]);
  }, [kind, sourceId]);
  useEffect(() => { if (aberto) void carregar(); }, [aberto, carregar]);

  async function emitir() {
    setOcupado(true); setAviso(''); setFalha('');
    const r = await supabase.rpc('vertice_certificate_issue', { p_kind: kind, p_source: sourceId, p_signer_name: nome.trim(), p_signer_role: cargo.trim() });
    setOcupado(false);
    if (r.error) { setFalha(erro(r.error.message ?? '')); return; }
    setAviso(r.data ? `${r.data} certificado(s) emitido(s).` : 'Nenhum certificado novo: todos os elegíveis já têm certificado vigente.');
    void carregar();
  }
  async function revogar(c: Emitido) {
    setOcupado(true); setAviso(''); setFalha('');
    const r = await supabase.rpc('vertice_certificate_revoke', { p_certificate: c.id, p_reason: motivo.trim() });
    setOcupado(false);
    if (r.error) { setFalha(erro(r.error.message ?? '')); return; }
    setAviso(`Certificado ${c.code} revogado. A verificação pública passa a mostrá-lo como revogado.`); setMotivo(''); void carregar();
  }
  async function baixar(lista: Emitido[]) {
    const { buildCertificatesPdf } = await import('@/lib/certificate-pdf');
    const bytes = await buildCertificatesPdf({ kind, institution: instituicao || 'Instituição', certificates: lista });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = lista.length === 1 ? `certificado-${lista[0].code}.pdf` : `certificados-${(titulo || 'atividade').slice(0, 40)}.pdf`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const emitidos = (linhas ?? []).map((l) => l.certificate).filter((c): c is Emitido => !!c);
  const faltam = (linhas ?? []).filter((l) => !l.certificate).length;
  return (
    <section className="rec17-overview" aria-label="Certificados">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>Certificados com código de verificação</button>
      {aberto && <div>
        {falha && <p role="alert" className="rec17-error">{falha}</p>}
        {linhas && <>
          <p className="rec17-help">Têm direito {linhas.length} participante(s), pela carga {kind === 'extensao' ? 'validada no projeto' : 'registrada na atividade validada'}. Emitidos: {emitidos.length}. Faltam: {faltam}.</p>
          {faltam > 0 && <div className="rec17-summary">
            <label>Quem assina <input value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></label>
            <label>Cargo <input value={cargo} maxLength={200} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Coordenador(a) do curso" /></label>
            <button type="button" disabled={ocupado || nome.trim().length < 3 || cargo.trim().length < 3} onClick={emitir}>Emitir {faltam} certificado(s)</button>
          </div>}
          {emitidos.length > 0 && <button type="button" disabled={ocupado} onClick={() => baixar(emitidos)}>Baixar todos em PDF</button>}
          <table><caption>Participantes com direito a certificado</caption>
            <thead><tr><th scope="col">Participante</th><th scope="col">Carga</th><th scope="col">Certificado</th><th scope="col">Ações</th></tr></thead>
            <tbody>{linhas.map((l) => <tr key={l.holderRef}>
              <td>{l.holderName}</td><td>{cargaHoraria(l.minutes)}</td>
              <td>{l.certificate ? <><a href={verifyUrl(l.certificate.code)} target="_blank" rel="noreferrer">{l.certificate.code}</a>
                {l.certificate.outdated && <small> · carga mudou depois da emissão ({cargaHoraria(l.certificate.minutes)}); revogue e emita de novo</small>}</> : 'Não emitido'}</td>
              <td>{l.certificate && <>
                <button type="button" disabled={ocupado} onClick={() => baixar([l.certificate!])}>PDF</button>
                <button type="button" disabled={ocupado || motivo.trim().length < 5} onClick={() => revogar(l.certificate!)}>Revogar</button></>}</td>
            </tr>)}</tbody>
          </table>
          {emitidos.length > 0 && <label>Justificativa para revogar (obrigatória) <input value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} /></label>}
          <p className="rec17-help">A assinatura é a identificação de quem assina, registrada com o usuário que emitiu. Não é assinatura digital ICP-Brasil.</p>
        </>}
        {aviso && <p role="status">{aviso}</p>}
      </div>}
    </section>
  );
}
