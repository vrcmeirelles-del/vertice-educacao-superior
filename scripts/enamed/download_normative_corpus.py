#!/usr/bin/env python3
"""Recover only the six outstanding named normative PDFs, with strict TLS.

No exam-booklet re-downloads. An absent intermediate is trusted only after
cryptographic verification to the operating-system root store.
"""
import hashlib
import json
import pathlib
import ssl
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlsplit
from download_inep_verified_chain import retrieve_issuer, command, KNOWN_AIA, ROOTS

DOCUMENTS = {
    'NT40': 'https://download.inep.gov.br/educacao_superior/enade/notas_tecnicas/2025/nota_tecnica_40_calculo_conceito_enade_medicina.pdf',
    'NT19': 'https://download.inep.gov.br/enamed/nota_tecnica_n_19_2025.pdf',
    'NT1PL': 'https://download.inep.gov.br/enamed/nota_tecnica_1pl_2025.pdf',
    'NT42': 'https://download.inep.gov.br/enamed/nota_tecnica_n_42_2025.pdf',
    'MANUAL': 'https://download.inep.gov.br/educacao_superior/enade/manuais/manual_do_enamed_para_participantes_e_ies.pdf',
    'EDITAL71': 'https://download.inep.gov.br/enamed/edital_71_de_28_de_maio_de_2026.pdf',
}
OUT = pathlib.Path('evidence/enamed-normative')


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, url):
        if url not in DOCUMENTS.values():
            raise ValueError('Redirect outside explicitly catalogued official files')
        return super().redirect_request(req, fp, code, msg, headers, url)


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(),
              'tls_validation_disabled': False, 'documents': [],
              'legal_and_medical_approval': False}
    with tempfile.TemporaryDirectory() as tmp:
        context = ssl.create_default_context()
        try:
            der, transfers = retrieve_issuer(KNOWN_AIA)
            raw = pathlib.Path(tmp)/'issuer.der'; raw.write_bytes(der)
            pem = pathlib.Path(tmp)/'issuer.pem'
            converted = command(['openssl','x509','-inform','DER','-in',str(raw),'-out',str(pem)])
            if converted.returncode:
                raise ValueError('Issuer conversion failed')
            verified = command(['openssl','verify','-purpose','any','-CAfile',str(ROOTS),str(pem)])
            if verified.returncode:
                raise ValueError('Issuer is not chained to OS trusted roots')
            context.load_verify_locations(cadata=pem.read_text())
            report['issuer_verified_to_os_roots'] = True
            report['issuer_sha256'] = hashlib.sha256(der).hexdigest()
        except Exception as error:
            report['issuer_recovery_error'] = str(error)[:250]
            # The original OS context still validates every HTTPS connection.

        archive_path=pathlib.Path('docs/enamed/INEP_NORMAS_SHA256_20261117.json')
        archive=json.loads(archive_path.read_text()) if archive_path.exists() else {}
        verified={d['id']:d for d in archive.get('documents',[]) if d.get('byte_hash_rechecked_locally') and d.get('sha256')}

        def download(entry):
            name, url = entry
            if name in verified:
                return {**verified[name], 'status':'REUSED_VERIFIED_ACTIONS_ARTIFACT',
                        'original_actions_artifact':archive['actions_artifact'],
                        'downloaded_in_this_run':False}
            row = {'id': name, 'official_url': url, 'status': 'BLOQUEADA'}
            try:
                opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),OfficialRedirect())
                with opener.open(urllib.request.Request(url,headers={'User-Agent':'ENAMED documentary verification'}),timeout=35) as response:
                    if response.geturl() not in DOCUMENTS.values():
                        raise ValueError('Source URL not catalogued')
                    data = response.read(30*1024*1024+1)
                if not data.startswith(b'%PDF-') or b'%%EOF' not in data[-2048:] or len(data)>30*1024*1024:
                    raise ValueError('Not a complete bounded PDF')
                (OUT/(name+'.pdf')).write_bytes(data)
                row.update(status='CONCLUÍDA',sha256=hashlib.sha256(data).hexdigest(),bytes=len(data),
                           file=name+'.pdf',scope='BINARY_RECOVERY_ONLY_REVIEW_REQUIRED')
            except Exception as error:
                row['error'] = str(error)[:250]
            return row

        report['documents'] = list(ThreadPoolExecutor(max_workers=3).map(download,DOCUMENTS.items()))
    (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    run()
