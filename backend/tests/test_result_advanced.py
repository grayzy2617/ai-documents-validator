"""Tests for ai-fix preview, recheck (recheck may call LLM — mock when needed)."""
import io
from unittest.mock import patch

import docx
import pytest
from auth_utils import get_password_hash
from models import Role, User, UserRole


@pytest.fixture
def auth_headers(client, db_session):
    role = Role(role_name="GIAO_VIEN")
    db_session.add(role)
    db_session.commit()
    user = User(
        username="advuser",
        password=get_password_hash("password123"),
        full_name="Adv User",
        email="adv@example.com",
        status=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    db_session.commit()
    token = client.post("/login", data={"username": "advuser", "password": "password123"}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def _upload_docx(client, headers):
    doc = docx.Document()
    doc.add_paragraph("Van ban mau de kiem tra loi the thuc.")
    buf = io.BytesIO()
    doc.save(buf)
    res = client.post(
        "/documents/check",
        headers=headers,
        files={
            "file": (
                "adv_test.docx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert res.status_code == 200
    return res.json()["document_id"]


@patch("routers.documents.score_document_structure", return_value=85)
@patch(
    "routers.documents.check_document_errors",
    return_value=[
        {
            "error_type": "Loi test",
            "error_location": "Van ban mau",
            "description": "Doan can sua",
            "suggestion": "Sua lai",
        }
    ],
)
@patch("routers.documents.generate_autofix_plan")
def test_ai_fix_preview_and_apply(mock_plan, mock_check, mock_score, client, auth_headers):
    mock_plan.return_value = [
        {
            "search_text": "Van ban mau",
            "replace_text": "Van ban mau da sua",
        }
    ]
    headers = auth_headers
    doc_id = _upload_docx(client, headers)

    errors = client.get(f"/documents/{doc_id}/errors", headers=headers).json()
    assert len(errors) >= 1
    error_id = errors[0]["id"]
    preview = client.post(
        f"/documents/{doc_id}/errors/{error_id}/ai-fix/preview",
        headers=headers,
    )
    assert preview.status_code == 200
    data = preview.json()
    assert "before_text" in data
    assert "after_text" in data

    apply_res = client.post(
        f"/documents/{doc_id}/errors/{error_id}/ai-fix/apply",
        headers=headers,
        json={
            "search_text": data["search_text"],
            "replace_text": data["replace_text"],
        },
    )
    assert apply_res.status_code == 200


@patch("routers.documents.score_document_structure", return_value=90)
@patch("routers.documents.check_document_errors", return_value=[])
def test_recheck_creates_new_history(mock_check, mock_score, client, auth_headers):
    headers = auth_headers
    doc_id = _upload_docx(client, headers)
    res = client.post(f"/documents/{doc_id}/recheck", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "history_id" in body
    assert "total_errors" in body
