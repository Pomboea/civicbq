import datetime
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    nombre: str
    email: str


class LoginResponse(BaseModel):
    userId: str
    username: str
    nombre: str
    role: str
    token: str


class CommentResponse(BaseModel):
    id: str
    pqrId: str
    userId: str
    userName: str
    content: str
    createdAt: datetime.datetime


class PqrResponse(BaseModel):
    id: str
    titulo: str
    categoria: str
    descripcion: str
    ubicacion: str
    prioridad: str
    estado: str
    creadoPor: str
    creadoPorNombre: str
    asignadoA: Optional[str] = None
    asignadoANombre: Optional[str] = None
    comentarios: list[CommentResponse] = []
    createdAt: datetime.datetime
    updatedAt: datetime.datetime
    class Config:
        from_attributes = True


class PqrCreate(BaseModel):
    titulo: str
    categoria: str
    descripcion: str
    ubicacion: str
    prioridad: str


class PqrUpdate(BaseModel):
    titulo: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    ubicacion: Optional[str] = None
    prioridad: Optional[str] = None


class StatusChange(BaseModel):
    estado: str


class CommentCreate(BaseModel):
    content: str


class UserResponse(BaseModel):
    id: str
    username: str
    nombre: str
    email: str
    role: str
    activo: bool
    class Config:
        from_attributes = True


class UserResetPassword(BaseModel):
    newPassword: str


class StatsResponse(BaseModel):
    total: int
    porEstado: dict[str, int]
    porCategoria: dict[str, int]
