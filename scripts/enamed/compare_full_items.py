#!/usr/bin/env python3
"""Compare complete F&O item snapshots with byte-verified, two-column Inep PDFs.

Offline and read-only. Differences are extraction/editorial findings, not clinical
judgments. No score, answer, alias or publication approval is produced.
"""
import argparse
import collections
import difflib
import hashlib
import json
import pathlib
import re
import unicodedata


def digest(value):
    if not isinstance(value, bytes):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True).encode()
    return hashlib.sha256(value).hexdigest()


def normalize(text):
    # Preserve decimal points, minus signs, units, negation and clinical symbols.
    text = unicodedata.normalize('NFKC', text).replace('\u00ad', '')
    return re.sub(r'\s+', ' ', text).strip()


def compare(official, stored):
    a, b = normalize(official), normalize(stored)
    # Token positions refer to the complete normalized string, never a prefix.
    ta, tb = re.findall(r'\w+|[^\w\s]', a), re.findall(r'\w+|[^\w\s]', b)
    opcodes = difflib.SequenceMatcher(None, ta, tb, autojunk=False).get_opcodes()
    differences = [dict(operation=tag, official_range=[i,j], stored_range=[k,l],
                        official_excerpt=' '.join(ta[i:j])[:160],
                        stored_excerpt=' '.join(tb[k:l])[:160],
                        official_token_count=j-i, stored_token_count=l-k)
                   for tag,i,j,k,l in opcodes if tag != 'equal']
    nums = lambda s: re.findall(r'(?<!\w)[−–-]?\d+(?:[.,]\d+)*(?:%|‰)?', s)
    return dict(official_text_sha256=digest(official), stored_text_sha256=digest(stored),
                official_chars=len(official), stored_chars=len(stored),
                whitespace_equivalent=a == b, token_equivalent=ta == tb,
                numeric_sequence_equal=nums(a) == nums(b),
                official_numbers=nums(a), stored_numbers=nums(b),
                differences=differences)


