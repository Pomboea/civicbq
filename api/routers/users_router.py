from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserResponse, UserResetPassword
from auth import get_current_user, require_roles, hash_password

router = APIRouter()


@router.get("", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["admin"]))):
    return db.query(User).all()


@router.patch("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_active(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["admin"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")
    user.activo = not user.activo
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/reset-password", response_model=UserResponse)
def reset_password(user_id: str, data: UserResetPassword, db: Session = Depends(get_db),
                   current_user: User = Depends(require_roles(["admin"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.password = hash_password(data.newPassword)
    db.commit()
    db.refresh(user)
    return user
