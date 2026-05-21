import json
import os
import re
import shutil
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import and_, exists, not_, or_, select
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db
from document_processor import docx_to_html
from routers.auth import get_current_user

router = APIRouter()

DEADLINE_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "deadline_uploads")
os.makedirs(DEADLINE_UPLOAD_DIR, exist_ok=True)

MAX_FILES = 3
ALLOWED_EXT = {".pdf", ".docx"}


def _roles(user: models.User) -> list[str]:
    return [r.role_name for r in user.roles]


def _users_for_deadline_audience(db: Session, assigned_department: Optional[str]) -> list[int]:
    """Legacy: GV + Tổ trưởng theo tổ; toàn trường = mọi GV + mọi tổ trưởng."""
    q = (
        db.query(models.User.id)
        .join(models.UserRole, models.UserRole.user_id == models.User.id)
        .join(models.Role, models.Role.id == models.UserRole.role_id)
        .filter(models.User.status.is_(True))
        .filter(models.Role.role_name.in_(["GIAO_VIEN", "TO_TRUONG"]))
    )
    if assigned_department and str(assigned_department).strip():
        q = q.filter(models.User.department == assigned_department.strip())
    return list({row[0] for row in q.distinct().all()})


def _has_explicit_recipients(db: Session, deadline_id: int) -> bool:
    return (
        db.query(models.DeadlineRecipient)
        .filter(models.DeadlineRecipient.deadline_id == deadline_id)
        .first()
        is not None
    )


def _recipient_user_ids(db: Session, dl: models.Deadline) -> list[int]:
    """Danh sách user_id nhận deadline: bảng deadline_recipients nếu có, không thì logic tổ (legacy)."""
    rows = (
        db.query(models.DeadlineRecipient.user_id)
        .filter(models.DeadlineRecipient.deadline_id == dl.id)
        .order_by(models.DeadlineRecipient.user_id.asc())
        .all()
    )
    if rows:
        return list({int(r[0]) for r in rows})
    return _users_for_deadline_audience(db, dl.assigned_department)


def _notify(db: Session, user_ids: list[int], title: str, message: str, action_url: Optional[str] = None):
    seen = set()
    for uid in user_ids:
        if not uid or uid in seen:
            continue
        seen.add(uid)
        db.add(
            models.Notification(
                user_id=uid,
                title=title,
                message=message,
                action_url=action_url,
            )
        )


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or "file")
    return re.sub(r"[^a-zA-Z0-9._\-]", "_", base)[:180]


def _save_uploaded_files(
    deadline_id: int,
    prefix: str,
    files: List[UploadFile],
    uploaded_by: int,
    db: Session,
    reply_id: Optional[int] = None,
) -> list[models.DeadlineAttachment]:
    saved: list[models.DeadlineAttachment] = []
    for idx, up in enumerate(files[:MAX_FILES]):
        if not up.filename:
            continue
        ext = os.path.splitext(up.filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=400, detail=f"Chỉ chấp nhận .pdf và .docx: {up.filename}")
        fname = f"{prefix}_{idx}_{_safe_filename(up.filename)}"
        path = os.path.join(DEADLINE_UPLOAD_DIR, fname)
        with open(path, "wb") as buf:
            shutil.copyfileobj(up.file, buf)
        size = os.path.getsize(path)
        att = models.DeadlineAttachment(
            deadline_id=deadline_id,
            reply_id=reply_id,
            original_file_name=up.filename,
            file_path=path,
            file_size=size,
            uploaded_by=uploaded_by,
        )
        db.add(att)
        saved.append(att)
    return saved


def _can_view_deadline(db: Session, user: models.User, dl: models.Deadline) -> bool:
    if dl.created_by == user.id:
        return True
    if "BGH" in _roles(user):
        return True
    return user.id in _recipient_user_ids(db, dl)


def _can_reply_as_recipient(db: Session, user: models.User, dl: models.Deadline) -> bool:
    """Người nhận (không phải người gửi) được phản hồi."""
    if dl.created_by == user.id:
        return False
    return user.id in _recipient_user_ids(db, dl)


def _deadline_query_for_user(db: Session, current_user: models.User):
    D = models.Deadline
    DR = models.DeadlineRecipient
    if "BGH" in _roles(current_user):
        return db.query(D)

    rec_rows_exist = exists().where(DR.deadline_id == D.id)
    my_recipient_deadlines = select(DR.deadline_id).where(DR.user_id == current_user.id)
    legacy_visibility = and_(
        not_(rec_rows_exist),
        or_(
            D.assigned_department.is_(None),
            D.assigned_department == "",
            D.assigned_department == current_user.department,
        ),
    )
    return db.query(D).filter(
        or_(
            D.created_by == current_user.id,
            D.id.in_(my_recipient_deadlines),
            legacy_visibility,
        )
    )


class DeadlineCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: datetime
    assigned_department: Optional[str] = None


