#!/usr/bin/env python3
"""OCR local de originais já obtidos por sessão autorizada.

Não acessa rede/banco, não altera originais e não aprova/classifica evidências.
Manifesto privado: [{id, file_name, path, expected_sha256}]. Produz JSON privado
para importação controlada, mantendo páginas, confiança e revisão obrigatória.
"""
import argparse, csv, hashlib, json, re, subprocess, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def run(args, **kw): return subprocess.run(args,check=True,capture_output=True,text=True,timeout=180,**kw).stdout

def extract(row, tessdata, rotations=False):
    src=Path(row['path']); digest=sha(src)
    if digest!=row['expected_sha256']: raise ValueError('source_hash_mismatch')
    if src.stat().st_size>30*1024*1024: raise ValueError('file_too_large')
    with tempfile.TemporaryDirectory(prefix='vertice-ocr-') as td:
        work=Path(td)
        if src.read_bytes()[:5]==b'%PDF-':
            info=run(['pdfinfo',str(src)]); count=int(re.search(r'^Pages:\s+(\d+)',info,re.M)[1])
            if count>500: raise ValueError('page_limit_requires_separate_review')
            run(['pdftoppm','-r','180','-png',str(src),str(work/'page')])
            images=sorted(work.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
        else:
            from PIL import Image,ImageOps
            image=ImageOps.exif_transpose(Image.open(src)).convert('RGB'); image.save(work/'page-1.png'); images=[work/'page-1.png']; count=1
        pages=[]; confidences=[]; blank=[]; chars=0; partial=False; angles=[]
        for n,image in enumerate(images,1):
            candidates=[]
            for angle in ([0,90,180,270] if rotations else [0]):
                out=work/f'ocr-{n}-{angle}'; candidate=image
                if angle:
                    from PIL import Image
                    candidate=work/f'rotated-{n}-{angle}.png';Image.open(image).rotate(angle,expand=True).save(candidate)
                run(['tesseract',str(candidate),str(out),'-l','por','--psm','3' if rotations else '1','--tessdata-dir',str(tessdata),'-c','tessedit_create_txt=1','-c','tessedit_create_tsv=1'])
                text=out.with_suffix('.txt').read_text().strip()
                rows=list(csv.DictReader(out.with_suffix('.tsv').open(),delimiter='\t'))
                score=sum(float(r['conf']) for r in rows if len(r.get('text','').strip())>=2 and float(r['conf'])>=70)
                candidates.append((score,angle,text,rows))
            _,angle,text,rows=max(candidates,key=lambda x:x[0]);angles.append({'page':n,'rotation_counterclockwise':angle,'selection':'highest sum of word confidence >=70' if rotations else 'tesseract automatic OSD'})
            conf=[float(r['conf']) for r in rows if r.get('text','').strip() and float(r['conf'])>=0]
            confidences.append({'page':n,'mean_word_confidence':round(sum(conf)/len(conf),3) if conf else None,'recognized_words':len(conf)})
            if not text: blank.append(n)
            if len(text)>100000-chars: text=text[:100000-chars];partial=True
            if text: pages.append({'page':n,'section':'OCR local; conferência do original obrigatória','text':text}); chars+=len(text)
            if chars>=100000: partial=True;break
        if chars<50: raise ValueError('insufficient_ocr_text')
        text='\n\n'.join(f"PÁGINA {p['page']}\n{p['text']}" for p in pages)
        counts={}
        stop=set('para como este esta esse essa pelo pela pelos pelas uma umas uns que com dos das aos nas nos são não seu sua seus suas mais entre sobre também documento documentos página páginas instituição curso ensino superior'.split())
        for w in re.findall(r'[^\W\d_]{4,}',text.lower()):
            if w not in stop: counts[w]=counts.get(w,0)+1
        return {'repository_file_id':row['id'],'source_sha256':digest,'extracted_text':text,'extracted_pages':pages,'extraction_method':'tesseract_local_ocr','extraction_status':'partial','keyword_suggestions':sorted(counts,key=lambda w:(-counts[w],w))[:20], 'extraction_metadata':{'ocr_applied':True,'ocr_review_required':True,'provider_transmission':False,'received_bytes':src.stat().st_size,'page_count':count,'characters':chars,'pages_without_text':blank,'truncated':partial,'confidence_by_page':confidences,'parser_version':run(['tesseract','--version']).splitlines()[0],'language':'por','language_sha256':sha(tessdata/'por.traineddata'),'orientation_sha256':sha(tessdata/'osd.traineddata'),'page_segmentation':'automatic_with_orientation_detection','render_dpi':180,'orientation_by_page':angles,'status_reason':'OCR reconhecido; revisão humana de fidelidade pendente'}}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('manifest',type=Path);ap.add_argument('output',type=Path);ap.add_argument('--tessdata',type=Path,required=True);ap.add_argument('--try-rotations',action='store_true');args=ap.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    def one(row):
        try:
            result=extract(row,args.tessdata,args.try_rotations);(args.output/(row['id']+'.json')).write_text(json.dumps(result,ensure_ascii=False));return {'id':row['id'],'status':'ocr_extracted_review_required','characters':result['extraction_metadata']['characters']}
        except Exception as e: return {'id':row['id'],'status':'failed','error':type(e).__name__+': '+str(e)[:200]}
    results=list(ThreadPoolExecutor(max_workers=2).map(one,json.loads(args.manifest.read_text())))
    (args.output/'receipt.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
if __name__=='__main__':main()
