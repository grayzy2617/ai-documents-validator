"""
Nạp hàng loạt file từ thư mục ground_truth_data (gốc project) vào Kho Tri Thức.
Chạy: python seed_knowledge_batch.py
Yêu cầu: Backend đang chạy port 8000, tài khoản bgh/123456
"""
import os
import sys
import requests

BASE_URL = os.getenv("QLDA_API_URL", "http://127.0.0.1:8000")
SOURCE_DIR = os.path.join(os.path.dirname(__file__), "..", "ground_truth_data")
SKIP_FILES = {"30.signed.pdf"}  # Đã upload thủ công
ALLOWED_EXT = {".pdf", ".docx"}

# Tiêu đề thân thiện (tùy chọn)
TITLE_MAP = {
    "295_-_Quyet_dinh_ban_hanh_Hoc_ba_so_279f7.pdf": "Quyết định ban hành Học bạ số",
    "49_Quyet_dinh_Ve_viec_ban_hanh_Quy_dinh_noi_dung__chuongw_trinh_va_diem_cham_sinh_hoat_duoi_co_cac_lop_dau_tuan_nam_hoc_2025-2026_97580.pdf": "Quy định nội dung chương trình và điểm chấm sinh hoạt",
    "54_-_Quy_che_thi_dua_GVCN_1baba.pdf": "Quy chế thi đua GVCN",
    "BIEN_BAN_HOP_TO_CHUYEN_MON_049b3.docx": "Biên bản họp Tổ chuyên môn",
    "Don_chuyen_truong__ngoai_tinh__22171.docx": "Đơn chuyển trường (ngoại tỉnh)",
    "DON_XIN_PHEP NGHI.docx": "Đơn xin phép nghỉ",
    "Mau_don_chuyen_truong_-_Trong_tinh_cc8f0.docx": "Mẫu đơn chuyển trường (trong tỉnh)",
    "Phu_luc_DANG_KY_CHI_TIEU_nam_hoc_197db.docx": "Phụ lục đăng ký chỉ tiêu năm học",
}


def guess_doc_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return "Quy định / Quyết định"
    return "Biểu mẫu"


def main():
    print("=== Nạp Kho Tri Thức từ ground_truth_data ===\n")

    try:
        login = requests.post(
            f"{BASE_URL}/login",
            data={"username": "bgh", "password": "123456"},
            timeout=30,
        )
        login.raise_for_status()
        token = login.json()["access_token"]
    except Exception as e:
        print(f"❌ Không đăng nhập được (backend có đang chạy?): {e}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}
    files_on_disk = sorted(
        f for f in os.listdir(SOURCE_DIR)
        if os.path.isfile(os.path.join(SOURCE_DIR, f))
    )

    ok, skip, fail = 0, 0, 0

    for filename in files_on_disk:
        if filename in SKIP_FILES:
            print(f"⏭️  Bỏ qua (đã có): {filename}")
            skip += 1
            continue

        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            print(f"⏭️  Bỏ qua (không hỗ trợ {ext}): {filename}")
            skip += 1
            continue

        filepath = os.path.join(SOURCE_DIR, filename)
        title = TITLE_MAP.get(filename, os.path.splitext(filename)[0].replace("_", " "))
        doc_type = guess_doc_type(filename)

        print(f"📤 Đang upload: {filename} ...", end=" ", flush=True)

        try:
            with open(filepath, "rb") as f:
                resp = requests.post(
                    f"{BASE_URL}/knowledge/upload",
                    headers=headers,
                    data={
                        "title": title,
                        "document_type": doc_type,
                        "access_level": "GIAO_VIEN",
                    },
                    files={
                        "file": (
                            filename,
                            f,
                            "application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        )
                    },
                    timeout=600,
                )
            if resp.status_code == 200:
                doc_id = resp.json().get("document_id")
                print(f"✅ OK (id={doc_id})")
                ok += 1
            else:
                print(f"❌ {resp.status_code} — {resp.text[:200]}")
                fail += 1
        except Exception as e:
            print(f"❌ Lỗi: {e}")
            fail += 1

    print(f"\n=== Xong: {ok} thành công, {skip} bỏ qua, {fail} lỗi ===")

    # Kiểm tra vector DB
    try:
        from vector_store import get_vector_store
        count = get_vector_store()._collection.count()
        print(f"ChromaDB: {count} chunks")
    except Exception:
        pass


if __name__ == "__main__":
    main()
