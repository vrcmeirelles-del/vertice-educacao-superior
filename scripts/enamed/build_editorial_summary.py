#!/usr/bin/env python3
"""Build the read-only portal summary from versioned evidence, without patient text."""
import argparse
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/enamed'
TARGET = ROOT / 'source-overrides/client/src/data/enamed-editorial-evidence.json'


def build():
    read = lambda name: json.loads((DOCS/name).read_text())
    audit = read('CONFRONTO_INTEGRAL_483_20261117.json')
    media = read('MIDIAS_VINCULOS_PREPARADOS_20261117.json')['records']
    missing = read('REAPLICACAO_17_CONFRONTO_COMPLETO_20261117.json')['records']
    primary = read('INEP_2026_SHA256_DOCUMENTOS_PRELIMINARES_20261117.json')
    normative = read('INEP_NORMAS_SHA256_20261117.json')
    gates = read('ENAMED_360_REGISTRO_GATES_PUBLICACAO.json')
    if len(audit['items']) != 483 or len({r['id'] for r in audit['items']}) != 483:
        raise ValueError('Incomplete or duplicate item audit')
    docs = [dict(id=d['id'],url=d['official_url'],sha256=d['sha256'],pages=d['pages'],
                 verified=True,kind=d['kind']) for d in primary['documents']]
    docs += [dict(id=d['id'],url=d['official_url'],sha256=d.get('sha256'),
                  pages=d.get('physical_pages'),verified=d.get('byte_hash_rechecked_locally',False),
                  kind='norma',error=d.get('error')) for d in normative['documents']]
    differences = []
    for item in audit['items']:
        if item['editorial_result'].startswith('EXTRACTION_TOKEN_EQUIVALENT'):
            continue
        differences.append(dict(id=item['id'],booklet=item['booklet'],number=item['question_number'],
            page=item['physical_page'],sourceUrl=item['source_url'],
            numericDifference=not item['stem']['numeric_sequence_equal'],
            stemDifferences=len(item['stem']['differences']),
            optionsWithDifferences=sum(not o['token_equivalent'] for o in item['alternatives'].values()),
            mediaCandidates=len(item['essential_media_candidates']),approved=False))
    candidates = []
    for item in missing:
        n = item['reap_caderno_1_question']
        source = next(d for d in docs if d['id']=='REAP-C1')
        candidates.append(dict(number=n,equivalentC2=item['reap_caderno_2_equivalent_question'],
            pageC1=item['c1_physical_page'],pageC2=item['c2_physical_page'],sourceUrl=source['url'],
            sourceHash=source['sha256'],contentHash=item['c1_extracted_content_sha256'],
            mediaCandidates=sum(n in m['candidate_questions'] for m in media if m['booklet']=='REAP-C1'),
            status='Pendente de curadoria',imported=False))
    return dict(schemaVersion=1,snapshotDate='2026-11-17',sourceCommit='7962db84420fe131c83aa31547c70f37b7bfe4ed',
        scope='Fotografia documental versionada; não é consulta atual ao banco.',
        totalRecords=len(audit['items']),tokenEquivalent=audit['totals']['token_equivalent'],
        differences=differences,candidates=candidates,mediaOccurrences=len(media),
        documents=docs,releaseBlocked=any(not c['approved'] for c in gates['conditions'].values()),
        approvedReleaseGates=sum(c['approved'] for c in gates['conditions'].values()),
        totalReleaseGates=len(gates['conditions']))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    content=json.dumps(build(),ensure_ascii=False,indent=2)+'\n'
    if args.check:
        if not TARGET.exists() or TARGET.read_text()!=content:
            raise SystemExit('Portal evidence is stale; run build_editorial_summary.py')
    else:
        TARGET.parent.mkdir(parents=True,exist_ok=True)
        TARGET.write_text(content)
    print('Portal evidence matches versioned source documents')


if __name__=='__main__':
    main()
