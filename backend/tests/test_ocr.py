"""
Test OCR — PDF scan fallback (EasyOCR).

Chạy nhanh (không tải model):
  pytest tests/test_ocr.py -m "not slow" -v

Chạy đủ (gồm 30.signed.pdf, lần đầu tải model EasyOCR):
  pytest tests/test_ocr.py -v
"""
import os
import pytest

from document_processor import extract_text_from_pdf, extract_text_from_docx
from ocr_service import OCR_MIN_TEXT_THRESHOLD, needs_ocr_fallback, ocr_pdf_pages

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_PROJECT_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, ".."))
PDF_ND30 = os.path.join(_PROJECT_ROOT, "ground_truth_data", "30.signed.pdf")
PDF_SCAN_EMPTY = os.path.join(_PROJECT_ROOT, "ground_truth_data", "54_-_Quy_che_thi_dua_GVCN_1baba.pdf")
DOCX_SAMPLE = os.path.join(_PROJECT_ROOT, "ground_truth_data", "BIEN_BAN_HOP_TO_CHUYEN_MON_049b3.docx")


def _pdf_only(path: str):
    if not os.path.isfile(path):
        pytest.skip(f"Khong tim thay file: {path}")


@pytest.mark.parametrize("path", [PDF_ND30])
def test_ocr_01_pymupdf_alone_too_short(path):
    """OCR-01: PDF scan — PyMuPDF alone trả về ít hơn ngưỡng OCR."""
    _pdf_only(path)
    text = extract_text_from_pdf(path, use_ocr=False)
    assert len(text.strip()) < OCR_MIN_TEXT_THRESHOLD


@pytest.mark.slow
@pytest.mark.parametrize("path", [PDF_ND30])
def test_ocr_02_full_extract_nd30_exceeds_threshold(path):
    """OCR-02: Sau OCR, 30.signed.pdf phải có đủ text để đưa vào RAG."""
    _pdf_only(path)
    text = extract_text_from_pdf(path, use_ocr=True)
    assert len(text.strip()) >= OCR_MIN_TEXT_THRESHOLD
  # Nghị định 30 — kỳ vọng có từ khóa thể thức / văn bản
    lowered = text.lower()
    assert any(k in lowered for k in ("nghị định", "nghi dinh", "văn bản", "van ban", "thể thức", "the thuc"))


@pytest.mark.slow
@pytest.mark.parametrize("path", [PDF_SCAN_EMPTY])
def test_ocr_03_scanned_pdf_gets_text(path):
    """OCR-03: PDF scan khác (54 quy che) — OCR cũng trích xuất được text."""
    _pdf_only(path)
    plain = extract_text_from_pdf(path, use_ocr=False)
    assert len(plain.strip()) < OCR_MIN_TEXT_THRESHOLD

    with_ocr = extract_text_from_pdf(path, use_ocr=True)
    assert len(with_ocr.strip()) > len(plain.strip())


def test_ocr_04_docx_does_not_need_ocr():
    """OCR-04: DOCX có text đủ — không gọi OCR (chỉ test docx path)."""
    _pdf_only(DOCX_SAMPLE)
    text = extract_text_from_docx(DOCX_SAMPLE)
    assert len(text.strip()) >= OCR_MIN_TEXT_THRESHOLD
    assert not needs_ocr_fallback(text)


def test_ocr_05_needs_ocr_fallback_logic():
    """OCR-05: Hàm needs_ocr_fallback đúng ngưỡng."""
    assert needs_ocr_fallback("a" * (OCR_MIN_TEXT_THRESHOLD - 1))
    assert not needs_ocr_fallback("a" * (OCR_MIN_TEXT_THRESHOLD + 1))


@pytest.mark.slow
def test_ocr_06_ocr_pdf_pages_directly():
    """OCR-06: Gọi trực tiếp ocr_pdf_pages trên ND30."""
    _pdf_only(PDF_ND30)
    text = ocr_pdf_pages(PDF_ND30, max_pages=5)
    assert len(text.strip()) >= 100
