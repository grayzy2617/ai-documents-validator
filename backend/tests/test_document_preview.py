import io
import docx
import pytest
from auth_utils import get_password_hash
from models import User, Role, UserRole, UserDocument, CheckHistory


@pytest.fixture
def auth_headers(client, db_session):
    role = Role(role_name="GIAO_VIEN")
    db_session.add(role)
    db_session.commit()
    user = User(
        username="previewuser",
        password=get_password_hash("password123"),
        full_name="Preview User",
        email="preview@example.com",
        status=True,
    )
    db_session.add(user)
    db_session.commit()
    ur = UserRole(user_id=user.id, role_id=role.id)
    db_session.add(ur)
    db_session.commit()
    token = client.post("/login", data={"username": "previewuser", "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user.id


def _make_docx():
    doc = docx.Document()
    doc.add_paragraph("Noi dung van ban kiem tra the thuc.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_document_meta_and_file_endpoints(client, auth_headers, db_session):
    headers, user_id = auth_headers
    content = _make_docx()
    upload = client.post(
        "/documents/check",
        headers=headers,
        files={"file": ("preview_test.docx", content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert upload.status_code == 200
    doc_id = upload.json()["document_id"]

    meta = client.get(f"/documents/{doc_id}/meta", headers=headers)
    assert meta.status_code == 200
    assert meta.json()["file_type"] == "docx"
    assert meta.json()["history_id"] is not None

    preview = client.get(f"/documents/{doc_id}/preview-text", headers=headers)
    assert preview.status_code == 200
    assert len(preview.json()["text"].strip()) > 10
    assert "[size=" not in preview.json()["text"]

    html_res = client.get(f"/documents/{doc_id}/preview-html", headers=headers)
    assert html_res.status_code == 200
    html_body = html_res.json()["html"]
    assert "docx-preview-inner" in html_body
    assert "[size=" not in html_body
    assert "data-para-idx" in html_body
    assert "contenteditable" in html_body

    para_save = client.put(
        f"/documents/{doc_id}/paragraphs",
        headers=headers,
        json={"paragraphs": [{"index": 0, "text": "Noi dung da chinh sua thu cong."}]},
    )
    assert para_save.status_code == 200
    assert para_save.json()["updated_count"] >= 1

    meta_after = client.get(f"/documents/{doc_id}/meta", headers=headers)
    assert meta_after.json()["has_fixed_file"] is True

    errors = client.get(f"/documents/{doc_id}/errors", headers=headers)
    assert errors.status_code == 200
    assert isinstance(errors.json(), list)


def test_bgh_dashboard_operations_stats(client, db_session):
    role = Role(role_name="BGH")
    db_session.add(role)
    db_session.commit()
    user = User(
        username="bghdash",
        password=get_password_hash("password123"),
        full_name="BGH Dash",
        email="bghdash@example.com",
        status=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    db_session.commit()

    token = client.post("/login", data={"username": "bghdash", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/bgh/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_documents" in data
    assert "pending_review" in data
    assert "by_status" in data
    assert "recent_submissions" in data
    assert "overdue_deadlines" in data
    assert "total_errors_detected" not in data
