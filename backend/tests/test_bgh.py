import pytest
from auth_utils import get_password_hash
from models import User, Role, UserRole

@pytest.fixture(scope="function")
def bgh_user_token(client, db_session):
    # Tạo user BGH
    role = Role(role_name="BGH")
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    user = User(
        username="bgh1",
        password=get_password_hash("password123"),
        full_name="Test BGH",
        email="bgh@example.com",
        status=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db_session.add(user_role)
    db_session.commit()
    
    response = client.post(
        "/login",
        data={"username": "bgh1", "password": "password123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_bgh_dashboard_stats(client, bgh_user_token):
    response = client.get("/bgh/dashboard/stats", headers=bgh_user_token)
    assert response.status_code == 200
    data = response.json()
    assert "total_documents" in data
    assert "pending_review" in data
    assert "recent_submissions" in data
    assert "total_errors_detected" not in data

def test_bgh_audit_logs(client, bgh_user_token):
    # Test lấy log
    response = client.get("/bgh/audit-logs", headers=bgh_user_token)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_bgh_errors_chart(client, bgh_user_token):
    # Test biểu đồ lỗi
    response = client.get("/bgh/dashboard/error-charts", headers=bgh_user_token)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_bgh_batch_approve(client, bgh_user_token):
    # Dữ liệu rỗng
    response = client.post(
        "/bgh/batch-approve",
        headers=bgh_user_token,
        json={"document_ids": []}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Đã phê duyệt 0/0 văn bản"
