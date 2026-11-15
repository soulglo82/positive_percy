#!/usr/bin/env python3
"""Reconstruct exact Positive Percy Stage 1 brand pack from Git-tracked base64 chunks.

Stdlib only; does not contact networks, change application code or deploy.
"""
from __future__ import annotations

import base64
import hashlib
import io
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ARCHIVES = ROOT / "design" / "brand" / "archives"
OUT = ROOT / "design" / "brand" / "library"
SHA256 = "e7e93dde728048cb03ba78a1f761cc221af184bfda3bdd4234f7fd3df61f3638"
EXPECTED_PARTS = 36
EXPECTED_FILES = 150

def main() -> int:
    parts = sorted(ARCHIVES.glob("Positive_Percy_Stage1_Brand_Pack.zip.b64.part-*"))
    if len(parts) != EXPECTED_PARTS or [p.name[-3:] for p in parts] != [f"{i:03d}" for i in range(EXPECTED_PARTS)]:
        raise SystemExit(f"Expected {EXPECTED_PARTS} sequential asset chunks; found {len(parts)}")
    payload = "".join(p.read_text(encoding="ascii").strip() for p in parts)
    archive = base64.b64decode(payload, validate=True)
    digest = hashlib.sha256(archive).hexdigest()
    if digest != SHA256:
        raise SystemExit(f"Invalid asset archive SHA256: {digest} (expected {SHA256})")
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        members = [m for m in z.infolist() if not m.is_dir()]
        if len(members) != EXPECTED_FILES:
            raise SystemExit(f"Expected {EXPECTED_FILES} ZIP files; got {len(members)}")
        bad = z.testzip()
        if bad:
            raise SystemExit(f"Corrupted ZIP member: {bad}")
        for m in z.infolist():
            pp = Path(m.filename)
            if pp.is_absolute() or ".." in pp.parts or not pp.parts or pp.parts[0] != "Positive_Percy_Stage1_Brand_System":
                raise SystemExit(f"Unsafe ZIP member: {m.filename}")
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "Positive_Percy_Stage1_Brand_Pack.zip").write_bytes(archive)
        z.extractall(OUT)
    print(f"OK: SHA256 {digest}, {EXPECTED_FILES} files unpacked into {OUT}")
    return 0

if __name__ == "__main__":
    sys.exit(main())