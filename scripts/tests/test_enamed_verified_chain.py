import importlib.util
import pathlib
import ssl
import unittest

SCRIPT=pathlib.Path(__file__).resolve().parents[1] / "enamed" / "download_inep_verified_chain.py"
spec=importlib.util.spec_from_file_location("verified_chain",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CertificateTrustContract(unittest.TestCase):
    def test_issuer_host_and_path_are_restricted(self):
        self.assertTrue(module.safe_issuer("http://secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt"))
        self.assertFalse(module.safe_issuer("http://not-globalsign.example/cacert/ca.crt"))
        self.assertFalse(module.safe_issuer("http://secure.globalsign.com/other/ca.crt"))
        self.assertFalse(module.safe_issuer("http://secure.globalsign.com@attacker.example/cacert/a.crt"))
    def test_pdf_host_path_and_tls_required_before_network(self):
        ctx=ssl.create_default_context()
        for url in (
            "http://download.inep.gov.br/enamed/provas_e_gabaritos/2026_caderno_1.pdf",
            "https://wrong.example/enamed/provas_e_gabaritos/2026_caderno_1.pdf",
            "https://download.inep.gov.br/admin/private.pdf",
            "https://download.inep.gov.br/enamed/provas_e_gabaritos/item.zip",
        ):
            with self.subTest(url=url), self.assertRaises(ValueError):
                module.source_request(url,ctx)
    def test_root_verification_and_strict_tls_explicit_in_source(self):
        script=SCRIPT.read_text(encoding="utf8")
        self.assertIn('"openssl","verify"',script)
        self.assertIn('"-verify_hostname",HOST',script)
        self.assertIn('"-CAfile",str(ROOTS)',script)
        self.assertIn('ssl.create_default_context(cafile=str(bundle))',script)
        for unsafe in ("_create_unverified_context","ignore_https_errors=True","verify=False","-k --", "CERT_NONE"):
            self.assertNotIn(unsafe,script)

if __name__=="__main__":unittest.main()