def extract_booklet(path, expected_hash):
    import fitz
    if digest(path.read_bytes()) != expected_hash:
        raise ValueError('Official PDF hash mismatch: ' + str(path))
    doc = fitz.open(path)
    items, images, current, page_columns = {}, [], None, {}
    # Physical page 3 is first question page. Ignore cover and perception survey.
    for page_idx in range(2, len(doc)):
        page = doc[page_idx]
        markers=[w for w in page.get_text('words') if w[4]=='QUESTÃO']
        wide=not any(w[0]>=page.rect.width/2 for w in markers)
        page_columns[page_idx+1]=1 if wide else 2
        bottom=page.rect.height-25
        halves = [fitz.Rect(0,55,page.rect.width,bottom)] if wide else [
            fitz.Rect(0,55,page.rect.width/2,bottom),
            fitz.Rect(page.rect.width/2,55,page.rect.width,bottom)]
        for column, clip in enumerate(halves):
            lines=[]
            for block in page.get_text('dict', clip=clip)['blocks']:
                if block['type'] != 0:
                    continue
                for line in block['lines']:
                    txt=''.join(s['text'] for s in line['spans']).strip()
                    if txt and txt != 'ÁREA LIVRE':
                        lines.append((line['bbox'][1],line['bbox'][0],txt,line['bbox']))
            lines.sort(key=lambda l: (round(l[0],1),l[1]))
            for y,x,txt,bbox in lines:
                marker=re.fullmatch(r'QUESTÃO\s+(\d+)',txt)
                if marker:
                    n=int(marker[1])
                    if n > 100 or (current == 100 and n < 100):
                        current=None
                        break
                    if n in items:
                        raise ValueError(f'Duplicate question marker {n} in {path}')
                    current=n
                    items[n]=dict(number=n,page=page_idx+1,column=column,
                                  marker_bbox=list(bbox),lines=[],regions=[])
                elif current is not None:
                    items[current]['lines'].append(txt)
                    items[current]['regions'].append([page_idx+1,column,*bbox])
            if current is None and 100 in items:
                break
        if current is None and 100 in items:
            break
    if set(items) != set(range(1,101)):
        raise ValueError(f'Expected exactly 100 numbered items: {path}: {len(items)}')
    for n,item in items.items():
        text='\n'.join(item.pop('lines'))
        parts=re.split(r'(?m)^\(([ABCD])\)\s*',text)
        item['stem']=parts[0].strip()
        item['alternatives']={parts[i]:parts[i+1].strip() for i in range(1,len(parts)-1,2)}
        item['extraction_complete']=len(parts)==9 and set(item['alternatives'])==set('ABCD')
        # A region locates every extracted line; bounding boxes are not a rendered
        # table or medical image equivalence certificate.
    for page_idx in range(2,len(doc)):
        for info in doc[page_idx].get_image_info(xrefs=True):
            bbox=info['bbox'];center=((bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2)
            candidates=[]
            for n,item in items.items():
                image_column=0 if page_columns.get(page_idx+1)==1 else int(center[0]>=doc[page_idx].rect.width/2)
                same=[r for r in item['regions'] if r[0]==page_idx+1 and r[1]==image_column]
                if not same:
                    continue
                start=item['marker_bbox'][1] if item['page']==page_idx+1 and item['column']==same[0][1] else 55
                # Only images following this question's marker and preceding the
                # next marker in the same column can be suggested.
                later=[v['marker_bbox'][1] for v in items.values() if v['page']==page_idx+1 and v['column']==same[0][1] and v['marker_bbox'][1]>start]
                end=min(later,default=790)
                if start <= center[1] < end:
                    candidates.append(n)
            if not candidates:
                continue  # Cover, logos and survey images have no question region.
            xref=info.get('xref',0)
            raw=doc.extract_image(xref) if xref else None
            images.append(dict(page=page_idx+1,bbox=list(bbox),xref=xref,
                               candidate_questions=candidates,
                               image_sha256=digest(raw['image']) if raw else None,
                               image_bytes=len(raw['image']) if raw else None,
                               extension=raw['ext'] if raw else None,
                               association_status='GEOMETRIC_PROPOSAL_REQUIRES_VISUAL_REVIEW'))
    return items, images


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--corpus',type=pathlib.Path,required=True)
    p.add_argument('--snapshot',type=pathlib.Path,required=True)
    p.add_argument('--output',type=pathlib.Path,required=True)
    p.add_argument('--extraction-output',type=pathlib.Path,required=True)
    args=p.parse_args()
    root=pathlib.Path(__file__).resolve().parents[2]
    manifest=json.loads((root/'docs/enamed/INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json').read_text())
    docs={d['id']:d for d in manifest['documents']}
    corpus={};media={}
    for key in ['REG-C1','REG-C2','REAP-C1','REAP-C2']:
        path=next(args.corpus.glob(key.lower()+'_*.pdf'))
        corpus[key],media[key]=extract_booklet(path,docs[key]['sha256'])
    rows=json.loads(args.snapshot.read_text());results=[]
    if len(rows)!=483 or len({r['id'] for r in rows})!=483:
        raise ValueError('Expected complete 483-ID snapshot')
    for row in rows:
        key=next((k for k in corpus if docs[k]['official_url']==row['source_url']),None)
        if key is None:
            raise ValueError('Unmapped source: '+str(row['source_url']))
        q=corpus[key][row['question_number']]
        options={letter:compare(q['alternatives'].get(letter,''),row['alternatives'].get(letter,'')) for letter in 'ABCD'}
        images=[m for m in media[key] if row['question_number'] in m['candidate_questions']]
        stem=compare(q['stem'],row['stem'])
        equal=stem['token_equivalent'] and all(v['token_equivalent'] for v in options.values())
        results.append(dict(id=row['id'],source_url=row['source_url'],source_pdf_sha256=docs[key]['sha256'],
            edition=row['exam_year'],application=docs[key]['application'],booklet=key,question_number=q['number'],
            physical_page=q['page'],column=q['column'],marker_bbox=q['marker_bbox'],
            snapshot_item_sha256=digest(row),stem=stem,alternatives=options,
            answer_key_in_snapshot=row['answer_key'],answer_status_in_snapshot=row['official_answer_status'],
            answer_document_status='PRELIMINARY_ONLY_SEPARATE_RECONCILIATION_ALREADY_RECORDED',
            source_page_in_snapshot=row['source_page'],source_hash_in_snapshot=row['source_hash'],
            source_page_matches=row['source_page']==q['page'],essential_media_candidates=images,
            structured_blocks_count=len(row['blocks'] or []),usage_rights_in_snapshot=row['usage_rights'],
            status='CONCLUÍDA',comparison_scope='FULL_EXTRACTED_STEM_AND_ALL_FOUR_OPTIONS',
            editorial_result='EXTRACTION_TOKEN_EQUIVALENT_REQUIRES_HUMAN_REVIEW' if equal else 'DIFFERENCES_REQUIRE_EDITORIAL_AND_EXTRACTION_REVIEW',
            extraction_complete=q['extraction_complete'],clinical_approval=False,publication_allowed=False))
    coverage=[]
    for key in corpus:
        present={r['question_number'] for r in results if r['booklet']==key}
        coverage.append(dict(booklet=key,present_positions=len(present),missing_positions=sorted(set(range(1,101))-present)))
    report=dict(schema_version='enamed-full-text-diff-v1',snapshot_sha256=digest(args.snapshot.read_bytes()),
        original_manifest='INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json',
        method='Two-column PDF text-layer extraction; complete Unicode NFKC/whitespace-preserving numeric/punctuation token diff; no similarity threshold approves an item.',
        limits=['Text-layer extraction is not visual or clinical validation.','Tables, superscripts and reading order require visual confirmation.','No final answer keys, medical or dual-AI approval.','No production changes.'],
        totals=dict(records=len(results),full_fields_compared=483*5,
                    token_equivalent=sum(r['editorial_result'].startswith('EXTRACTION_TOKEN') for r in results),
                    extraction_complete=sum(r['extraction_complete'] for r in results)),
        coverage=coverage,items=results)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    args.extraction_output.write_text(json.dumps(dict(items=corpus,media=media),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(totals=report['totals'],images={k:len(v) for k,v in media.items()},coverage=coverage)))


if __name__=='__main__':
    main()
