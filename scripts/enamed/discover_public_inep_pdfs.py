#!/usr/bin/env python3
"""Discover and download public ENAMED PDF URLs exposed by the official INEP catalog.
No DB writes. No inferred URL building. A discovered PDF is NOT pedagogically homologated.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import pathlib
import re
import urllib.request
from urllib.parse import urljoin, urlsplit

CATALOG = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed/provas-e-gabaritos"
ALLOWED = {"www.gov.br", "download.inep.gov.br"}
MAX_BYTES = 30 * 1024 * 1024
MAX_FILES = 12

class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.current = None
    def handle_starttag(self,tag,attrs):
        if tag.lower() == "a":
            self.current = dict(attrs).get("href")
    def handle_endtag(self,tag):
        if tag.lower() == "a": self.current = None
    def handle_data(self,data):
        if self.current:
            self.refs.append((self.current,data.strip()))

def permitted(url):
    o=urlsplit(url)
    return o.scheme == "https" and o.hostname in ALLOWED and not o.username and not o.password

def fetch(url):
    if not permitted(url): raise ValueError("untrusted host")
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (ENAMED official public-document audit; read-only)"})
    with urllib.request.urlopen(req,timeout=18) as response:
        actual=response.geturl()
        if not permitted(actual): raise ValueError("redirect to untrusted host")
        chunks=[]; size=0
        while True:
            part=response.read(1<<18)
            if not part: break
            size+=len(part)
            if size>MAX_BYTES: raise ValueError("document exceeds 30 MiB")
            chunks.append(part)
        return b"".join(chunks),actual,response.headers.get("Content-Type","")

def run():
    output=pathlib.Path("evidence/enamed-inep")
    output.mkdir(parents=True,exist_ok=True)
    report={"checked_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
      "catalog_url":CATALOG,"catalog_status":"unavailable","documents":[],
      "limitations":["Downloaded bytes and hashes prove local content integrity, not authoritative source authorship or edition validity.",
                    "Links are taken only from the official catalog response; absence of links does not establish absence of publications."]}
    try:
        data,final,ctype=fetch(CATALOG)
        report["catalog_status"]="retrieved"
        page=data.decode("utf-8","replace")
        position=page.lower().find("prova objetiva")
        report["html_excerpt_around_prova_objetiva"]=page[max(0,position-150):position+1900] if position>=0 else ""
        report["html_has_2026"]=("2026" in page)
        parser=LinkCollector();parser.feed(page)
        links={}
        for href,label in parser.refs:
            if not href:continue
            u=urljoin(final,html.unescape(href))
            if permitted(u) and (".pdf" in u.lower() or "download" in u.lower()) and ("enamed" in u.lower() or "2026" in u.lower()):
                links[u]=label
        for u in re.findall(r'https?://[^\s"\'<>\\]+',html.unescape(page)):
            u=u.rstrip("),};")
            if permitted(u) and ".pdf" in u.lower() and ("enamed" in u.lower() or "2026" in u.lower()):
                links.setdefault(u,"embedded page URL")
        report["catalog_candidates"]=len(links)
        for n,(url,label) in enumerate(list(links.items())[:MAX_FILES]):
            entry={"url":url,"catalog_label":label[:160],"download_status":"failed"}
            try:
                pdf,actual,mime=fetch(url)
                entry["final_url"]=actual;entry["content_type"]=mime
                entry["size_bytes"]=len(pdf)
                if not pdf.startswith(b"%PDF-") or b"%%EOF" not in pdf[-2048:]:
                    raise ValueError("not a complete PDF")
                name=f"enamed_source_{n+1:02d}.pdf"
                (output/name).write_bytes(pdf)
                entry["file"]=name;entry["sha256"]=hashlib.sha256(pdf).hexdigest()
                entry["download_status"]="byte_integrity_checked"
                entry["official_validation"]="PENDING_HUMAN_PROVENANCE_AND_EDITION_REVIEW"
            except Exception as e:
                entry["error"]=str(e)[:200]
            report["documents"].append(entry)
        if not links: report["limitations"].append("No direct official PDF links exposed in retrieved HTML; manual Javascript or portal inspection needed.")
    except Exception as e:
        report["catalog_status"]="retrieval_error"
        report["catalog_error"]=str(e)[:300]
    (output/"discovery_report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print(json.dumps({"catalog_excerpt":report.get("html_excerpt_around_prova_objetiva","")[:1100]},ensure_ascii=False))
    print(json.dumps({"status":report["catalog_status"],"candidates":report.get("catalog_candidates",0),
      "pdfs_integrity_checked":sum(x["download_status"]=="byte_integrity_checked" for x in report["documents"])},ensure_ascii=False))
if __name__=="__main__":run()
