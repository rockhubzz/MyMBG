#!/usr/bin/env python3
"""Normalize SQL files to plain UTF-8 with LF line endings for psql.

Used by the postgres image build: the canonical dump is UTF-16 and patch
files may carry a UTF-8 BOM and/or CRLF line endings.
"""
from pathlib import Path

for path in Path("/seed").glob("*.sql"):
    raw = path.read_bytes()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = raw.decode("utf-16")
    else:
        text = raw.decode("utf-8-sig")
    text = text.replace("\r\n", "\n").replace("\r", "")
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"normalized {path.name}")
