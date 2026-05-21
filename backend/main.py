from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine

# Khởi tạo toàn bộ các bảng trong CSDL (nếu chưa có)
models.Base.metadata.create_all(bind=engine)

# SQLite: thêm cột notifications.action_url nếu DB cũ chưa có
from sqlalchemy import text
try:
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(notifications)")).fetchall()
        col_names = [c[1] for c in cols]
        if col_names and "action_url" not in col_names:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN action_url VARCHAR(512)"))
except Exception as e:
    print(f"[migrate] notifications.action_url: {e}")

app = FastAPI(
    title="QLDA RAG API",
    description="API cho hệ thống Quản lý kiểm tra thể thức văn bản bằng AI",
    version="1.0.0"
)

# Cấu hình CORS để Frontend (React) có thể gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Chào mừng đến với API Kiểm tra văn bản (RAG) - QLDA"}

# Thêm Auth và Users routes
from routers import auth, users, knowledge, documents, report, reviewer, bgh, templates, deadlines, notifications

app.include_router(auth.router, tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(report.router, prefix="/report", tags=["report"])
app.include_router(reviewer.router, prefix="/reviewer", tags=["reviewer"])
app.include_router(bgh.router, prefix="/bgh", tags=["bgh"])
app.include_router(templates.router, prefix="/templates", tags=["templates"])
app.include_router(deadlines.router, prefix="/deadlines", tags=["deadlines"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
