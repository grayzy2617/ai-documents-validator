from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, JSON, TIMESTAMP, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)

class UserRole(Base):
    __tablename__ = "user_roles"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    department = Column(String(50), nullable=True)
    status = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    reset_token = Column(String(255), nullable=True)
    token_expiry = Column(TIMESTAMP, nullable=True)
    
    # Relationships
    roles = relationship("Role", secondary="user_roles")
    documents = relationship("UserDocument", back_populates="owner", foreign_keys="UserDocument.user_id")

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=False) # Nghị định, Thông tư
    file_path = Column(String(255), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    access_level = Column(String(50), default="GIAO_VIEN") # GIAO_VIEN, TO_TRUONG, BGH
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

class UserDocument(Base):
    __tablename__ = "user_documents"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_file_name = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING")
    ai_score = Column(Integer, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(TIMESTAMP, nullable=True)
    metadata_info = Column(JSON, nullable=True) # Lưu json metadata (tác giả, số trang...)
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=True)
    deadline_reply_id = Column(Integer, ForeignKey("deadline_replies.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    owner = relationship("User", back_populates="documents", foreign_keys=[user_id])
    check_histories = relationship("CheckHistory", back_populates="document")
    reviews = relationship("DocumentReview", back_populates="document")
    deadline = relationship("Deadline", foreign_keys=[deadline_id])
    deadline_reply = relationship("DeadlineReply", foreign_keys=[deadline_reply_id])

class CheckHistory(Base):
    __tablename__ = "check_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("user_documents.id"), nullable=False)
    fixed_file_path = Column(String(255), nullable=True)
    check_date = Column(TIMESTAMP, server_default=func.now())
    
    document = relationship("UserDocument", back_populates="check_histories")
    errors = relationship("DetectedError", back_populates="history")

class DetectedError(Base):
    __tablename__ = "detected_errors"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("check_history.id"), nullable=False)
    error_type = Column(String(100), nullable=False)
    error_location = Column(String(255), nullable=True)
    description = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)
    status = Column(String(50), default="UNFIXED") # UNFIXED, AUTO_FIXED, IGNORED, VERIFIED
    reviewer_comment = Column(Text, nullable=True) # Nhận xét của Reviewer
    
    history = relationship("CheckHistory", back_populates="errors")

class DocumentReview(Base):
    __tablename__ = "document_reviews"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("user_documents.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    review_status = Column(String(50), nullable=False) # APPROVED, REJECTED, NEEDS_REVISION
    comments = Column(Text, nullable=True)
    reviewed_at = Column(TIMESTAMP, server_default=func.now())
    
    document = relationship("UserDocument", back_populates="reviews")

class SystemConfig(Base):
    __tablename__ = "system_configs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    config_key = Column(String(50), unique=True, nullable=False)
    config_value = Column(JSON, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class Deadline(Base):
    __tablename__ = "deadlines"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(TIMESTAMP, nullable=False)
    assigned_department = Column(String(50), nullable=True) # None = all
    status = Column(String(50), default="PENDING")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    replies = relationship("DeadlineReply", back_populates="deadline", order_by="DeadlineReply.created_at")
    attachments = relationship(
        "DeadlineAttachment",
        back_populates="deadline",
        foreign_keys="DeadlineAttachment.deadline_id",
        order_by="DeadlineAttachment.created_at",
    )
    recipient_links = relationship(
        "DeadlineRecipient",
        back_populates="deadline",
        cascade="all, delete-orphan",
    )


class DeadlineRecipient(Base):
    """Người nhận deadline (chọn username khi tạo). Deadline cũ không có dòng này thì dùng logic assigned_department."""
    __tablename__ = "deadline_recipients"
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)

    deadline = relationship("Deadline", back_populates="recipient_links")
    user = relationship("User", foreign_keys=[user_id])


class DeadlineReply(Base):
    """Phản hồi của người nhận deadline (đường về) trên cùng một deadline."""
    __tablename__ = "deadline_replies"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    deadline = relationship("Deadline", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])
    attachments = relationship("DeadlineAttachment", back_populates="reply", foreign_keys="DeadlineAttachment.reply_id")


class DeadlineAttachment(Base):
    """File đính kèm deadline (lúc tạo: reply_id NULL) hoặc kèm phản hồi tổ trưởng."""
    __tablename__ = "deadline_attachments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=False)
    reply_id = Column(Integer, ForeignKey("deadline_replies.id"), nullable=True)
    original_file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    deadline = relationship("Deadline", back_populates="attachments", foreign_keys=[deadline_id])
    reply = relationship("DeadlineReply", back_populates="attachments", foreign_keys=[reply_id])

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    target_table = Column(String(50), nullable=True)
    target_id = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    action_url = Column(String(512), nullable=True)

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    original_file_name = Column(String(255), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
