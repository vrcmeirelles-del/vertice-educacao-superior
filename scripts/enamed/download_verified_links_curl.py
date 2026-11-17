#!/usr/bin/env python3
"""Download only browser-confirmed official INEP catalog links with curl, TLS enabled.
Produces byte hashes, NOT certified official validity; does not edit databases.
"""
from __future__ import annotations
import hashlib,json,pathlib,subprocess
from urllib.parse import urlsplit

MANIFEST=pathlib.Path("docs/enamed/INEP_2026_LINKS_OFICIAIS_CONFIRMADOS.json")
OUT=pathlib.Path("evidence/enamed-inep-curl")
OFFICIAL={"www.gov.br","download.inep.gov.br"}
MAX_SIZE=30*1024*1024

def allowed(value):
    p=urlsplit(value)
    return p.scheme=="https" and p.hostname in OFFICIAL and not p.username and not p.password

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    data=json.loads(MANIFEST.read_text(encoding="utf-8"))
    report={"catalog_provenance":data["catalog_url"],"reference_run":data["verified_url_provenance"],
            "status":"INTEGRITY_ONLY_NOT_OFFICIAL_VALIDITY",
            "documents":[]}
    for record in data["documents"]:
        if record["kind"] not in ("prova","gabarito"):continue
        url=record["official_url"]
        entry={"id":record["id"],"url":url,"status":"NOT_RECOVERED"}
        if not allowed(url):
            entry["error"]="URL host not allowed";report["documents"].append(entry);continue
        path=OUT/(record["id"]+".pdf")
        args=["curl","--silent","--show-error","--fail","--location",
              "--max-redirs","3","--proto","=https","--proto-redir","=https",
              "--tlsv1.2","--connect-timeout","8","--max-time","28",
              "--max-filesize",str(MAX_SIZE),"--output",str(path),
              "--write-out","%{url_effective}",url]
        try:
            done=subprocess.run(args,capture_output=True,text=True,timeout=35)
            redirected=done.stdout.strip()
            if done.returncode:raise ValueError("curl "+str(done.returncode)+": "+done.stderr.strip()[:150])
            if not allowed(redirected):raise ValueError("redirect outside official hosts")
            raw=path.read_bytes()
            if not raw.startswith(b"%PDF-") or b"%%EOF" not in raw[-2048:]:
                raise ValueError("not a complete PDF")
            if len(raw)>MAX_SIZE:raise ValueError("too large")
            entry.update(status="BYTE_INTEGRITY_CHECKED_ONLY",final_url=redirected,
                         size_bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),
                         path=str(path))
        except Exception as error:
            entry["error"]=str(error)[:210]
            if path.exists():path.unlink()
        report["documents"].append(entry)
    (OUT/"curl_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"attempted":len(report["documents"]),
                      "binary_success":sum(x["status"]=="BYTE_INTEGRITY_CHECKED_ONLY" for x in report["documents"]),
                      "errors":{x["id"]:x.get("error") for x in report["documents"] if x["status"]=="NOT_RECOVERED"}},ensure_ascii=False))
if __name__=="__main__":main()
