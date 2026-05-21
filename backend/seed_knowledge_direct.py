"""
Nạp trực tiếp ground_truth_data vào SQLite + ChromaDB (không qua HTTP).
Chạy: python seed_knowledge_direct.py
"""
import os
import sys
import shutil

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine
import models
from document_processor import extract_text
from vector_store import add_document_to_db

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ground_truth_data"))
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "ground_truth_data"))
SKIP_FILES = {"30.signed.pdf"}
ALLOWED_EXT = {".pdf", ".docx"}

TITLE_MAP = {
    "295_-_Quyet_dinh_ban_hanh_Hoc_ba_so_279f7.pdf": "Quyet dinh ban hanh Hoc ba so",
    "49_Quyet_dinh_Ve_viec_ban_hanh_Quy_dinh_noi_dung__chuongw_trinh_va_diem_cham_sinh_hoat_duoi_co_cac_lop_dau_tuan_nam_hoc_2025-2026_97580.pdf": "Quy dinh noi dung chuong trinh va diem cham sinh hoat",
    "54_-_Quy_che_thi_dua_GVCN_1baba.pdf": "Quy che thi dua GVCN",
    "BIEN_BAN_HOP_TO_CHUYEN_MON_049b3.docx": "Bien ban hop To chuyen mon",
    "Don_chuyen_truong__ngoai_tinh__22171.docx": "Don chuyen truong (ngoai tinh)",
    "DON_XIN_PHEP NGHI.docx": "Don xin phep nghi",
    "Mau_don_chuyen_truong_-_Trong_tinh_cc8f0.docx": "Mau don chuyen truong (trong tinh)",
    "Phu_luc_DANG_KY_CHI_TIEU_nam_hoc_197db.docx": "Phu luc dang ky chi tieu nam hoc",
}


def guess_doc_type(filename: str) -> str:
    return "Quy dinh / Quyet dinh" if filename.lower().endswith(".pdf") else "Bieu mau"


def main():
    models.Base.metadata.create_all(bind=engine)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    db = SessionLocal()
    ok, skip, fail = 0, 0, 0

    try:
        bgh = db.query(models.User).filter_by(username="bgh").first()
        if not bgh:
            print("Khong tim thay user bgh. Chay create_test_users.py truoc.")
            sys.exit(1)

        existing = {
            os.path.basename(d.file_path)
            for d in db.query(models.KnowledgeDocument).all()
        }

        for filename in sorted(os.listdir(SOURCE_DIR)):
            src = os.path.join(SOURCE_DIR, filename)
            if not os.path.isfile(src):
                continue

            if filename in SKIP_FILES or filename in existing:
                print(f"SKIP (da co): {filename}")
                skip += 1
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in ALLOWED_EXT:
                print(f"SKIP (ext {ext}): {filename}")
                skip += 1
                continue

            print(f"Processing: {filename} ...", flush=True)
            try:
                text = extract_text(src)
                if not text.strip():
                    print(f"  FAIL: khong trich xuat duoc text (PDF scan?)")
                    fail += 1
                    continue

                dest = os.path.join(UPLOAD_DIR, filename)
                if os.path.abspath(src) != os.path.abspath(dest):
                    shutil.copy2(src, dest)

                title = TITLE_MAP.get(filename, os.path.splitext(filename)[0])
                doc_type = guess_doc_type(filename)
                metadata = {
                    "title": title,
                    "document_type": doc_type,
                    "source": filename,
                    "access_level": "GIAO_VIEN",
                }
                add_document_to_db(text, metadata)

                row = models.KnowledgeDocument(
                    title=title,
                    document_type=doc_type,
                    file_path=dest,
                    access_level="GIAO_VIEN",
                    uploaded_by=bgh.id,
                )
                db.add(row)
                db.commit()
                print(f"  OK ({len(text)} chars)")
                ok += 1
            except Exception as e:
                db.rollback()
                print(f"  FAIL: {e}")
                fail += 1

        from vector_store import get_vector_store
        chunks = get_vector_store()._collection.count()
        total = db.query(models.KnowledgeDocument).count()
        print(f"\nDone: {ok} uploaded, {skip} skipped, {fail} failed")
        print(f"SQLite knowledge_documents: {total}")
        print(f"ChromaDB chunks: {chunks}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
