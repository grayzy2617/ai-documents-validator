from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List
import models
from database import get_db
from routers.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter()

def check_bgh(user: models.User):
    is_bgh = any(role.role_name == "BGH" for role in user.roles)
    if not is_bgh:
        raise HTTPException(status_code=403, detail="Chỉ BGH mới có quyền truy cập chức năng này")

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Thống kê vận hành văn bản — tập trung quản lý luồng nộp/duyệt, không phải lỗi AI."""
    check_bgh(current_user)
    now = datetime.now()
    week_ago = now - timedelta(days=7)

    total_documents = db.query(models.UserDocument).count()
    pending_review = db.query(models.UserDocument).filter(models.UserDocument.status == "PENDING").count()
    auto_rejected = db.query(models.UserDocument).filter(models.UserDocument.status == "AUTO_REJECTED").count()
    bgh_approved = db.query(models.UserDocument).filter(models.UserDocument.status == "BGH_APPROVED").count()
    checked = db.query(models.UserDocument).filter(models.UserDocument.status == "CHECKED").count()
    submitted_this_week = db.query(models.UserDocument).filter(models.UserDocument.created_at >= week_ago).count()

    status_rows = (
        db.query(models.UserDocument.status, func.count(models.UserDocument.id))
        .group_by(models.UserDocument.status)
        .all()
    )
    by_status = [{"name": s or "Khác", "value": c} for s, c in status_rows]

    overdue_deadlines = []
    upcoming_deadlines = []
    deadlines = db.query(models.Deadline).filter(models.Deadline.status == "PENDING").all()
    for d in deadlines:
        if not d.due_date:
            continue
        due = d.due_date.replace(tzinfo=None) if hasattr(d.due_date, "tzinfo") else d.due_date
        item = {
            "id": d.id,
            "title": d.title,
            "due_date": d.due_date.isoformat() if d.due_date else None,
            "assigned_department": d.assigned_department or "Toàn trường",
            "days_remaining": (due - now).days,
        }
        if due < now:
            item["days_overdue"] = (now - due).days
            overdue_deadlines.append(item)
        elif due <= now + timedelta(days=7):
            upcoming_deadlines.append(item)

    overdue_deadlines.sort(key=lambda x: x.get("days_overdue", 0), reverse=True)
    upcoming_deadlines.sort(key=lambda x: x["days_remaining"])

    recent_docs = (
        db.query(models.UserDocument)
        .order_by(models.UserDocument.created_at.desc())
        .limit(8)
        .all()
    )
    recent_submissions = []
    for doc in recent_docs:
        recent_submissions.append({
            "id": doc.id,
            "original_file_name": doc.original_file_name,
            "owner": doc.owner.full_name if doc.owner else "Không rõ",
            "department": doc.owner.department if doc.owner else "",
            "status": doc.status,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        })

    dept_stats = []
    departments = db.query(models.User.department).distinct().all()
    for (dept,) in departments:
        if not dept:
            continue
        user_ids = [u.id for u in db.query(models.User.id).filter(models.User.department == dept).all()]
        if not user_ids:
            continue
        submitted = db.query(models.UserDocument).filter(models.UserDocument.user_id.in_(user_ids)).count()
        approved = db.query(models.UserDocument).filter(
            models.UserDocument.user_id.in_(user_ids),
            models.UserDocument.status == "BGH_APPROVED",
        ).count()
        pending = db.query(models.UserDocument).filter(
            models.UserDocument.user_id.in_(user_ids),
            models.UserDocument.status == "PENDING",
        ).count()
        dept_stats.append({
            "department": dept,
            "submitted": submitted,
            "approved": approved,
            "pending": pending,
        })

    return {
        "total_documents": total_documents,
        "pending_review": pending_review,
        "auto_rejected": auto_rejected,
        "bgh_approved": bgh_approved,
        "checked": checked,
        "submitted_this_week": submitted_this_week,
        "by_status": by_status,
        "overdue_deadlines": overdue_deadlines[:10],
        "upcoming_deadlines": upcoming_deadlines[:10],
        "recent_submissions": recent_submissions,
        "by_department": dept_stats,
    }

@router.get("/dashboard/error-charts")
def get_error_charts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_bgh(current_user)
    
    error_counts = db.query(
        models.DetectedError.error_type,
        func.count(models.DetectedError.id).label('count')
    ).group_by(models.DetectedError.error_type).all()
    
    data = [{"name": row.error_type or "Khác", "value": row.count} for row in error_counts]
    return data

@router.get("/dashboard/ai-performance")
def get_ai_performance(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_bgh(current_user)
    
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

@router.get("/dashboard/department-stats")
def get_department_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_bgh(current_user)
    
    stats = []
    departments = db.query(models.User.department).distinct().all()
    
    for (dept,) in departments:
        if not dept:
            continue
        users_in_dept = db.query(models.User.id).filter(models.User.department == dept).subquery()
        
        docs_count = db.query(models.UserDocument).filter(models.UserDocument.user_id.in_(users_in_dept)).count()
        
        histories = db.query(models.CheckHistory.id).join(models.UserDocument).filter(models.UserDocument.user_id.in_(users_in_dept)).subquery()
        errors_count = db.query(models.DetectedError).filter(models.DetectedError.history_id.in_(histories)).count()
        
        stats.append({
            "department": dept,
            "total_documents": docs_count,
            "total_errors": errors_count
        })
        
    return stats

@router.get("/documents/all")
def get_all_documents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_bgh(current_user)
    
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

@router.post("/documents/{document_id}/approve")
def approve_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_bgh(current_user)
    
    doc = db.query(models.UserDocument).filter(models.UserDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
        
    doc.status = "BGH_APPROVED"
    doc.approved_by = current_user.id
    doc.approved_at = datetime.now()
    
    audit = models.AuditLog(
        user_id=current_user.id,
        action="BGH_APPROVE",
        target_table="user_documents",
        target_id=document_id
    )
    db.add(audit)
    
    noti = models.Notification(
        user_id=doc.user_id,
        title="Văn bản đã được BGH phê duyệt",
        message=f"Tài liệu '{doc.original_file_name}' đã được BGH phê duyệt."
    )
    db.add(noti)
    
    db.commit()
    
    return {
        "message": f"Đã phê duyệt văn bản #{document_id}",
        "approved_by": current_user.full_name,
        "approved_at": doc.approved_at.isoformat()
    }

class BatchApproveRequest(BaseModel):
    document_ids: List[int]

@router.post("/batch-approve")
def batch_approve_documents(
    request: BatchApproveRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_bgh(current_user)
    
    approved = []
    failed = []
    
    for doc_id in request.document_ids:
        doc = db.query(models.UserDocument).filter(models.UserDocument.id == doc_id).first()
        if not doc:
            failed.append({"id": doc_id, "reason": "Không tìm thấy"})
            continue
        
        doc.status = "BGH_APPROVED"
        doc.approved_by = current_user.id
        doc.approved_at = datetime.now()
        approved.append(doc_id)
        
        audit = models.AuditLog(
            user_id=current_user.id,
            action="BGH_BATCH_APPROVE",
            target_table="user_documents",
            target_id=doc_id
        )
        db.add(audit)
        
        noti = models.Notification(
            user_id=doc.user_id,
            title="Văn bản đã được BGH phê duyệt",
            message=f"Tài liệu '{doc.original_file_name}' đã được BGH phê duyệt trong đợt duyệt hàng loạt."
        )
        db.add(noti)
    
    db.commit()
    
    return {
        "message": f"Đã phê duyệt {len(approved)}/{len(request.document_ids)} văn bản",
        "approved": approved,
        "failed": failed
    }

@router.get("/audit-logs")
def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_bgh(current_user)
    
    logs = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for log in logs:
        user = db.query(models.User).filter(models.User.id == log.user_id).first()
        result.append({
            "id": log.id,
            "user": user.full_name if user else "Hệ thống",
            "action": log.action,
            "target_table": log.target_table,
            "target_id": log.target_id,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
        
    return result

class MinScoreConfigRequest(BaseModel):
    min_score: int

@router.get("/config/min-score")
def get_min_score_config(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_bgh(current_user)
    config = db.query(models.SystemConfig).filter(models.SystemConfig.config_key == "min_ai_score").first()
    if not config:
        return {"min_score": 80}
    val = config.config_value
    if isinstance(val, dict) and "min_score" in val:
        return {"min_score": val["min_score"]}
    try:
        return {"min_score": int(val)}
    except Exception:
        return {"min_score": 80}

@router.post("/config/min-score")
def update_min_score_config(
    request: MinScoreConfigRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_bgh(current_user)
    if request.min_score < 0 or request.min_score > 100:
        raise HTTPException(status_code=400, detail="Ngưỡng điểm phải nằm trong khoảng từ 0 đến 100")
        
    config = db.query(models.SystemConfig).filter(models.SystemConfig.config_key == "min_ai_score").first()
    if not config:
        config = models.SystemConfig(
            config_key="min_ai_score",
            config_value=request.min_score,
            description="Ngưỡng điểm AI tối thiểu cho phép nộp văn bản"
        )
        db.add(config)
    else:
        config.config_value = request.min_score
        
    db.commit()
    return {"message": "Đã cập nhật ngưỡng điểm AI tối thiểu", "min_score": request.min_score}