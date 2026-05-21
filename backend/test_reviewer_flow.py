from fastapi.testclient import TestClient
import sys
import os

print("Starting test script...", flush=True)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("Importing app...", flush=True)
from main import app
print("Importing database...", flush=True)
from database import SessionLocal
import models
from auth_utils import get_password_hash
print("Imports finished.", flush=True)

client = TestClient(app)

def setup_test_data():
    db = SessionLocal()
    try:
        # Create a test user and admin if they don't exist
        admin = db.query(models.User).filter_by(username="admin_test").first()
        if not admin:
            admin = models.User(
                username="admin_test",
                password=get_password_hash("123456"),
                email="admin_test@test.com",
                full_name="Admin Test",
                status=True
            )
            db.add(admin)
            db.commit()
            
            admin_role = db.query(models.Role).filter_by(role_name="ADMIN").first()
            if not admin_role:
                admin_role = models.Role(role_name="ADMIN", description="Admin")
                db.add(admin_role)
                db.commit()
            db.add(models.UserRole(user_id=admin.id, role_id=admin_role.id))
            db.commit()

        # Create a test document in PENDING state
        doc = models.UserDocument(
            user_id=admin.id,
            original_file_name="test_doc.docx",
            file_path="/tmp/test_doc.docx",
            status="PENDING"
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # Create a CheckHistory
        history = models.CheckHistory(
            document_id=doc.id
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        # Create a DetectedError
        error = models.DetectedError(
            history_id=history.id,
            error_type="Lỗi định dạng",
            error_location="Trang 1",
            description="Sai font chữ",
            status="UNFIXED"
        )
        db.add(error)
        db.commit()
        db.refresh(error)

        return doc.id, error.id
    finally:
        db.close()

def run_tests():
    print("=== BẮT ĐẦU CHẠY BỘ KIỂM THỬ BƯỚC 3 (REVIEWER) ===")
    doc_id, error_id = setup_test_data()
    print(f"1. Đã tạo dữ liệu giả lập (Document ID: {doc_id}, Error ID: {error_id})")

    # Đăng nhập lấy token
    response = client.post(
        "/login",
        data={"username": "admin_test", "password": "123456"}
    )
    assert response.status_code == 200, f"Đăng nhập thất bại: {response.text}"
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("2. Đăng nhập với quyền Admin (được phép Review) thành công.")

    # Kiểm tra API GET pending
    response = client.get("/reviewer/pending", headers=headers)
    assert response.status_code == 200, f"Lỗi GET /reviewer/pending: {response.text}"
    pending_items = response.json()["items"]
    assert any(item["id"] == doc_id for item in pending_items), "Không tìm thấy văn bản PENDING"
    print("3. Kiểm tra API GET /reviewer/pending -> PASSED")

    # Kiểm tra API GET document detail
    response = client.get(f"/reviewer/documents/{doc_id}", headers=headers)
    assert response.status_code == 200, f"Lỗi GET /reviewer/documents/{{id}}: {response.text}"
    detail = response.json()
    assert detail["document"]["id"] == doc_id
    assert len(detail["errors"]) >= 1
    print("4. Kiểm tra API GET /reviewer/documents/{id} -> PASSED")

    # Kiểm tra API PUT error
    response = client.put(
        f"/reviewer/errors/{error_id}",
        headers=headers,
        json={
            "status": "VERIFIED",
            "reviewer_comment": "Đã xem và xác nhận đúng lỗi"
        }
    )
    assert response.status_code == 200, f"Lỗi PUT /reviewer/errors/{{id}}: {response.text}"
    assert response.json()["status"] == "VERIFIED"
    assert response.json()["reviewer_comment"] == "Đã xem và xác nhận đúng lỗi"
    print("5. Kiểm tra API PUT /reviewer/errors/{id} -> PASSED")

    # Kiểm tra API POST review document
    response = client.post(
        f"/reviewer/documents/{doc_id}/review",
        headers=headers,
        json={
            "review_status": "APPROVED",
            "comments": "Văn bản đạt chuẩn sau khi sửa"
        }
    )
    assert response.status_code == 200, f"Lỗi POST /reviewer/documents/{{id}}/review: {response.text}"
    print("6. Kiểm tra API POST /reviewer/documents/{id}/review -> PASSED")

    # Kiểm tra lại document không còn ở pending
    response = client.get("/reviewer/pending", headers=headers)
    pending_items = response.json()["items"]
    assert not any(item["id"] == doc_id for item in pending_items), "Văn bản vẫn còn ở PENDING"
    print("7. Kiểm tra lại /reviewer/pending sau khi Approve -> PASSED (Văn bản đã biến mất khỏi hàng đợi)")

    # Kiểm tra xem document có ở history không
    response = client.get("/reviewer/history", headers=headers)
    history_items = response.json()["items"]
    assert any(item["id"] == doc_id for item in history_items), "Văn bản không có trong History"
    print("8. Kiểm tra API GET /reviewer/history -> PASSED")

    print("=== TẤT CẢ CÁC TEST CASE ĐỀU PASSED ===================")

if __name__ == "__main__":
    run_tests()
