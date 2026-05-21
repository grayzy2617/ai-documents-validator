from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel
import models
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

# Schema cập nhật lỗi
class ErrorUpdate(BaseModel):
    status: str # VERIFIED (Đúng) hoặc IGNORED (Sai)
    reviewer_comment: Optional[str] = None
    suggestion: Optional[str] = None # Reviewer có thể sửa lại gợi ý

# Schema phê duyệt văn bản
class DocumentReviewAction(BaseModel):
    review_status: str # APPROVED, REJECTED, NEEDS_REVISION
    comments: Optional[str] = None

def check_reviewer_role(current_user: models.User):
    # Kiểm tra xem user có role REVIEWER hoặc ADMIN không
    roles = [role.role_name for role in current_user.roles]
    if "REVIEWER" not in roles and "ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="Không có quyền kiểm duyệt")

@router.get("/pending")
def get_pending_documents(
    page: int = 1,
    size: int = 10,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    offset = (page - 1) * size
    
    docs = db.query(models.UserDocument).filter(
        models.UserDocument.status == "PENDING"
    ).order_by(
        desc(models.UserDocument.created_at)
    ).offset(offset).limit(size).all()
    
    total = db.query(models.UserDocument).filter(
        models.UserDocument.status == "PENDING"
    ).count()

    # Map để lấy cả user upload
    items = []
    for doc in docs:
        d = doc.__dict__.copy()
        d['uploader'] = doc.owner.full_name if doc.owner else "Unknown"
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

@router.get("/history")
def get_reviewed_documents(
    page: int = 1,
    size: int = 10,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    offset = (page - 1) * size
    
    docs = db.query(models.UserDocument).filter(
        models.UserDocument.status != "PENDING"
    ).order_by(
        desc(models.UserDocument.created_at)
    ).offset(offset).limit(size).all()
    
    total = db.query(models.UserDocument).filter(
        models.UserDocument.status != "PENDING"
    ).count()

    items = []
    for doc in docs:
        d = doc.__dict__.copy()
        d['uploader'] = doc.owner.full_name if doc.owner else "Unknown"
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

@router.get("/documents/{document_id}")
def get_document_detail_for_reviewer(
    document_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    doc = db.query(models.UserDocument).filter(models.UserDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
        
    history = db.query(models.CheckHistory).filter(models.CheckHistory.document_id == document_id).order_by(desc(models.CheckHistory.check_date)).first()
    errors = []
    if history:
        errors = db.query(models.DetectedError).filter(models.DetectedError.history_id == history.id).all()
        
    return {
        "document": {
            "id": doc.id,
            "filename": doc.original_file_name,
            "status": doc.status,
            "uploader": doc.owner.full_name if doc.owner else "Unknown",
            "created_at": doc.created_at
        },
        "history_id": history.id if history else None,
        "errors": errors
    }

@router.put("/errors/{error_id}")
def update_error_status(
    error_id: int,
    update_data: ErrorUpdate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    err = db.query(models.DetectedError).filter(models.DetectedError.id == error_id).first()
    if not err:
        raise HTTPException(status_code=404, detail="Không tìm thấy lỗi")
        
    err.status = update_data.status
    if update_data.reviewer_comment is not None:
        err.reviewer_comment = update_data.reviewer_comment
    if update_data.suggestion is not None:
        err.suggestion = update_data.suggestion
        
    db.commit()
    db.refresh(err)
    return err

@router.post("/documents/{document_id}/review")
def review_document(
    document_id: int,
    action: DocumentReviewAction,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    doc = db.query(models.UserDocument).filter(models.UserDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    
    # Tạo review record
    review = models.DocumentReview(
        document_id=document_id,
        reviewer_id=current_user.id,
        review_status=action.review_status,
        comments=action.comments
    )
    db.add(review)
    
    # Update document status
    doc.status = action.review_status
    
    # Notify User
    noti = models.Notification(
        user_id=doc.user_id,
        title=f"Văn bản của bạn đã được {action.review_status}",
        message=f"Tài liệu '{doc.original_file_name}' đã được đánh giá. {action.comments or ''}"
    )
    db.add(noti)
    
    db.commit()
    return {"message": f"Đã đánh giá tài liệu thành {action.review_status}"}

class ManualErrorCreate(BaseModel):
    error_type: str
    error_location: Optional[str] = None
    description: str
    suggestion: Optional[str] = None

@router.post("/documents/{document_id}/errors")
def add_manual_error(
    document_id: int,
    error_data: ManualErrorCreate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_reviewer_role(current_user)
    history = db.query(models.CheckHistory).filter(models.CheckHistory.document_id == document_id).order_by(desc(models.CheckHistory.check_date)).first()
    if not history:
        raise HTTPException(status_code=400, detail="Văn bản này chưa có lịch sử kiểm tra (AI chưa chạy).")
        
    new_error = models.DetectedError(
        history_id=history.id,
        error_type=error_data.error_type,
        error_location=error_data.error_location,
        description=error_data.description,
        suggestion=error_data.suggestion,
        status="UNFIXED",
        reviewer_comment="Lỗi do Kiểm duyệt viên thêm thủ công"
    )
    db.add(new_error)
    db.commit()
    db.refresh(new_error)
    return new_error
