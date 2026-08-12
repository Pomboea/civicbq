import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
import enum


class UserRole(str, enum.Enum):
    ciudadano = "ciudadano"
    operador = "operador"
    supervisor = "supervisor"
    admin = "admin"


class PqrStatus(str, enum.Enum):
    Recibida = "Recibida"
    En_revision = "En revisión"
    En_proceso = "En proceso"
    Resuelta = "Resuelta"
    Rechazada = "Rechazada"


class PqrCategory(str, enum.Enum):
    Infraestructura = "Infraestructura"
    Seguridad = "Seguridad"
    Salud = "Salud"
    Medio_Ambiente = "Medio Ambiente"
    Transito = "Tránsito"
    Otros = "Otros"


class PqrPriority(str, enum.Enum):
    Baja = "Baja"
    Media = "Media"
    Alta = "Alta"
    Urgente = "Urgente"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.ciudadano)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    pqrs_created = relationship("Pqr", back_populates="creator", foreign_keys="Pqr.creado_por")
    pqrs_assigned = relationship("Pqr", back_populates="assignee", foreign_keys="Pqr.asignado_a")
    comments = relationship("Comment", back_populates="user")


class Pqr(Base):
    __tablename__ = "pqrs"
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria: Mapped[PqrCategory] = mapped_column(SAEnum(PqrCategory), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    ubicacion: Mapped[str] = mapped_column(String(200), nullable=False)
    prioridad: Mapped[PqrPriority] = mapped_column(SAEnum(PqrPriority), default=PqrPriority.Media)
    estado: Mapped[PqrStatus] = mapped_column(SAEnum(PqrStatus), default=PqrStatus.Recibida)
    creado_por: Mapped[str] = mapped_column(String(10), ForeignKey("users.id"))
    creado_por_nombre: Mapped[str] = mapped_column(String(100))
    asignado_a: Mapped[str | None] = mapped_column(String(10), ForeignKey("users.id"), nullable=True)
    asignado_a_nombre: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    creator = relationship("User", back_populates="pqrs_created", foreign_keys=[creado_por])
    assignee = relationship("User", back_populates="pqrs_assigned", foreign_keys=[asignado_a])
    comments = relationship("Comment", back_populates="pqr", cascade="all, delete-orphan", order_by="Comment.created_at")


class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    pqr_id: Mapped[str] = mapped_column(String(10), ForeignKey("pqrs.id"))
    user_id: Mapped[str] = mapped_column(String(10), ForeignKey("users.id"))
    user_name: Mapped[str] = mapped_column(String(100))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now)
    pqr = relationship("Pqr", back_populates="comments")
    user = relationship("User", back_populates="comments")


class ChatSessionStatus(str, enum.Enum):
    en_cola = "en_cola"
    con_asesor = "con_asesor"
    cerrada = "cerrada"


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(10))
    user_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[ChatSessionStatus] = mapped_column(SAEnum(ChatSessionStatus), default=ChatSessionStatus.en_cola)
    agent_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    agent_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"))
    sender: Mapped[str] = mapped_column(String(20))  # user | assistant | agent | system
    sender_name: Mapped[str] = mapped_column(String(100), default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.now)
    session = relationship("ChatSession", back_populates="messages")
