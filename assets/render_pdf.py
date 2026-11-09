# -*- coding: utf-8 -*-
"""Render a PDF to per-page PNGs and extract its text layer.

Usage: python render_pdf.py <pdf-path> <out-dir> <prefix> [max-pages]
Prints a single JSON line: {"pages": [...], "chars": <text length>}
"""
import json
import os
import sys

import fitz  # PyMuPDF


def main():
    pdf_path, out_dir, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
    max_pages = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    doc = fitz.open(pdf_path)
    os.makedirs(out_dir, exist_ok=True)
    pages = []
    for i in range(min(len(doc), max_pages)):
        pix = doc[i].get_pixmap(dpi=150)
        path = os.path.join(out_dir, f"{prefix}-p{i + 1}.png")
        pix.save(path)
        pages.append(path)
    text = "\n\n".join(doc[i].get_text() for i in range(len(doc)))
    with open(os.path.join(out_dir, prefix + ".txt"), "w", encoding="utf-8") as f:
        f.write(text)
    print(json.dumps({"pages": pages, "chars": len(text)}, ensure_ascii=False))


main()
