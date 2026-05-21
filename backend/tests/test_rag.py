import pytest
from models import User, Role, UserRole

def test_get_knowledge_documents(client, auth_headers):
    # Test lấy danh sách tài liệu tri thức
    response = client.get("/knowledge/", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_search_knowledge(client, auth_headers):
    # Test tìm kiếm bằng RAG
    response = client.get("/knowledge/search", headers=auth_headers, params={"query": "thể thức"})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "sources" in data
