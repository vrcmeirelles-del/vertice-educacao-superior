#!/usr/bin/env python3
"""Diagnose the public download.inep.gov.br TLS chain without disabling HTTPS verification.
A displayed leaf certificate is not treated as authenticated until chain+hostname validate.
"""
import datetime as dt
import json
import pathlib
import re
import socket
import ssl
import subprocess
import tempfile

HOST="download.inep.gov.br"
def main():
    out=pathlib.Path("evidence/enamed-tls")
    out.mkdir(parents=True,exist_ok=True)
    report={"host":HOST,"date_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
            "verified_handshake":False,"certificate_details_untrusted":True,
            "note":"Diagnostic only; never use an untrusted certificate or disable verification for downloading official files."}
    try:
        with socket.create_connection((HOST,443),timeout=12) as tcp:
            with ssl.create_default_context().wrap_socket(tcp,server_hostname=HOST) as tls:
                report["verified_handshake"]=True
                report["tls_version"]=tls.version()
    except Exception as e:
        report["verified_error"]=f"{type(e).__name__}: {str(e)[:260]}"
    try:
        r=subprocess.run(["openssl","s_client","-showcerts","-connect",f"{HOST}:443","-servername",HOST],
                         input="",capture_output=True,text=True,timeout=17)
        combined=r.stdout+"\n"+r.stderr
        report["openssl_exit_code"]=r.returncode
        report["verify_lines"]=[line.strip()[:200] for line in combined.splitlines()
                                if "verify error:" in line.lower() or "verify return code:" in line.lower()][:8]
        blocks=re.findall(r"-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----",combined)
        report["certificates_presented"]=len(blocks)
        certs=[]
        with tempfile.TemporaryDirectory() as d:
            for index,pem in enumerate(blocks[:6]):
                p=pathlib.Path(d)/f"cert_{index}.pem"
                p.write_text(pem,encoding="ascii")
                details=subprocess.run(["openssl","x509","-in",str(p),"-noout","-subject","-issuer",
                                        "-dates","-ext","authorityInfoAccess"],
                                        capture_output=True,text=True,timeout=8)
                data=details.stdout[:3000]
                certs.append({"position":index,"details":data,"aia_issuer_urls":
                    re.findall(r"CA Issuers\s*-\s*URI:(https?://\S+)",data)})
        report["presented_chain_unverified"]=certs
    except Exception as e:
        report["diagnostic_error"]=f"{type(e).__name__}: {str(e)[:280]}"
    (out/"tls_chain_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"verified_handshake":report["verified_handshake"],
                      "certificates_presented":report.get("certificates_presented"),
                      "verify_lines":report.get("verify_lines",[]),
                      "diagnostic_error":report.get("diagnostic_error")},ensure_ascii=False))
if __name__=="__main__":main()
