import pytest
from models import User, Role
from auth_utils import get_password_hash

def create_test_user(db_session, username, password, role_name, department=None):
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        password=hashed_password,
        full_name=f"Test {role_name}",
        email=f"{username}@example.com",
        department=department,
        status=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    role = db_session.query(Role).filter(Role.role_name == role_name).first()
    if not role:
        role = Role(role_name=role_name)
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)
        
    from models import UserRole
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db_session.add(user_role)
    db_session.commit()
    return user

def test_login_success(client, db_session):
    # Setup
    create_test_user(db_session, "giaovien1", "password123", "GIAO_VIEN", "Toan")
    
    # Execute
    response = client.post(
        "/login",
        data={"username": "giaovien1", "password": "password123"}
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password(client, db_session):
    create_test_user(db_session, "giaovien1", "password123", "GIAO_VIEN", "Toan")
    
    response = client.post(
        "/login",
        data={"username": "giaovien1", "password": "wrongpassword"}
    )
    
    assert response.status_code == 401
    assert response.json()["detail"] == "Tên đăng nhập hoặc mật khẩu không chính xác"

def test_login_nonexistent_user(client, db_session):
    response = client.post(
        "/login",
        data={"username": "nobody", "password": "password123"}
    )
    
    assert response.status_code == 401
    assert response.json()["detail"] == "Tên đăng nhập hoặc mật khẩu không chính xác"

def test_access_protected_route_without_token(client):
    # GET /users/me requires token
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
