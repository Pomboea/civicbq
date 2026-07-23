from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole
from schemas import LoginRequest, LoginResponse, RegisterRequest
from auth import verify_password, create_access_token, hash_password

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    token = create_access_token(user.id, user.role.value)
    return LoginResponse(userId=user.id, username=user.username, nombre=user.nombre, role=user.role.value, token=token)


@router.post("/register", response_model=LoginResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    last = db.query(User).order_by(User.id.desc()).first()
    next_num = int(last.id.replace("U", "")) + 1 if last else 1
    user = User(id=f"U{str(next_num).zfill(3)}", username=request.username, password=hash_password(request.password),
                nombre=request.nombre, email=request.email, role=UserRole.ciudadano, activo=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role.value)
    return LoginResponse(userId=user.id, username=user.username, nombre=user.nombre, role=user.role.value, token=token)
