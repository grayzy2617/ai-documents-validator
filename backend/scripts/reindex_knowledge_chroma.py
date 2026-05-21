"""
Xóa Chroma local và nạp lại toàn bộ tài liệu từ bảng knowledge_documents (plain text + chunk luật).

Chạy từ thư mục backend (để import đúng):
  cd backend
  python scripts/reindex_knowledge_chroma.py

Sau khi đổi EMBEDDING_MODEL / đổi logic chunk, cần chạy script này rồi kiểm tra lại tra cứu RAG.
"""
from __future__ import annotations

import os
import sys

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from database import SessionLocal  # noqa: E402
import models  # noqa: E402
from document_processor import extract_plain_text  # noqa: E402
from vector_store import add_document_to_db, get_chroma_db_dir, wipe_chroma_dir  # noqa: E402


def main() -> None:
    print(f"Thu muc Chroma: {get_chroma_db_dir()}")
    print("Neu bao WinError 32: tat uvicorn (Ctrl+C) roi chay lai script.")
    wipe_chroma_dir()

    db = SessionLocal()
    try:
        docs = (
            db.query(models.KnowledgeDocument)
            .filter(models.KnowledgeDocument.is_active.is_(True))
            .order_by(models.KnowledgeDocument.id.asc())
            .all()
        )
        ok, skip = 0, 0
        for d in docs:
            path = d.file_path
            if not path or not os.path.isfile(path):
                print(f"[skip] id={d.id} không có file: {path}")
                skip += 1
                continue
            try:
                text = extract_plain_text(path)
            except Exception as e:
                print(f"[skip] id={d.id} lỗi trích xuất: {e}")
                skip += 1
                continue
            if not (text or "").strip():
                print(f"[skip] id={d.id} text rỗng: {path}")
                skip += 1
                continue
            source = os.path.basename(path)
            meta = {
                "title": d.title,
                "document_type": d.document_type,
                "source": source,
                "access_level": d.access_level or "GIAO_VIEN",
            }
            add_document_to_db(text, meta)
            ok += 1
            print(f"[ok] id={d.id} source={source}")
        print(f"Hoàn tất: {ok} tài liệu nạp lại, {skip} bỏ qua.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
