import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import ChatSession, ChatMessage, ChatSessionStatus

router = APIRouter()


class HistoryMessage(BaseModel):
    sender: str  # user | assistant
    content: str


class SessionCreate(BaseModel):
    user_id: str
    user_name: str
    history: list[HistoryMessage] = []


class MessageCreate(BaseModel):
    sender: str  # user | agent
    sender_name: str
    content: str


class TakeRequest(BaseModel):
    agent_id: str
    agent_name: str


class CloseRequest(BaseModel):
    by: str


def session_to_dict(s: ChatSession) -> dict:
    return {
        "id": s.id,
        "userId": s.user_id,
        "userName": s.user_name,
        "status": s.status.value,
        "agentId": s.agent_id,
        "agentName": s.agent_name,
        "createdAt": s.created_at.isoformat(),
        "updatedAt": s.updated_at.isoformat(),
    }


def message_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "sessionId": m.session_id,
        "sender": m.sender,
        "senderName": m.sender_name,
        "content": m.content,
        "createdAt": m.created_at.isoformat(),
    }


def add_system_message(db: Session, session_id: int, content: str) -> ChatMessage:
    msg = ChatMessage(session_id=session_id, sender="system", sender_name="", content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# ---------------- WebSocket: gestor de conexiones ----------------


class ConnectionManager:
    """Mantiene las conexiones WebSocket agrupadas por sesión de chat."""

    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, session_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(session_id, []).append(ws)

    def disconnect(self, session_id: int, ws: WebSocket):
        conns = self.active.get(session_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.active.pop(session_id, None)

    async def broadcast(self, session_id: int, event: dict):
        for ws in list(self.active.get(session_id, [])):
            try:
                await ws.send_text(json.dumps(event, ensure_ascii=False))
            except Exception:
                self.disconnect(session_id, ws)


manager = ConnectionManager()


def save_message(session_id: int, sender: str, sender_name: str, content: str) -> dict | None:
    """Guarda un mensaje en la BD (sesión corta, usable desde WS). None si no procede."""
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session or session.status == ChatSessionStatus.cerrada:
            return None
        msg = ChatMessage(session_id=session_id, sender=sender, sender_name=sender_name, content=content)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return message_to_dict(msg)
    finally:
        db.close()


@router.websocket("/ws/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: int):
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            await websocket.close(code=4404)
            return
    finally:
        db.close()

    await manager.connect(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue
            sender = data.get("sender", "")
            content = (data.get("content") or "").strip()
            sender_name = data.get("sender_name", "")
            if sender not in ("user", "agent") or not content:
                continue
            saved = save_message(session_id, sender, sender_name, content)
            if saved:
                await manager.broadcast(session_id, {"type": "message", "message": saved})
            else:
                await websocket.send_text(json.dumps(
                    {"type": "error", "detail": "La conversación está cerrada."}, ensure_ascii=False))
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception:
        manager.disconnect(session_id, websocket)


# ---------------- REST: gestión de sesiones ----------------


@router.post("/sessions", status_code=201)
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(user_id=data.user_id, user_name=data.user_name, status=ChatSessionStatus.en_cola)
    db.add(session)
    db.commit()
    db.refresh(session)

    for msg in data.history[-30:]:
        sender = msg.sender if msg.sender in ("user", "assistant") else "user"
        db.add(ChatMessage(session_id=session.id, sender=sender, sender_name="", content=msg.content))
    db.commit()

    add_system_message(db, session.id, f"{data.user_name} solicita hablar con un asesor.")
    return session_to_dict(session)


@router.get("/sessions")
def list_sessions(status: str | None = None, agent_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(ChatSession)
    if status == "en_cola":
        query = query.filter(ChatSession.status == ChatSessionStatus.en_cola)
    elif status == "con_asesor" and agent_id:
        query = query.filter(ChatSession.status == ChatSessionStatus.con_asesor, ChatSession.agent_id == agent_id)
    elif status:
        query = query.filter(ChatSession.status == status)
    return [session_to_dict(s) for s in query.order_by(ChatSession.created_at.asc()).all()]


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    return session_to_dict(session)


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: int, after_id: int = 0, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.id > after_id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    return [message_to_dict(m) for m in messages]


@router.post("/sessions/{session_id}/messages", status_code=201)
async def post_message(session_id: int, data: MessageCreate, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status == ChatSessionStatus.cerrada:
        raise HTTPException(status_code=400, detail="La conversación está cerrada")
    if data.sender not in ("user", "agent"):
        raise HTTPException(status_code=400, detail="Remitente inválido")

    message = ChatMessage(session_id=session_id, sender=data.sender, sender_name=data.sender_name, content=data.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    await manager.broadcast(session_id, {"type": "message", "message": message_to_dict(message)})
    return message_to_dict(message)


@router.post("/sessions/{session_id}/take")
async def take_session(session_id: int, data: TakeRequest, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status != ChatSessionStatus.en_cola:
        raise HTTPException(status_code=400, detail="La sesión ya fue tomada por otro asesor o está cerrada")

    session.status = ChatSessionStatus.con_asesor
    session.agent_id = data.agent_id
    session.agent_name = data.agent_name
    db.commit()
    db.refresh(session)
    sys_msg = add_system_message(db, session.id, f"El asesor {data.agent_name} se ha unido a la conversación.")
    await manager.broadcast(session_id, {"type": "message", "message": message_to_dict(sys_msg)})
    await manager.broadcast(session_id, {"type": "status", "status": session.status.value, "agentName": data.agent_name})
    return session_to_dict(session)


@router.post("/sessions/{session_id}/close")
async def close_session(session_id: int, data: CloseRequest, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status == ChatSessionStatus.cerrada:
        return session_to_dict(session)

    session.status = ChatSessionStatus.cerrada
    db.commit()
    db.refresh(session)
    sys_msg = add_system_message(db, session.id, f"Conversación cerrada por {data.by}.")
    await manager.broadcast(session_id, {"type": "message", "message": message_to_dict(sys_msg)})
    await manager.broadcast(session_id, {"type": "status", "status": session.status.value})
    return session_to_dict(session)
