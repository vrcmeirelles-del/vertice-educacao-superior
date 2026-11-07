import importlib.util
import json
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "unitop_primeira_matricula_nominal.py"
spec = importlib.util.spec_from_file_location("unitop_primeira", SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def row(person, course, term, status="MATRICULADO", **other):
    return {
        "pessoa_id": person,
        "curso_id": course,
        "semestre": term,
        "situacao": status,
        "instituicao": "UNITOP",
        **other
    }


class PrimeiraMatriculaTests(unittest.TestCase):
    def test_repeticao_turma_grade_nao_duplica(self):
        registros = [row("S-001-UNICO", "10", "2025/01"),
                     row("S-001-UNICO", "10", "2025/01"),
                     row("S-001-UNICO", "10", "2025/02"),
                     row("S-002", "10", "2025/02")]
        report = m.aggregate(registros, identity_mode="id_estavel")
        values = {(x["curso_chave"], x["semestre"]): x for x in report["por_curso_semestre"]}
        self.assertEqual(values["ID:10", "2025/01"]["primeira_matricula_no_curso"], 1)
        self.assertEqual(values["ID:10", "2025/02"]["primeira_matricula_no_curso"], 1)
        self.assertEqual(values["ID:10", "2025/02"]["alunos_unicos_matriculados"], 2)
        self.assertEqual(report["pessoas_unicas_com_matricula_confirmada"], 2)
        self.assertEqual(report["problemas_e_exclusoes"]["repeticao_mesma_pessoa_curso_semestre"], 1)
        self.assertNotIn("S-001-UNICO", json.dumps(report))

    def test_reingresso_ou_transferencia_nao_soma_novo_na_ies(self):
        registros = [
            row("A", "DIREITO-ID", "2024/01"),
            row("A", "ENFERMAGEM-ID", "2025/01"),
            row("A", "ENFERMAGEM-ID", "2025/02"),
            row("B", "ENFERMAGEM-ID", "2025/01"),
        ]
        report = m.aggregate(registros, identity_mode="id_estavel")
        idx = {(x["curso_chave"], x["semestre"]): x for x in report["por_curso_semestre"]}
        self.assertEqual(idx["ID:ENFERMAGEM-ID", "2025/01"]["primeira_matricula_no_curso"], 2)
        self.assertEqual(idx["ID:ENFERMAGEM-ID", "2025/01"]["primeira_matricula_na_ies_atribuida_ao_curso"], 1)
        self.assertEqual(report["pessoas_em_multiplos_cursos"], 1)

    def test_primeiro_semestre_com_duas_matriculas_em_cursos(self):
        report = m.aggregate([row("A", "10", "2025/01"), row("A", "20", "2025/01")],
                             identity_mode="id_estavel")
        self.assertEqual(report["primeira_matricula_na_ies_por_semestre"],
                         [{"semestre": "2025/1", "pessoas": 1, "sem_atribuicao_unica_de_curso": 1}])
        self.assertEqual(sum(c["primeira_matricula_no_curso"] for c in report["por_curso_semestre"]), 2)
        self.assertEqual(sum(c["primeira_matricula_na_ies_atribuida_ao_curso"] for c in report["por_curso_semestre"]), 0)

    def test_pre_matricula_nao_e_matricula_efetiva(self):
        report = m.aggregate([row("A", "10", "2025/01", "PRÉ-MATRICULADO"),
                              row("A", "10", "2025/02", "MATRICULADO")],
                             identity_mode="id_estavel")
        self.assertEqual(report["primeira_matricula_na_ies_por_semestre"][0]["semestre"], "2025/2")
        self.assertEqual(report["problemas_e_exclusoes"]["status_nao_confirmado"], 1)

    def test_aluno_sem_identidade_inequivoca_nao_entra(self):
        report = m.aggregate([row("", "10", "2025/01"), row("A", "", "2025/01"),
                              row("A", "10", "2025/01")], identity_mode="id_estavel")
        self.assertEqual(report["pessoas_unicas_com_matricula_confirmada"], 1)
        self.assertEqual(report["problemas_e_exclusoes"]["identidade_ausente_ou_invalida"], 1)
        self.assertEqual(report["problemas_e_exclusoes"]["curso_sem_identificador_inequivoco"], 1)

    def test_sem_cpf_nao_usa_matricula_como_substituto(self):
        report = m.aggregate([{"matricula": "00001", "curso_id": "10",
                               "semestre": "2025/01", "situacao": "MATRICULADO"}])
        self.assertEqual(report["pessoas_unicas_com_matricula_confirmada"], 0)
        self.assertEqual(report["problemas_e_exclusoes"]["identidade_ausente_ou_invalida"], 1)

    def test_nao_certificar_sem_cobertura_historica(self):
        report = m.aggregate([row("A", "10", "2025/01")], identity_mode="id_estavel")
        self.assertIn("SEM_COMPLETUDE", report["qualificacao"])
        self.assertEqual(report["situacao"], "HOMOLOGACAO_MANUAL_OBRIGATORIA")

    def test_curso_reutilizado_requer_id_ou_autorizacao_explicita(self):
        report = m.aggregate([{"pessoa_id": "A", "curso_codigo": "027",
                               "semestre": "2025/01", "situacao": "MATRICULADO"}],
                             identity_mode="id_estavel")
        self.assertEqual(report["pessoas_unicas_com_matricula_confirmada"], 0)
        self.assertEqual(report["problemas_e_exclusoes"]["curso_sem_identificador_inequivoco"], 1)

    def test_historico_com_status_distintos_sinaliza_conflito(self):
        report = m.aggregate([row("A", "10", "2025/01"),
                              row("A", "10", "2025/01", "TRANCADO")],
                             identity_mode="id_estavel")
        self.assertEqual(report["conflitos_de_status_mesma_pessoa_curso_semestre"], 1)

    def test_nao_misturar_ies(self):
        report = m.aggregate([row("A", "10", "2025/01"),
                              row("B", "10", "2025/01", instituicao="UNICALDAS")],
                             identity_mode="id_estavel")
        self.assertEqual(report["pessoas_unicas_com_matricula_confirmada"], 1)
        self.assertEqual(report["problemas_e_exclusoes"]["instituicao_diferente"], 1)


if __name__ == "__main__":
    unittest.main()
