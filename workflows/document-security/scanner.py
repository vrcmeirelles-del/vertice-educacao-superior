"""Fail-closed document scanning. No user filenames, contents or URLs in logs."""
import hashlib
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from urllib.request import build_opener, HTTPRedirectHandler

HOST = "qvetbbmviatxxatzzuzc.supabase.co"
BUCKETS = {"vertice-repositorios", "vertice-aquisicoes-cofre", "vertice-dre"}
MAX_BYTES = 30 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("redirect_not_allowed")


def validate_url(url):
    p = urlsplit(url)
    prefix = "/storage/v1/object/sign/"
    if (p.scheme != "https" or p.hostname != HOST or p.port not in (None, 443)
            or p.username or p.password or p.fragment or not p.path.startswith(prefix)):
        raise ValueError("invalid_source")
    parts = unquote(p.path[len(prefix):]).split("/")
    if parts[0] not in BUCKETS or len(parts) < 2 or any(s in (".", "..", "") for s in parts):
        raise ValueError("invalid_source")
    if not parse_qs(p.query).get("token"):
        raise ValueError("missing_signature")


def classify(code, output):
    if code == 0 and output.rstrip().endswith(": OK"):
        return {"status": "clean", "reason": "no_threat_detected"}
    if code == 1:
        match = re.search(r": (.+) FOUND(?:\n|$)", output)
        if match:
            signature = match.group(1)
            # Encrypted content, parser limits and heuristic suspicions are NOT proof of infection.
            if signature.startswith("Heuristics."):
                return {"status": "unscannable", "reason": "analysis_incomplete"}
            return {"status": "infected", "reason": "threat_detected", "signature": signature[:160]}
    return {"status": "failed", "reason": "scanner_error"}


def scan_path(path):
    try:
        result = subprocess.run([
            "clamscan", "--no-summary", "--stdout", "--max-filesize=30M",
            "--max-scansize=128M", "--max-files=1000", "--max-recursion=20",
            "--alert-exceeds-max=yes", "--alert-encrypted=yes", str(path)
        ], capture_output=True, text=True, timeout=120, check=False)
        return classify(result.returncode, result.stdout)
    except (OSError, subprocess.TimeoutExpired):
        return {"status": "failed", "reason": "scanner_unavailable"}


def update_signatures():
    try:
        # Never scan using silently stale definitions if an update cannot be checked.
        result = subprocess.run(["freshclam", "--stdout"], capture_output=True, timeout=120)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def scan_document(url, expected_sha256):
    try:
        validate_url(url)
        if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
            raise ValueError("invalid_digest")
    except (ValueError, TypeError):
        return {"status": "failed", "reason": "invalid_request"}
    if not update_signatures():
        return {"status": "failed", "reason": "signature_update_failed"}
    try:
        with tempfile.TemporaryDirectory(prefix="scan-") as directory:
            path = Path(directory) / "document"
            digest, size = hashlib.sha256(), 0
            with build_opener(NoRedirect).open(url, timeout=30) as response, path.open("wb") as out:
                while chunk := response.read(64 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        return {"status": "unscannable", "reason": "size_limit"}
                    digest.update(chunk)
                    out.write(chunk)
            if size == 0 or digest.hexdigest() != expected_sha256:
                return {"status": "failed", "reason": "content_mismatch"}
            result = scan_path(path)
            return {**result, "sha256": digest.hexdigest(), "engine": "ClamAV"}
    except Exception:
        return {"status": "failed", "reason": "download_failed"}


def self_test():
    if not update_signatures():
        raise RuntimeError("signature_update_failed")
    with tempfile.TemporaryDirectory(prefix="selftest-") as directory:
        path = Path(directory) / "test"
        path.write_text("Documento de teste da Vertice. Nenhum dado pessoal.")
        clean = scan_path(path)
        # Harmless standard antivirus test string, constructed only during the test.
        path.write_bytes(b"X5O!P%@AP[4\\PZX54(P^)7CC)7}" + b"$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
        detected = scan_path(path)
    if clean["status"] != "clean" or detected["status"] != "infected":
        raise RuntimeError("scanner_self_test_failed")
    return {"clean_file": "clean", "eicar_test": "infected", "engine": "ClamAV", "passed": True}
