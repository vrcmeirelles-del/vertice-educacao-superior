import unittest
from unittest.mock import patch
from scanner import classify, validate_url, scan_document


class ScannerTests(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(classify(0, "/tmp/document: OK\n")["status"], "clean")

    def test_detection(self):
        self.assertEqual(classify(1, "/tmp/document: Win.Test FOUND\n")["status"], "infected")

    def test_errors_never_clean(self):
        for code, text in [(0, ""), (2, "error"), (1, "unexpected"), (2, "x: OK")]:
            self.assertEqual(classify(code, text)["status"], "failed")

    def test_limits_and_encryption_not_virus(self):
        for name in ["Heuristics.Limits.Exceeded", "Heuristics.Encrypted.Zip"]:
            self.assertEqual(classify(1, f"file: {name} FOUND\n")["status"], "unscannable")

    def test_restricted_url(self):
        base = "https://qvetbbmviatxxatzzuzc.supabase.co/storage/v1/object/sign/vertice-repositorios/a/b?token=x"
        validate_url(base)
        for url in [base.replace("https:", "http:"), base.replace(".supabase.co/", ".supabase.co.evil/"),
                    base.replace("vertice-repositorios", "other"), base.replace("/a/b", "/../b"), base.split("?")[0]]:
            with self.assertRaises(ValueError):
                validate_url(url)

    @patch("scanner.update_signatures", return_value=False)
    def test_no_stale_scan(self, _):
        result = scan_document("https://qvetbbmviatxxatzzuzc.supabase.co/storage/v1/object/sign/vertice-repositorios/a/b?token=x", "a" * 64)
        self.assertEqual(result, {"status": "failed", "reason": "signature_update_failed"})


if __name__ == "__main__":
    unittest.main()
