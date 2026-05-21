from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os
import shutil

import models
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "template_files")
os.makedirs(TEMPLATE_DIR, exist_ok=True)

def check_bgh_role(current_user: models.User):
    """Chỉ BGH mới có quyền upload/xóa template"""
    roles = [role.role_name for role in current_user.roles]
    if "BGH" not in roles:
        raise HTTPException(status_code=403, detail="Chỉ Ban Giám Hiệu mới có quyền thực hiện thao tác này")

@router.get("/")
def get_templates(
    category: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Danh sách template — tất cả role đều xem được"""
    query = db.query(models.Template)
    if category:
        query = query.filter(models.Template.category == category)
    
    total = query.count()
    templates = query.order_by(models.Template.created_at.desc()).offset(skip).limit(limit).all()
    
    items = []
    for t in templates:
        items.append({
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "description": t.description,
            "original_file_name": t.original_file_name,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    
    return {"items": items, "total": total}

@router.post("/upload")
async def upload_template(
    title: str = Form(...),
    category: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload template mới — chỉ BGH"""
    check_bgh_role(current_user)
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".docx", ".doc", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .pdf, .docx, .xlsx")
    
    # Lưu file
    saved_filename = f"tpl_{current_user.id}_{file.filename}"
    file_path = os.path.join(TEMPLATE_DIR, saved_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Lưu DB
    new_template = models.Template(
        title=title,
        category=category,
        description=description,
        file_path=file_path,
        original_file_name=file.filename,
        uploaded_by=current_user.id,
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return {"message": "Upload biểu mẫu thành công", "template_id": new_template.id}

@router.get("/categories")
def get_template_categories(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Lấy danh sách các category có sẵn"""
    categories = db.query(models.Template.category).distinct().all()
    return [c[0] for c in categories]

@router.get("/{template_id}/download")
def download_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Download template — tất cả role đều được"""
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu mẫu")
    
    if not os.path.exists(template.file_path):
        raise HTTPException(status_code=404, detail="File biểu mẫu không tồn tại trên hệ thống")
    
    return FileResponse(
        template.file_path,
        filename=template.original_file_name,
        media_type="application/octet-stream"
    )

@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Xóa template — chỉ BGH"""
    check_bgh_role(current_user)
    
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu mẫu")
    
    # Xóa file vật lý
    if os.path.exists(template.file_path):
        os.remove(template.file_path)
    
    db.delete(template)
    db.commit()
    
    return {"message": "Đã xóa biểu mẫu thành công"}
