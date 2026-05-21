from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, auth_utils
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

def require_bgh(current_user: models.User = Depends(get_current_user)):
    """Yêu cầu quyền BGH để thực hiện thao tác"""
    role = "GIAO_VIEN"
    if current_user.roles:
        role = current_user.roles[0].role_name
    if role != "BGH":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Ban Giám Hiệu mới có quyền thực hiện thao tác này"
        )
    return current_user

def assign_role(user_id: int, role_name: str, db: Session):
    db.query(models.UserRole).filter(models.UserRole.user_id == user_id).delete()
    role = db.query(models.Role).filter(models.Role.role_name == role_name.upper()).first()
    if not role:
        role = models.Role(role_name=role_name.upper())
        db.add(role)
        db.commit()
        db.refresh(role)
    new_user_role = models.UserRole(user_id=user_id, role_id=role.id)
    db.add(new_user_role)
    db.commit()

def map_user_with_role(user: models.User, fallback_role: str = "GIAO_VIEN"):
    u_dict = user.__dict__.copy()
    try:
        if user.roles:
            u_dict["role"] = user.roles[0].role_name
        else:
            u_dict["role"] = fallback_role
    except Exception:
        u_dict["role"] = fallback_role
    return schemas.UserOut(**u_dict)

@router.post("", response_model=schemas.UserOut)
@router.post("/", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_bgh)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    
    hashed_password = auth_utils.get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        password=hashed_password,
        department=user.department,
        status=user.status
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    assign_role(new_user.id, user.role or "GIAO_VIEN", db)
    
    # Reload lại user để lấy roles
    db.refresh(new_user)
    
    return map_user_with_role(new_user, fallback_role=user.role or "GIAO_VIEN")

@router.get("", response_model=List[schemas.UserOut])
@router.get("/", response_model=List[schemas.UserOut])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return [map_user_with_role(u) for u in users]

@router.put("/{user_id}", response_model=schemas.UserOut)
@router.put("/{user_id}/", response_model=schemas.UserOut)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_bgh)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    update_data = user.dict(exclude_unset=True)
    role_update = update_data.pop("role", None)
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    
    if role_update:
        assign_role(user_id, role_update, db)
        
    db.refresh(db_user)
    return map_user_with_role(db_user)

@router.delete("/{user_id}")
@router.delete("/{user_id}/")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_bgh)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    db.query(models.UserRole).filter(models.UserRole.user_id == user_id).delete()
    db.delete(db_user)
    db.commit()
    return {"message": "Đã xóa người dùng thành công"}

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return map_user_with_role(current_user)
