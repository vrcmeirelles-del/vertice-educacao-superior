#!/usr/bin/env python3
"""Apuração local e auditável de primeira matrícula por CPF e curso.

NÃO envia dados à rede e NÃO exporta CPF, nome, matrícula ou ID pessoal.
Sem histórico individual completo, o resultado é PRIMEIRO VÍNCULO OBSERVADO,
não ingresso institucional efetivo certificado.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ALLOWED_STATUS = {"MATRICULADO", "MATRICULADA"}
ALIAS = {
    "person": ("cpf", "cpf_aluno", "cpf_pessoa", "identificador_pessoa", "pessoa_id", "aluno_id"),
    "course": ("curso_id", "eorbit_curso_id", "id_curso", "codigo_curso", "curso_codigo", "cod_curso"),
    "period": ("semestre", "semestre_letivo", "periodo_letivo", "semestre_academico"),
    "status": ("situacao", "situacao_aluno", "status_aluno", "status", "status_matricula"),
    "institution": ("instituicao", "instituicao_id", "ies", "ies_id"),
    "modality": ("modalidade", "modalidade_curso"),
}


def norm(value: object) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(c for c in value if not unicodedata.combining(c)).strip().upper()


def headers(row: dict) -> dict:
    return {norm(k).lower().replace(" ", "_"): v for k, v in row.items()}


def pick(row: dict, field: str) -> str:
    for alias in ALIAS[field]:
        key = norm(alias).lower()
        v = row.get(key)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def semester(value: str) -> str:
    m = re.fullmatch(r"\s*(20\d{2}|19\d{2})\s*[/._-]\s*0?([12])\s*", str(value))
    return f"{m.group(1)}/{int(m.group(2)):02d}" if m else ""


def cpf_is_valid(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    for length in (9, 10):
        n = (sum(int(digits[i]) * (length + 1 - i) for i in range(length)) * 10) % 11
        if n == 10:
            n = 0
        if n != int(digits[length]):
            return False
    return True


def identity(value: str, mode: str) -> str:
    if mode == "cpf":
        return re.sub(r"\D", "", value) if cpf_is_valid(value) else ""
    if mode == "id_estavel":
        # Identificador já conciliado pela instituição, estável entre cursos e semestres.
        return value.strip() if value.strip() else ""
    raise ValueError("Modo de identidade inválido")


def course_key(row: dict, allow_code: bool) -> str:
    # ID e-ORBIT inequívoco tem precedência; não equiparar UUID ou códigos reutilizados.
    for name in ("curso_id", "eorbit_curso_id", "id_curso"):
        value = row.get(name)
        if value is not None and str(value).strip():
            return "ID:" + str(value).strip()
    if allow_code:
        code = pick(row, "course")
        modality = norm(pick(row, "modality"))
        if code:
            return "COD:" + norm(code) + "|MOD:" + modality
    return ""


def read_rows(path: Path):
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                yield row
    elif suffix == ".json":
        with path.open(encoding="utf-8") as stream:
            obj = json.load(stream)
        rows = obj if isinstance(obj, list) else (
            obj.get("alunos", obj.get("registros")) if isinstance(obj, dict) else None
        )
        if not isinstance(rows, list):
            raise ValueError("JSON não contém lista nominal 'alunos'/'registros'. Formulários não são registros de matrícula.")
        for row in rows:
            yield row
    elif suffix == ".xlsx":
        try:
            from openpyxl import load_workbook
        except ImportError as exc:
            raise RuntimeError("Para XLSX, instale openpyxl localmente.") from exc
        wb = load_workbook(path, read_only=True, data_only=True)
        try:
            for sheet in wb:
                iterator = sheet.iter_rows(values_only=True)
                try:
                    keys = next(iterator)
                except StopIteration:
                    continue
                if not keys:
                    continue
                names = [str(k).strip() if k is not None else "" for k in keys]
                if not any(norm(h).lower().replace(" ", "_") in
                           (x for group in ALIAS.values() for x in group) for h in names):
                    continue
                for values in iterator:
                    if any(v is not None and str(v).strip() for v in values):
                        yield dict(zip(names, values))
        finally:
            wb.close()
    else:
        raise ValueError("Formatos aceitos: CSV, JSON e XLSX.")


def aggregate(records, *, institution: str = "UNITOP",
              identity_mode: str = "cpf", allow_code: bool = False,
              historical_coverage_confirmed: bool = False) -> dict:
    """Só considera MATRICULADO. A identidade nunca é gravada no resultado."""
    errors = collections.Counter()
    rows_seen = 0
    # person -> {(course, semester)}; repetição entre grade e turma não soma alunos.
    active: dict[str, set[tuple[str, str]]] = collections.defaultdict(set)
    statuses: dict[tuple[str, str, str], set[str]] = collections.defaultdict(set)
    per_course = collections.defaultdict(set)
    per_semester = collections.defaultdict(set)
    all_courses = set()
    selected_ies = norm(institution)
    for raw in records:
        rows_seen += 1
        if not isinstance(raw, dict):
            errors["linha_estrutura_invalida"] += 1
            continue
        row = headers(raw)
        row_ies = pick(row, "institution")
        if row_ies and norm(row_ies) not in (selected_ies,):
            errors["instituicao_diferente"] += 1
            continue
        code = course_key(row, allow_code)
        term = semester(pick(row, "period"))
        person = identity(pick(row, "person"), identity_mode)
        status = norm(pick(row, "status")).replace(" ", "_")
        if not code:
            errors["curso_sem_identificador_inequivoco"] += 1
            continue
        all_courses.add(code)
        if not term:
            errors["semestre_invalido"] += 1
            continue
        if not person:
            errors["identidade_ausente_ou_invalida"] += 1
            continue
        statuses[(person, code, term)].add(status)
        if status not in ALLOWED_STATUS:
            errors["status_nao_confirmado"] += 1
            continue
        if (code, term) in active[person]:
            errors["repeticao_mesma_pessoa_curso_semestre"] += 1
        active[person].add((code, term))
        per_course[code].add(person)
        per_semester[term].add(person)

    course_first: dict[tuple[str, str], int] = collections.Counter()
    course_active: dict[tuple[str, str], int] = collections.Counter()
    first_ies: dict[str, int] = collections.Counter()
    first_ies_attributed: dict[tuple[str, str], int] = collections.Counter()
    ties: dict[str, int] = collections.Counter()
    multi_course = 0
    for person, entries in active.items():
        per_course_terms: dict[str, list[str]] = collections.defaultdict(list)
        for code, term in entries:
            course_active[(code, term)] += 1
            per_course_terms[code].append(term)
        for code, terms in per_course_terms.items():
            course_first[(code, min(terms))] += 1
        if len(per_course_terms) > 1:
            multi_course += 1
        first_term = min(term for _, term in entries)
        first_ies[first_term] += 1
        initial_courses = {code for code, term in entries if term == first_term}
        if len(initial_courses) == 1:
            first_ies_attributed[(next(iter(initial_courses)), first_term)] += 1
        else:
            ties[first_term] += 1

    conflicts = sum(1 for s in statuses.values() if len(s) > 1)
    keys = sorted(set(course_active) | set(course_first))
    courses = [
        {"curso_chave": code,
         "semestre": term,
         "alunos_unicos_matriculados": course_active[(code, term)],
         "primeira_matricula_no_curso": course_first[(code, term)],
         "primeira_matricula_na_ies_atribuida_ao_curso": first_ies_attributed[(code, term)]}
        for code, term in keys
    ]
    result = {
        "instituicao": institution,
        "situacao": "HOMOLOGACAO_MANUAL_OBRIGATORIA",
        "qualificacao": ("PRIMEIRO_VINCULO_OBSERVADO_EM_HISTORICO_DECLARADO_COMPLETO"
                          if historical_coverage_confirmed else "PRIMEIRO_VINCULO_OBSERVADO_SEM_COMPLETUDE_HISTORICA"),
        "regra": "Uma pessoa por curso e semestre; primeira matrícula no curso e na IES são métricas distintas.",
        "status_elegivel": sorted(ALLOWED_STATUS),
        "registros_lidos": rows_seen,
        "pessoas_unicas_com_matricula_confirmada": len(active),
        "codigos_de_curso_encontrados": len(all_courses),
        "cursos_com_matricula_confirmada": len(per_course),
        "pessoas_em_multiplos_cursos": multi_course,
        "conflitos_de_status_mesma_pessoa_curso_semestre": conflicts,
        "problemas_e_exclusoes": dict(sorted(errors.items())),
        "primeira_matricula_na_ies_por_semestre": [
            {"semestre": term, "pessoas": n,
             "sem_atribuicao_unica_de_curso": ties[term]}
            for term, n in sorted(first_ies.items())
        ],
        "por_curso_semestre": courses,
        "observacao": ("Resultados não alteram indicadores oficiais. Sem prova de exaustividade da "
                       "fonte histórica, NÃO declarar primeira matrícula efetiva definitiva.")
    }
    return result


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Apuração restrita de primeiro vínculo, sem exportação de CPF.")
    parser.add_argument("--entrada", required=True, nargs="+", type=Path, help="CSV, JSON ou XLSX nominal autorizado")
    parser.add_argument("--saida", required=True, type=Path, help="JSON agregado sem dados pessoais")
    parser.add_argument("--instituicao", default="UNITOP")
    parser.add_argument("--identificador", choices=["cpf", "id_estavel"], default="cpf")
    parser.add_argument("--aceitar-codigo-sem-id", action="store_true",
                        help="Só usar se o código de curso + modalidade for inequívoco em todo o histórico")
    parser.add_argument("--historico-completo-confirmado", action="store_true",
                        help="Operador atesta cobertura completa da trajetória institucional")
    parser.add_argument("--evidencia-cobertura", default="",
                        help="Referência documental da conferência da cobertura histórica")
    args = parser.parse_args()
    if args.historico_completo_confirmado and not args.evidencia_cobertura.strip():
        parser.error("Histórico completo requer --evidencia-cobertura.")
    paths = [p.resolve(strict=True) for p in args.entrada]
    def records():
        for p in paths:
            yield from read_rows(p)
    summary = aggregate(
        records(), institution=args.instituicao, identity_mode=args.identificador,
        allow_code=args.aceitar_codigo_sem_id,
        historical_coverage_confirmed=args.historico_completo_confirmado
    )
    if not summary["registros_lidos"] or not summary["pessoas_unicas_com_matricula_confirmada"]:
        parser.error("Fonte sem registros nominais confirmados; saída bloqueada para evitar apresentar zero indevido.")
    summary["fontes_sha256"] = [digest(p) for p in paths]
    summary["evidencia_cobertura"] = args.evidencia_cobertura if args.historico_completo_confirmado else None
    # Não gravar IDs pessoais, nomes ou matrículas; proteger arquivo agregado local.
    data = json.dumps(summary, ensure_ascii=False, indent=2)
    flags = 0o600
    import os
    fd = os.open(args.saida, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, flags)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write(data + "\n")
    print(json.dumps({
        "status": summary["situacao"],
        "identidades_com_vinculo": summary["pessoas_unicas_com_matricula_confirmada"],
        "cursos_com_vinculo": summary["cursos_com_matricula_confirmada"],
        "periodos_agregados": len(summary["primeira_matricula_na_ies_por_semestre"]),
        "problemas": summary["problemas_e_exclusoes"],
        "saida": str(args.saida)
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
