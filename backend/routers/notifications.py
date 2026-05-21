from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

@router.get("/")
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Lấy danh sách thông báo của người dùng"""
    notis = db.query(models.Notification)\
              .filter(models.Notification.user_id == current_user.id)\
              .order_by(models.Notification.created_at.desc())\
              .limit(50).all()
    return notis

@router.post("/{noti_id}/read")
def mark_as_read(
    noti_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Đánh dấu đã đọc"""
    noti = db.query(models.Notification).filter(
        models.Notification.id == noti_id, 
        models.Notification.user_id == current_user.id
    ).first()
    if noti:
        noti.is_read = True
        db.commit()
    return {"success": True}

@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.Notification).filter(models.Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"success": True}