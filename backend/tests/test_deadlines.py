import pytest
from models import User, Role, UserRole

def test_get_deadlines(client, auth_headers):
    response = client.get("/deadlines/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json()["items"], list)

def test_create_deadline(client, auth_headers):
    # Test tạo deadline (yêu cầu quyền Tổ trưởng hoặc BGH, auth_headers hiện tại là Giáo viên)
    # Giao vien ko được tạo deadline
    response = client.post(
        "/deadlines/",
        headers=auth_headers,
        json={"title": "Test deadline", "description": "Test", "due_date": "2026-12-31T23:59:00Z", "assigned_department": "Toan"}
    )
    # Vì auth_headers là Giao vien, nên API trả về 403 Forbidden
    assert response.status_code == 403

def test_create_deadline_as_bgh(client, db_session):
    # Tạo user BGH
    from auth_utils import get_password_hash
    role = db_session.query(Role).filter(Role.role_name == "BGH").first()
    if not role:
        role = Role(role_name="BGH")
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)

    user = User(
        username="bgh_deadline",
        password=get_password_hash("test"),
        full_name="Test BGH",
        email="bgh_deadline@example.com",
        status=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    db_session.commit()

    token_res = client.post("/login", data={"username": "bgh_deadline", "password": "test"})
    token = token_res.json()["access_token"]
    
    response = client.post(
        "/deadlines/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Test deadline", "description": "Test", "due_date": "2026-12-31T23:59:00Z", "assigned_department": "Toan"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test deadline"
    assert "id" in data
