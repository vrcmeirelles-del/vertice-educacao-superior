"""Offline OPC discovery regression check, not a full OOXML schema validator.
Usage: python check-manifest-opc.py prepared.docx [personalized.docx ...]
Requires python-docx (validated with 1.2.0). Does not save or rewrite packages.
"""
import json
import sys
from zipfile import ZipFile
from docx import Document

for filename in sys.argv[1:]:
    package = Document(filename).part.package
    matches = [part for part in package.parts if str(part.partname) == '/vertice/template.json']
    assert len(matches) == 1, 'Manifest missing from OPC relationship graph'
    part = matches[0]
    assert part.content_type == 'application/json', 'Incorrect manifest content type'
    links = [rel for rel in package.rels.values()
             if rel.reltype == 'https://verticesuperior.com.br/relationships/document-template']
    assert len(links) == 1 and not links[0].is_external and links[0].target_part is part
    with ZipFile(filename) as archive:
        assert part.blob == archive.read('vertice/template.json')
    assert json.loads(part.blob)['classification'] == 'reviewed-template'
    print(filename, 'PASS: manifest discovered by independent OPC reader')
if len(sys.argv) < 2:
    raise SystemExit('Supply at least one DOCX path')
