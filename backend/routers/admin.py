from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

def check_admin(user: models.User):
    is_admin = any(role.role_name == "ADMIN" for role in user.roles)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền truy cập chức năng này")

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_admin(current_user)
    
    total_users = db.query(models.User).count()
    total_documents = db.query(models.UserDocument).count()
    total_errors = db.query(models.DetectedError).count()
    
    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_errors_detected": total_errors,
        "system_health": "Hoạt động tốt"
    }

@router.get("/dashboard/error-charts")
def get_error_charts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_admin(current_user)
    
    # Gom nhóm theo error_type
    error_counts = db.query(
        models.DetectedError.error_type,
        func.count(models.DetectedError.id).label('count')
    ).group_by(models.DetectedError.error_type).all()
    
    data = [{"name": row.error_type or "Khác", "value": row.count} for row in error_counts]
    return data

@router.get("/dashboard/ai-performance")
def get_ai_performance(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_admin(current_user)
    
    # Lỗi được reviewer duyệt là Đúng (VERIFIED) hoặc tự sửa (MANUAL_FIXED, AUTO_FIXED)
    # Lỗi AI sai là IGNORED
    verified = db.query(models.DetectedError).filter(models.DetectedError.status.in_(["VERIFIED", "MANUAL_FIXED", "AUTO_FIXED"])).count()
    ignored = db.query(models.DetectedError).filter(models.DetectedError.status == "IGNORED").count()
    
    total_evaluated = verified + ignored
    accuracy = 0
    if total_evaluated > 0:
        accuracy = round((verified / total_evaluated) * 100, 1)
        
    return {
        "verified": verified,
        "ignored": ignored,
        "accuracy": accuracy
    }

@router.get("/documents/all")
def get_all_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_admin(current_user)
    
    docs = db.query(models.UserDocument).order_by(models.UserDocument.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for doc in docs:
        total_errors = 0
        if doc.check_histories:
            latest_history = max(doc.check_histories, key=lambda h: h.check_date)
            total_errors = len(latest_history.errors)
            
        result.append({
            "id": doc.id,
            "original_file_name": doc.original_file_name,
            "owner": doc.owner.full_name if doc.owner else "Không rõ",
            "status": doc.status,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "total_errors": total_errors
        })
    return result
