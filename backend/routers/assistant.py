import json
import os
import urllib.request
import urllib.error

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Pqr, Comment

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

SYSTEM_PROMPT = """Eres el asistente virtual de CivicBQ (sistema de gestión de PQR de una alcaldía) y atiendes consultas por Telegram.

REGLAS:
- Responde SIEMPRE en español, de forma breve y amable (máximo 2-3 frases).
- Para preguntas sobre datos de la base de datos, USA las herramientas disponibles. NUNCA inventes números: solo reportas lo que la herramienta devuelva.
- Solo puedes responder con datos que las herramientas te den (conteos de PQR, usuarios y comentarios). Si te preguntan algo que las herramientas no pueden responder, dilo amablemente y menciona qué sí puedes consultar.
- No reveles datos personales ni detalles internos del sistema.
"""


# --- Herramientas autorizadas (solo lectura). La IA NO puede ejecutar SQL libre,
# --- solo estas funciones predefinidas (misma filosofía del tools.yaml de la práctica).

def contar_pqrs(db: Session) -> dict:
    return {"total_pqrs": db.query(Pqr).count()}


def contar_usuarios(db: Session) -> dict:
    return {"total_usuarios": db.query(User).count()}


def contar_comentarios(db: Session) -> dict:
    return {"total_comentarios": db.query(Comment).count()}


TOOL_FUNCTIONS = {
    "contar_pqrs": contar_pqrs,
    "contar_usuarios": contar_usuarios,
    "contar_comentarios": contar_comentarios,
}

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "contar_pqrs",
            "description": "Cuenta cuántas PQR (peticiones, quejas y reclamos) hay registradas en total en el sistema.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contar_usuarios",
            "description": "Cuenta cuántos usuarios hay registrados en total en el sistema.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contar_comentarios",
            "description": "Cuenta cuántos comentarios de seguimiento hay en total en las PQR.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


class AssistantQuery(BaseModel):
    question: str


class AssistantAnswer(BaseModel):
    answer: str
    tools_used: list[str]


def _ollama_chat(messages: list[dict]) -> dict:
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": messages,
        "tools": TOOL_DEFINITIONS,
        "stream": False,
        "options": {"temperature": 0.2},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


@router.post("/query", response_model=AssistantAnswer)
def assistant_query(data: AssistantQuery, db: Session = Depends(get_db)):
    question = data.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    tools_used: list[str] = []

    try:
        result = _ollama_chat(messages)
        message = result.get("message") or {}

        # Si el modelo pide usar herramientas, las ejecutamos y volvemos a consultar
        for _ in range(3):  # máximo 3 rondas de herramientas
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                break
            messages.append(message)
            for call in tool_calls:
                name = (call.get("function") or {}).get("name", "")
                func = TOOL_FUNCTIONS.get(name)
                if func is None:
                    tool_result = {"error": f"herramienta '{name}' no existe"}
                else:
                    tool_result = func(db)
                    tools_used.append(name)
                messages.append({
                    "role": "tool",
                    "name": name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })
            result = _ollama_chat(messages)
            message = result.get("message") or {}
    except urllib.error.URLError as e:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar con Ollama. Detalle: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al consultar el modelo de IA: {e}")

    answer = (message.get("content") or "").strip()
    if not answer:
        answer = "Lo siento, no pude generar una respuesta. Intenta reformular tu pregunta."

    return AssistantAnswer(answer=answer, tools_used=tools_used)
