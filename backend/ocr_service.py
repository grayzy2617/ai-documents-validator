"""
OCR fallback cho PDF scan (ảnh) khi PyMuPDF không trích xuất đủ text.
Dùng EasyOCR (vi + en), chạy local — không tốn token LLM.
"""
import io
import os
from typing import Optional

import fitz
import numpy as np

OCR_ENABLED = os.getenv("OCR_ENABLED", "true").lower() in ("1", "true", "yes")
OCR_MIN_TEXT_THRESHOLD = int(os.getenv("OCR_MIN_TEXT_THRESHOLD", "200"))
OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "30"))
OCR_ZOOM = float(os.getenv("OCR_ZOOM", "2.0"))

_ocr_reader = None


def get_ocr_reader():
    """Lazy-load EasyOCR (tải model lần đầu ~ vài trăm MB)."""
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(["vi", "en"], gpu=False, verbose=False)
    return _ocr_reader


def _page_to_numpy(page: fitz.Page, zoom: float = OCR_ZOOM) -> np.ndarray:
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return img


def ocr_pdf_pages(file_path: str, max_pages: Optional[int] = None) -> str:
    """
    OCR từng trang PDF (render ảnh → EasyOCR).
    """
    max_pages = max_pages if max_pages is not None else OCR_MAX_PAGES
    reader = get_ocr_reader()
    texts = []

    doc = fitz.open(file_path)
    try:
        page_count = min(len(doc), max_pages)
        for i in range(page_count):
            page = doc.load_page(i)
            img = _page_to_numpy(page)
            lines = reader.readtext(img, detail=0, paragraph=True)
            page_text = "\n".join(line.strip() for line in lines if line and line.strip())
            if page_text:
                texts.append(page_text)
    finally:
        doc.close()

    return "\n\n".join(texts)


def needs_ocr_fallback(text: str) -> bool:
    return OCR_ENABLED and len(text.strip()) < OCR_MIN_TEXT_THRESHOLD
