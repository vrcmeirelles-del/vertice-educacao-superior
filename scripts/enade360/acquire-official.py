"""Receive original INEP sources, validate bytes, and inventory without publishing results."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path('official-acquisition')
ROOT.mkdir(exist_ok=True)
CATALOG = 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/'
receipts = json.loads(Path('docs/enade-360/evidencias/20261117-work/official-source-receipts.json').read_text())
urls = list(dict.fromkeys(r['url'] for r in receipts if r['filename'].endswith(('.zip', '.rar', '.xlsx', '.pdf'))))


def receive(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != 'download.inep.gov.br':
        raise ValueError('Only the original HTTPS INEP download host is allowed')
    name = Path(parsed.path).name
    folder = 'packets' if name.endswith(('.zip', '.rar')) else 'references'
    path = ROOT / folder / name
    path.parent.mkdir(exist_ok=True)
    r = {'source_url': url, 'original_filename': name, 'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'received': False}
    start = time.monotonic()
    try:
        h = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(url, timeout=45) as response, path.open('wb') as out:
            r.update(http_status=response.status, final_url=response.url, content_type=response.headers.get('Content-Type'))
            while block := response.read(1024 * 1024):
                out.write(block)
                h.update(block)
                size += len(block)
                if size > 1_100_000_000 or time.monotonic() - start > 600:
                    raise RuntimeError('Transfer exceeded the declared size/time limit')
        r.update(bytes=size, sha256=h.hexdigest(), saved_path=str(path))
        if name.endswith(('.zip', '.xlsx')):
            with zipfile.ZipFile(path) as archive:
                bad = archive.testzip()
                if bad:
                    raise ValueError('ZIP CRC failed: ' + bad)
                members = archive.infolist()
                r['archive_members'] = [{'name': m.filename, 'bytes': m.file_size, 'crc': m.CRC} for m in members]
                if name.endswith('.xlsx') and 'xl/workbook.xml' not in archive.namelist():
                    raise ValueError('Not an XLSX workbook')
                if name.endswith('.zip'):
                    r['csv_headers'] = {}
                    for member in members:
                        if member.filename.lower().endswith(('.csv', '.txt')):
                            with archive.open(member) as source:
                                header = source.readline(32768).decode('latin-1').strip()
                            if re.search(r'CO_CURSO|NU_ANO|NT_GER|TP_PRES', header):
                                r['csv_headers'][member.filename] = header
        elif name.endswith('.rar'):
            with path.open('rb') as source:
                if not source.read(8).startswith(b'Rar!\x1a\x07'):
                    raise ValueError('Invalid RAR magic bytes')
            seven = shutil.which('7zz') or shutil.which('7z')
            if seven:
                result = subprocess.run([seven, 't', str(path)], capture_output=True, text=True, timeout=360)
                r['rar_integrity_status'] = result.returncode
                r['rar_integrity_log'] = result.stdout[-4000:]
                if result.returncode:
                    raise ValueError('RAR integrity check failed')
            else:
                r['rar_integrity_status'] = 'NOT_TESTED_TOOL_MISSING'
        elif name.endswith('.pdf'):
            with path.open('rb') as source:
                if not source.read(5).startswith(b'%PDF'):
                    raise ValueError('Invalid PDF magic bytes')
            output = ROOT / (name + '.txt')
            result = subprocess.run(['pdftotext', '-layout', str(path), str(output)], capture_output=True, text=True, timeout=60)
            if result.returncode:
                raise ValueError('PDF parsing failed: ' + result.stderr[:200])
        r['received'] = True
        r['structure_valid'] = True
    except urllib.error.HTTPError as error:
        r.update(http_status=error.code, error=str(error), response_excerpt=error.read(500).decode(errors='replace'))
    except Exception as error:
        r['error'] = str(error)
    if not r['received'] and path.exists():
        path.rename(path.with_suffix(path.suffix + '.incomplete'))
    r['duration_seconds'] = round(time.monotonic() - start, 2)
    print(json.dumps({k: r.get(k) for k in ('original_filename', 'http_status', 'received', 'bytes', 'error')}, ensure_ascii=False), flush=True)
    return r


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
    results = list(workers.map(receive, urls))
(ROOT / 'receipts.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))

try:
    import openpyxl
    inventories = []
    for item in results:
        if item['received'] and item['original_filename'].endswith('.xlsx'):
            workbook = openpyxl.load_workbook(item['saved_path'], read_only=True, data_only=True)
            inventories.append({'filename': item['original_filename'], 'sha256': item['sha256'], 'sheets': [{'name': sheet.title, 'rows': sheet.max_row, 'columns': sheet.max_column, 'first_rows': list(sheet.iter_rows(min_row=1, max_row=4, values_only=True))} for sheet in workbook]})
            workbook.close()
    (ROOT / 'workbook-inventory.json').write_text(json.dumps(inventories, ensure_ascii=False, indent=2, default=str))
except Exception as error:
    (ROOT / 'workbook-inventory-error.txt').write_text(str(error))
summary = {'attempted': len(results), 'received': sum(r['received'] for r in results), 'failed': sum(not r['received'] for r in results), 'scientific_reproductions': 0, 'academic_publication_authorized': False}
(ROOT / 'summary.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary), flush=True)
