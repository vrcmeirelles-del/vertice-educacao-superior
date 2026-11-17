#!/usr/bin/env python3
"""Restore HTTPS trust using a cryptographically verified missing issuer certificate.
Never disables TLS validation. AIA bytes are NOT trusted until openssl verify
successfully chains the leaf to the system root store and validates the hostname.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import pathlib
import re
import ssl
import subprocess
import tempfile
import urllib.request
from urllib.parse import urlsplit,urlunsplit

HOST="download.inep.gov.br"
MANIFEST=pathlib.Path("docs/enamed/INEP_2026_LINKS_OFICIAIS_CONFIRMADOS.json")
OUTPUT=pathlib.Path("evidence/enamed-verified-chain")
ROOTS=pathlib.Path("/etc/ssl/certs/ca-certificates.crt")
# AIA observed in public server leaf metadata, GitHub diagnostic run 44016652354.
# This is not a trust anchor; the intermediate must validate to OS roots before use.
KNOWN_AIA="http://secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt"
MAX_PDF=30*1024*1024
MAX_CERT=128*1024
PRIORITY={"REG-C1","REG-C2","REG-GAB-C1-PREL","REG-GAB-C2-PREL",
          "REAP-C1","REAP-C2","REAP-GAB-C1-PREL","REAP-GAB-C2-PREL"}

def command(argv, *, timeout=18,input_data=None):
    return subprocess.run(argv,input=input_data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                          timeout=timeout,check=False)

def safe_issuer(url):
    p=urlsplit(url)
    return (p.scheme in ("http","https") and p.hostname=="secure.globalsign.com"
        and not p.username and not p.password and p.path.startswith("/cacert/")
        and p.path.endswith(".crt") and len(url)<300)

def retrieve_issuer(aia_url):
    """Prefer HTTPS. HTTP AIA is acceptable ONLY because the certificate
    is subsequently validated using the trusted root, not by URL trust."""
    choices=[aia_url]
    if aia_url.startswith("http://"):
        choices=[aia_url.replace("http://","https://",1),aia_url]
    diagnostics=[]
    for url in choices:
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"ENAMED verified-public-doc-corpus/1"})
            with urllib.request.urlopen(req,timeout=16) as response:
                final=response.geturl()
                if not safe_issuer(final):raise ValueError("issuer redirects outside allowed CA path")
                value=response.read(MAX_CERT+1)
                if not value or len(value)>MAX_CERT:raise ValueError("invalid intermediate file size")
            diagnostics.append({"url":url,"result":"retrieved_untrusted_pending_crypto_validation"})
            return value,diagnostics
        except Exception as e:
            diagnostics.append({"url":url,"error":str(e)[:160]})
    raise ValueError("Could not obtain issuer: "+json.dumps(diagnostics))

def source_request(url,ctx):
    parsed=urlsplit(url)
    if (parsed.scheme!="https" or parsed.hostname!=HOST
        or not parsed.path.startswith("/enamed/provas_e_gabaritos/")
        or not parsed.path.lower().endswith(".pdf") or parsed.username or parsed.password):
        raise ValueError("source path/host not permitted")
    class OfficialRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            p=urlsplit(newurl)
            if p.scheme!="https" or p.hostname!=HOST:
                raise ValueError("redirect outside official download host")
            return super().redirect_request(req,fp,code,msg,hdrs,newurl)
    opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),OfficialRedirect())
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 INEP official-source audit"})
    with opener.open(req,timeout=30) as response:
        final=response.geturl()
        if urlsplit(final).hostname!=HOST:raise ValueError("unexpected redirect")
        data=response.read(MAX_PDF+1)
        if len(data)>MAX_PDF:raise ValueError("PDF exceeds limit")
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
            raise ValueError("not a complete PDF")
        return data,final,response.headers.get("Content-Type","")

def run():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    report={"timestamp_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
       "official_host":HOST,"system_roots":str(ROOTS),"chain_verified":False,
       "documents":[],"caveat":"TLS+SHA only: document/edition/answer status still needs human official-source review"}
    try:
        if not ROOTS.is_file():raise ValueError("OS trusted CA root bundle unavailable")
        hs=command(["openssl","s_client","-connect",HOST+":443","-servername",HOST,"-showcerts"],timeout=20,input_data=b"")
        chain=re.findall(rb"-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----",hs.stdout+hs.stderr)
        report["presented_certs"]=len(chain)
        report["leaf_unavailable_on_this_handshake"]=not bool(chain)
        with tempfile.TemporaryDirectory() as tmp:
            d=pathlib.Path(tmp)
            leaf=d/"leaf.pem"
            issuer_url=KNOWN_AIA
            if chain:
                leaf.write_bytes(chain[0]+bytes((10,)))
                details=command(["openssl","x509","-in",str(leaf),"-noout","-issuer","-subject","-dates","-ext","authorityInfoAccess"])
                if details.returncode!=0:raise ValueError("could not inspect leaf cert")
                metadata=details.stdout.decode("utf-8","replace")
                report["leaf_certificate_metadata"]=metadata[:1800]
                aia=re.search(r"CA Issuers\\s*-\\s*URI:(https?://\\S+)",metadata)
                if not aia or not safe_issuer(aia.group(1)):raise ValueError("issuer URL not allowed or absent")
                issuer_url=aia.group(1)
            else:
                report["issuer_aia_provenance"]="public leaf certificate from earlier signed-chain diagnostic"
            issuer_der,attempts=retrieve_issuer(issuer_url)
            report["issuer_transfer"]=attempts
            raw=d/"intermediate.crt";raw.write_bytes(issuer_der)
            untrusted=d/"intermediate.pem"
            inform="PEM" if issuer_der.startswith(b"-----BEGIN") else "DER"
            convert=command(["openssl","x509","-inform",inform,"-in",str(raw),"-outform","PEM","-out",str(untrusted)])
            if convert.returncode:raise ValueError("issuer certificate parsing failed")
            issuer_check=command(["openssl","verify","-purpose","any","-CAfile",str(ROOTS),str(untrusted)])
            report["issuer_root_verification"]=issuer_check.stdout.decode("utf8","replace")[:450]+issuer_check.stderr.decode("utf8","replace")[:450]
            if issuer_check.returncode:raise ValueError("intermediate cannot be verified to system-trusted root")
            report["issuer_anchored_to_system_root"]=True
            if chain:
                verify=command(["openssl","verify","-purpose","sslserver","-verify_hostname",HOST,
                             "-CAfile",str(ROOTS),"-untrusted",str(untrusted),str(leaf)])
                report["openssl_chain_verification"]=verify.stdout.decode("utf8","replace")[:500]+verify.stderr.decode("utf8","replace")[:500]
                if verify.returncode:raise ValueError("issuer fails leaf hostname/root verification")
            report["issuer_sha256"]=hashlib.sha256(issuer_der).hexdigest()
            # Only after cryptographic validation, append missing issuer to system trust roots
            bundle=d/"trusted-chain.pem";bundle.write_bytes(ROOTS.read_bytes()+b"\n"+untrusted.read_bytes())
            ctx=ssl.create_default_context(cafile=str(bundle))
            manifest=json.loads(MANIFEST.read_text(encoding="utf8"))
            for index,doc in enumerate(manifest.get("documents",[])):
                if doc.get("id") not in PRIORITY:continue
                entry={"id":doc["id"],"official_catalog_url":manifest["catalog_url"],
                       "official_url":doc["official_url"],"status":"NOT_RECOVERED"}
                try:
                    body,final,ctype=source_request(doc["official_url"],ctx)
                    filename=f"{doc['id'].lower()}_{index:02d}.pdf"
                    (OUTPUT/filename).write_bytes(body)
                    entry.update({"status":"TLS_AND_BYTE_INTEGRITY_CONFIRMED",
                       "file":filename,"sha256":hashlib.sha256(body).hexdigest(),
                       "size_bytes":len(body),"final_url":final,"content_type":ctype,
                       "pedagogical_review":"PENDING_ITEM_AND_GABARITO_VERIFICATION"})
                except Exception as e:entry["error"]=str(e)[:220]
                report["documents"].append(entry)
            # Current live host is authenticated only by a successful strict-TLS transfer.
            report["chain_verified"]=any(x["status"]=="TLS_AND_BYTE_INTEGRITY_CONFIRMED" for x in report["documents"])
    except Exception as e:
        report["error"]=str(e)[:350]
    (OUTPUT/"verified_chain_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"chain_verified":report["chain_verified"],"documents_tested":len(report["documents"]),
                       "pdfs_verified":sum(x["status"]=="TLS_AND_BYTE_INTEGRITY_CONFIRMED" for x in report["documents"]),
                       "error":report.get("error","")},ensure_ascii=False))
if __name__=="__main__":run()
