#!/usr/bin/env python3
"""Render the official INEP catalog in a headless browser to discover dynamically loaded PDF links.
Read-only. Any recovered PDF remains pending document/provenance approval.
"""
import datetime as dt
import hashlib
import json
import pathlib
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from discover_public_inep_pdfs import CATALOG, MAX_FILES, fetch, permitted

def main():
    output=pathlib.Path("evidence/enamed-inep-rendered")
    output.mkdir(parents=True,exist_ok=True)
    report={"checked_at_utc":dt.datetime.now(dt.timezone.utc).isoformat(),
       "official_page":CATALOG,"source":"official_dynamic_browser_DOM",
       "status":"failed","documents":[],"published_integrity":"NOT_HOMOLOGATED"}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
            page=browser.new_page(locale="pt-BR")
            page.goto(CATALOG,wait_until="domcontentloaded",timeout=30000)
            page.wait_for_timeout(5500)
            for name in ("2026","Prova Objetiva – Enamed 2026","Reaplicação – Enamed 2026"):
                elements=page.get_by_text(name,exact=True)
                for i in range(min(elements.count(),2)):
                    try:
                        if elements.nth(i).is_visible():elements.nth(i).click(timeout=1100)
                    except Exception: pass
            page.wait_for_timeout(2500)
            a=page.locator("a[href]").evaluate_all("""els => els.map(e=>({
               href:e.href, text:(e.innerText||e.textContent||'').trim().slice(0,160)
            }))""")
            report["page_title"]=page.title()
            report["visible_text_sample"]=page.locator("body").inner_text(timeout=10000)[-1600:]
            report["anchor_count"]=len(a)
            candidates={}
            for entry in a:
                u=urljoin(CATALOG,entry.get("href",""))
                if permitted(u) and (".pdf" in u.lower() or "download" in u.lower()) and ("enamed" in u.lower() or "2026" in u.lower()):
                    candidates[u]=entry.get("text","")
            report["candidate_count"]=len(candidates)
            browser.close()
        for index,(url,label) in enumerate(list(candidates.items())[:MAX_FILES]):
            entry={"url":url,"label":label,"status":"failed"}
            try:
                body,final,mime=fetch(url)
                entry["redirected_url"]=final
                entry["size_bytes"]=len(body)
                if not body.startswith(b"%PDF-") or b"%%EOF" not in body[-2048:]:
                    raise ValueError("invalid or truncated PDF")
                filename=f"catalog_pdf_{index+1:02d}.pdf"
                (output/filename).write_bytes(body)
                entry["filename"]=filename
                entry["sha256"]=hashlib.sha256(body).hexdigest()
                entry["status"]="BYTE_HASH_VALID_PROVENANCE_PENDING"
            except Exception as e: entry["error"]=str(e)[:180]
            report["documents"].append(entry)
        report["status"]="complete"
    except Exception as error:report["error"]=str(error)[:350]
    (output/"rendered_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({key:report.get(key) for key in ("status","page_title","anchor_count","candidate_count","error")},ensure_ascii=False))
    print("VISIBLE_TEXT_SAMPLE:",report.get("visible_text_sample","")[-900:])
    print("DOWNLOADED_PDFS:",sum(x["status"]=="BYTE_HASH_VALID_PROVENANCE_PENDING" for x in report["documents"]))
if __name__=="__main__":main()
