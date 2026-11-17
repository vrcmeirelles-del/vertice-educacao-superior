import importlib.util
import pathlib
import tempfile
import unittest

SCRIPT=pathlib.Path(__file__).resolve().parents[1] / "enamed" / "verify_inep_artifacts.py"
spec=importlib.util.spec_from_file_location("verifier",SCRIPT)
verifier=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

class VerifyInepAssetsTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.base=pathlib.Path(self.tmp.name)
  (self.base/"synthetic.pdf").write_bytes(b"%PDF-1.4\\nsynthetic test fixture\\n%%EOF\\n")
  self.item={"id":"TEST-SYNTHETIC","url":"https://download.inep.gov.br/example.pdf",
       "path":"synthetic.pdf","edition":"2026","kind":"prova","status":"preliminar"}
 def tearDown(self): self.tmp.cleanup()
 def test_hash_includes_file_length_and_fails_closed(self):
  result=verifier.verify_record(self.item,self.base)
  self.assertEqual(len(result["sha256"]),64)
  self.assertEqual(result["verification_level"],"BYTE_INTEGRITY_ONLY_NOT_OFFICIAL_AUTHENTICATION")
  self.assertEqual(result["review_state"],"PENDING_HUMAN_SOURCE_AND_EDITION_CONFIRMATION")
 def test_blocks_nonofficial_url(self):
  item={**self.item,"url":"https://other.example.com/forged.pdf"}
  with self.assertRaises(ValueError):verifier.verify_record(item,self.base)
 def test_blocks_directory_traversal(self):
  item={**self.item,"path":"../synthetic.pdf"}
  with self.assertRaises(ValueError):verifier.verify_record(item,self.base)
 def test_blocks_invalid_pdf(self):
  (self.base/"synthetic.pdf").write_bytes(b"NOT_A_PDF")
  with self.assertRaises(ValueError):verifier.verify_record(self.item,self.base)

if __name__=="__main__":unittest.main()
