#!/usr/bin/env python3
"""Verificador OFFLINE de arquivos INEP previamente obtidos por canal oficial.
Não baixa arquivos, não atesta autenticidade do domínio e não escreve no banco.
Requer manifesto JSON com records [{id,url,path,edition,kind,status}].
"""
from __future__ import annotations
import argparse, hashlib, json, pathlib, sys
from urllib.parse import urlsplit

ALLOWED_HOSTS={"download.inep.gov.br","www.gov.br"}
KINDS={"prova","gabarito","matriz","nota_tecnica","edital","manual","microdados","resultado"}
STATES={"preliminar","definitivo","nao_aplicavel","a_confirmar"}

def verify_record(record: dict, base: pathlib.Path) -> dict:
    required=("id","url","path","edition","kind","status")
    for key in required:
        if not isinstance(record.get(key),str) or not record[key].strip():
            raise ValueError("campo obrigatório ausente: "+key)
    u=urlsplit(record["url"])
    if u.scheme!="https" or u.hostname not in ALLOWED_HOSTS or u.username or u.password:
        raise ValueError("URL oficial não permitida")
    if record["kind"] not in KINDS or record["status"] not in STATES:
        raise ValueError("tipo/status de origem não reconhecido")
    candidate=pathlib.Path(record["path"])
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("caminho de arquivo deve permanecer dentro do diretório")
    p=(base/candidate).resolve()
    if not p.is_relative_to(base.resolve()) or not p.is_file():
        raise ValueError("arquivo não encontrado ou fora da pasta permitida")
    b=p.read_bytes()
    if not b or len(b)>250*1024*1024:
        raise ValueError("arquivo ausente ou acima do limite de 250 MB")
    suffix=p.suffix.lower()
    if suffix==".pdf" and (not b.startswith(b"%PDF-") or b"%%EOF" not in b[-2048:]):
        raise ValueError("assinatura/encerramento PDF inválidos")
    if suffix==".zip" and b[:4] != bytes((80,75,3,4)):
        raise ValueError("assinatura ZIP inválida")
    if suffix not in (".pdf",".zip",".xlsx",".ods",".csv",".txt"):
        raise ValueError("formato não permitido")
    return {
       "id":record["id"],"edition":record["edition"],"kind":record["kind"],
       "declared_status":record["status"],"official_url":record["url"],
       "filename":candidate.as_posix(),"bytes":len(b),
       "sha256":hashlib.sha256(b).hexdigest(),
       "verification_level":"BYTE_INTEGRITY_ONLY_NOT_OFFICIAL_AUTHENTICATION",
       "review_state":"PENDING_HUMAN_SOURCE_AND_EDITION_CONFIRMATION"
    }

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest",required=True)
    parser.add_argument("--base",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args()
    try:
        base=pathlib.Path(args.base).resolve()
        data=json.loads(pathlib.Path(args.manifest).read_text(encoding="utf-8"))
        if not isinstance(data,dict) or not isinstance(data.get("records"),list):
            raise ValueError("manifesto precisa conter records[]")
        ids=[x.get("id") for x in data["records"]]
        if len(ids)!=len(set(ids)): raise ValueError("IDs de documentos duplicados")
        verified=[verify_record(item,base) for item in data["records"]]
        report={"schema_version":"enamed-inep-byte-manifest-v1",
                "count":len(verified),"records":verified,
                "warning":"Hash comprova integridade dos bytes lidos, não autoria, versão definitiva ou validade jurídica."}
        pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+chr(10),encoding="utf-8")
        print(json.dumps({"count":len(verified),"status":"BYTE_HASHES_CREATED_ONLY"},ensure_ascii=False))
        return 0
    except (ValueError,OSError,KeyError,TypeError,json.JSONDecodeError) as err:
        print("VERIFICAÇÃO REPROVADA: "+str(err),file=sys.stderr)
        return 2
if __name__=="__main__": raise SystemExit(main())