@router.get("/")
def get_all_deadlines(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deadlines = _deadline_query_for_user(db, current_user).order_by(models.Deadline.due_date.asc()).all()
    result = []
    for d in deadlines:
        data = {c.name: getattr(d, c.name) for c in d.__table__.columns}
        user = db.query(models.User).filter(models.User.id == d.created_by).first()
        data["created_by"] = user.full_name if user else "Unknown"
        data["attachment_count"] = (
            db.query(models.DeadlineAttachment)
            .filter(
                models.DeadlineAttachment.deadline_id == d.id,
                models.DeadlineAttachment.reply_id.is_(None),
            )
            .count()
        )
        data["reply_count"] = db.query(models.DeadlineReply).filter(models.DeadlineReply.deadline_id == d.id).count()
        data["recipient_count"] = (
            db.query(models.DeadlineRecipient).filter(models.DeadlineRecipient.deadline_id == d.id).count()
        )
        result.append(data)
    return {"items": result}


@router.get("/upcoming")
def get_upcoming_deadlines(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.now()
    next_week = now + timedelta(days=7)
    query = _deadline_query_for_user(db, current_user).filter(
        models.Deadline.status == "PENDING",
        models.Deadline.due_date <= next_week,
    )
    deadlines = query.order_by(models.Deadline.due_date.asc()).all()
    result = []
    for d in deadlines:
        data = {c.name: getattr(d, c.name) for c in d.__table__.columns}
        days_left = (d.due_date - now).days
        data["days_left"] = days_left if days_left >= 0 else 0
        user = db.query(models.User).filter(models.User.id == d.created_by).first()
        data["created_by"] = user.full_name if user else "Unknown"
        data["recipient_count"] = (
            db.query(models.DeadlineRecipient).filter(models.DeadlineRecipient.deadline_id == d.id).count()
        )
        result.append(data)
    return {"items": result}


@router.post("/")
async def create_deadline(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    due_date: str = Form(...),
    recipient_usernames: str = Form(...),
    assigned_department: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    roles = _roles(current_user)
    if "BGH" not in roles and "TO_TRUONG" not in roles:
        raise HTTPException(status_code=403, detail="Chỉ BGH hoặc Tổ trưởng mới được tạo deadline")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Tối đa {MAX_FILES} file")

    try:
        raw_list = json.loads(recipient_usernames)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="recipient_usernames phải là JSON mảng username")
    if not isinstance(raw_list, list) or len(raw_list) < 1:
        raise HTTPException(status_code=400, detail="Chọn ít nhất 1 username người nhận")

    unames = list(dict.fromkeys([str(u).strip() for u in raw_list if str(u).strip()]))
    if len(unames) < 1:
        raise HTTPException(status_code=400, detail="Chọn ít nhất 1 username người nhận")

    recipient_ids: list[int] = []
    for un in unames:
        u = db.query(models.User).filter(models.User.username == un, models.User.status.is_(True)).first()
        if not u:
            raise HTTPException(status_code=400, detail=f"Không tìm thấy user hoặc đã khóa: {un}")
        recipient_ids.append(u.id)

    recipient_ids = list(dict.fromkeys(recipient_ids))
    if current_user.id in recipient_ids:
        raise HTTPException(status_code=400, detail="Không được chọn chính mình làm người nhận")

    try:
        due = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="due_date không hợp lệ (ISO)")

    dl = models.Deadline(
        title=title,
        description=description or None,
        due_date=due,
        assigned_department=assigned_department or None,
        created_by=current_user.id,
    )
    db.add(dl)
    db.flush()

    for uid in recipient_ids:
        db.add(models.DeadlineRecipient(deadline_id=dl.id, user_id=uid))

    if files:
        _save_uploaded_files(dl.id, f"d{dl.id}_init", files, current_user.id, db, reply_id=None)

    db.commit()
    db.refresh(dl)

    # Thông báo chỉ người nhận — không gửi cho người tạo
    _notify(
        db,
        recipient_ids,
        "Deadline mới",
        f"{current_user.full_name}: {dl.title} (hạn {dl.due_date})",
        f"/deadlines?open={dl.id}",
    )
    db.commit()

    return {"id": dl.id, "message": "Đã tạo deadline"}


@router.get("/{deadline_id}/detail")
def get_deadline_detail(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    dl = (
        db.query(models.Deadline)
        .options(
            joinedload(models.Deadline.attachments),
            joinedload(models.Deadline.replies).joinedload(models.DeadlineReply.attachments),
            joinedload(models.Deadline.replies).joinedload(models.DeadlineReply.author),
            joinedload(models.Deadline.recipient_links).joinedload(models.DeadlineRecipient.user),
        )
        .filter(models.Deadline.id == deadline_id)
        .first()
    )
    if not dl:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")
    if not _can_view_deadline(db, current_user, dl):
        raise HTTPException(status_code=403, detail="Không có quyền xem deadline này")

    creator = db.query(models.User).filter(models.User.id == dl.created_by).first()
    initial_atts = [a for a in dl.attachments if a.reply_id is None]
    replies_out = []
    for r in sorted(dl.replies, key=lambda x: x.created_at or datetime.min):
        author = r.author
        replies_out.append(
            {
                "id": r.id,
                "note": r.note,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "author_name": author.full_name if author else "",
                "attachments": [
                    {"id": a.id, "original_file_name": a.original_file_name, "file_size": a.file_size}
                    for a in r.attachments
                ],
            }
        )

    recipients_out = []
    if dl.recipient_links:
        for link in sorted(dl.recipient_links, key=lambda x: (x.user.username if x.user else "")):
            u = link.user
            if u:
                recipients_out.append({"id": u.id, "username": u.username, "full_name": u.full_name})

    return {
        "id": dl.id,
        "title": dl.title,
        "description": dl.description,
        "due_date": dl.due_date.isoformat() if dl.due_date else None,
        "assigned_department": dl.assigned_department,
        "status": dl.status,
        "created_by_name": creator.full_name if creator else "",
        "recipients": recipients_out,
        "uses_explicit_recipients": bool(recipients_out),
        "can_reply": _can_reply_as_recipient(db, current_user, dl),
        "initial_attachments": [
            {"id": a.id, "original_file_name": a.original_file_name, "file_size": a.file_size} for a in initial_atts
        ],
        "replies": replies_out,
    }


@router.post("/{deadline_id}/reply")
async def reply_deadline(
    deadline_id: int,
    note: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Tối đa {MAX_FILES} file")

    dl = db.query(models.Deadline).filter(models.Deadline.id == deadline_id).first()
    if not dl:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")
    if not _can_reply_as_recipient(db, current_user, dl):
        raise HTTPException(status_code=403, detail="Chỉ người nhận deadline mới được gửi phản hồi")

    has_file = any(getattr(f, "filename", None) for f in (files or []))
    if not (note and str(note).strip()) and not has_file:
        raise HTTPException(status_code=400, detail="Vui lòng nhập ghi chú hoặc đính kèm ít nhất một file")

    rep = models.DeadlineReply(deadline_id=dl.id, author_id=current_user.id, note=note or None)
    db.add(rep)
    db.flush()

    if files:
        _save_uploaded_files(dl.id, f"d{dl.id}_r{rep.id}", files, current_user.id, db, reply_id=rep.id)

    db.commit()

    # Thông báo người gửi + các người nhận khác (không báo cho chính người vừa phản hồi)
    pool = {dl.created_by, *_recipient_user_ids(db, dl)}
    pool.discard(current_user.id)
    notify_ids = list(pool)
    _notify(
        db,
        notify_ids,
        "Phản hồi deadline",
        f"{current_user.full_name} đã gửi phản hồi cho: {dl.title}",
        f"/deadlines?open={dl.id}",
    )
    db.commit()

    return {"message": "Đã gửi phản hồi", "reply_id": rep.id}


def _get_attachment_or_404(att_id: int, db: Session, user: models.User) -> models.DeadlineAttachment:
    att = db.query(models.DeadlineAttachment).filter(models.DeadlineAttachment.id == att_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Không tìm thấy file")
    dl = db.query(models.Deadline).filter(models.Deadline.id == att.deadline_id).first()
    if not dl or not _can_view_deadline(db, user, dl):
        raise HTTPException(status_code=403, detail="Không có quyền")
    if not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="File không còn trên máy chủ")
    return att


@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    att = _get_attachment_or_404(attachment_id, db, current_user)
    return FileResponse(att.file_path, filename=att.original_file_name)


@router.get("/attachments/{attachment_id}/preview")
def preview_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    att = _get_attachment_or_404(attachment_id, db, current_user)
    ext = os.path.splitext(att.original_file_name)[1].lower()
    if ext == ".pdf":
        return FileResponse(att.file_path, media_type="application/pdf", filename=att.original_file_name)
    if ext == ".docx":
        html = docx_to_html(att.file_path)
        return JSONResponse({"html": html, "original_file_name": att.original_file_name})
    raise HTTPException(status_code=400, detail="Không hỗ trợ xem trước định dạng này")


@router.delete("/{deadline_id}")
def delete_deadline(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if "BGH" not in _roles(current_user):
        raise HTTPException(status_code=403, detail="Chỉ BGH được xóa deadline")

    dl = db.query(models.Deadline).filter(models.Deadline.id == deadline_id).first()
    if not dl:
        raise HTTPException(status_code=404, detail="Not found")

    db.query(models.DeadlineRecipient).filter(models.DeadlineRecipient.deadline_id == deadline_id).delete()
    atts = db.query(models.DeadlineAttachment).filter(models.DeadlineAttachment.deadline_id == deadline_id).all()
    for a in atts:
        if os.path.exists(a.file_path):
            try:
                os.remove(a.file_path)
            except OSError:
                pass
        db.delete(a)
    db.query(models.DeadlineReply).filter(models.DeadlineReply.deadline_id == deadline_id).delete()
    db.delete(dl)
    db.commit()
    return {"success": True}
