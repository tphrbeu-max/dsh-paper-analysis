# -*- coding: utf-8 -*-
"""从页面 PNG 中按归一化坐标裁剪题目区域。

用法: python crop_png.py <page.png> <x0> <y0> <x1> <y1> <out.png>
坐标为 0~1 的小数，相对于页面宽/高。输出放大 2 倍以保证清晰度。
"""
import sys
import json


def main():
    page_path, x0, y0, x1, y1, out_path = sys.argv[1:7]
    box = [float(x0), float(y0), float(x1), float(y1)]
    box = [min(max(v, 0.0), 1.0) for v in box]
    if box[2] - box[0] < 0.02 or box[3] - box[1] < 0.02:
        raise SystemExit("crop box too small")

    import fitz  # PyMuPDF
    doc = fitz.open(page_path)
    page = doc[0]
    rect = page.rect
    clip = fitz.Rect(rect.width * box[0], rect.height * box[1],
                     rect.width * box[2], rect.height * box[3])
    zoom = 2.0 if rect.width < 2000 else 1.0
    pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(zoom, zoom))
    pix.save(out_path)
    print(json.dumps({"ok": True, "out": out_path, "width": pix.width, "height": pix.height}))


if __name__ == "__main__":
    main()
