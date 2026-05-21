# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil

import models, schemas
from database import get_db
from routers.auth import get_current_user
from document_processor import extract_plain_text
from vector_store import add_document_to_db, delete_document_from_db
from llm_service import answer_knowledge_query

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "ground_truth_data")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_knowledge_document(
    title: str = Form(...),
    document_type: str = Form(...),
    access_level: str = Form("GIAO_VIEN"), # BGH, TO_TRUONG, GIAO_VIEN
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Có thể thêm check quyền Admin ở đây
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .pdf và .docx")
    
    # Define file path
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Save file to disk
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Extract text
        text = extract_plain_text(file_path)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Không thể trích xuất văn bản từ file")
            
        # Add to Vector DB
        metadata = {
            "title": title,
            "document_type": document_type,
            "source": file.filename,
            "access_level": access_level
        }
        add_document_to_db(text, metadata)
        
        # Save to MySQL DB
        new_doc = models.KnowledgeDocument(
            title=title,
            document_type=document_type,
            file_path=file_path,
            access_level=access_level,
            uploaded_by=current_user.id
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        
        return {"message": "Tải lên và xử lý thành công", "document_id": new_doc.id}
        
    except Exception as e:
        # Rollback nếu lỗi
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.delete("/{document_id}")
def delete_knowledge_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Check admin role
    roles = [r.role_name for r in current_user.roles]
    if "BGH" not in roles:
        raise HTTPException(status_code=403, detail="Chỉ BGH mới có quyền xóa tài liệu tri thức")
        
    doc = db.query(models.KnowledgeDocument).filter(models.KnowledgeDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
    # Xóa khỏi Vector DB
    # Lấy source filename
    source_filename = os.path.basename(doc.file_path)
    delete_document_from_db(source_filename)
    
    # Xóa file vật lý
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
        
    # Xóa khỏi MySQL (SQLite)
    db.delete(doc)
    db.commit()
    
    return {"message": "Đã xóa tri thức thành công khỏi SQLite và Vector DB"}

@router.get("/search")
def search_knowledge(query: str, current_user: models.User = Depends(get_current_user)):
    """
    Tìm kiếm quy định luật bằng AI (RAG).
    """
    if not query.strip():
        return {"answer": "Vui lòng nhập câu hỏi.", "sources": [], "chunks": []}

    roles = [r.role_name for r in current_user.roles]
    if "BGH" in roles:
        access_levels = ["GIAO_VIEN", "TO_TRUONG", "BGH"]
    elif "TO_TRUONG" in roles:
        access_levels = ["GIAO_VIEN", "TO_TRUONG"]
    else:
        access_levels = ["GIAO_VIEN"]

    try:
        return answer_knowledge_query(query, access_levels=access_levels)
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=f"Tra cứu AI tạm thời lỗi: {str(e)}",
        )

@router.get("/")
def get_knowledge_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    docs = db.query(models.KnowledgeDocument).offset(skip).limit(limit).all()
    # Thêm filename ảo để Frontend dễ hiển thị
    items = []
    for doc in docs:
        d = doc.__dict__.copy()
        d["filename"] = os.path.basename(doc.file_path)
        items.append(d)
    return items
