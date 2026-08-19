import json
import os
import re
import urllib.request
import urllib.error

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import User, Pqr, Comment

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"


def using_groq() -> bool:
    return bool(GROQ_API_KEY)

SYSTEM_PROMPT = """Eres el asistente virtual de CivicBQ (sistema de gestión de PQR de una alcaldía) y atiendes consultas por Telegram.

REGLAS:
- Responde SIEMPRE en español, de forma breve y amable (máximo 3-4 frases; si muestras datos usa listas simples).
- Para responder preguntas sobre el contenido de la base de datos, USA la herramienta "consultar_bd" con SQL de solo lectura. NUNCA inventes datos: solo reportas lo que devuelva la consulta.
- Si tu consulta falla, corrígela e inténtala de nuevo (revisa nombres de columnas y comillas simples).
- No reveles la columna password ni contraseñas en tus respuestas.
- Solo consultas SELECT: nunca intentes modificar datos.

ESQUEMA DE LA BASE DE DATOS (PostgreSQL):
- users(id, username, password, nombre, email, role, activo) — role: ciudadano, operador, supervisor, admin
- pqrs(id, titulo, categoria, descripcion, ubicacion, prioridad, estado, creado_por, creado_por_nombre, asignado_a, asignado_a_nombre, created_at, updated_at)
- comments(id, pqr_id, user_id, user_name, content, created_at)
- chat_sessions(id, user_id, user_name, status, agent_id, agent_name, created_at, updated_at) — status: en_cola, con_asesor, cerrada
- chat_messages(id, session_id, sender, sender_name, content, created_at)

VALORES DE LOS ENUM (guardados así en la base):
- categoria: Infraestructura, Seguridad, Salud, Medio_Ambiente, Transito, Otros
- estado: Recibida, En_revision, En_proceso, Resuelta, Rechazada
- prioridad: Baja, Media, Alta, Urgente

Ejemplos de consultas útiles:
- SELECT * FROM pqrs WHERE estado='En_proceso' ORDER BY created_at DESC LIMIT 20
- SELECT titulo, estado, creado_por_nombre FROM pqrs WHERE categoria='Salud'
- SELECT * FROM comments WHERE pqr_id='PQR-005' ORDER BY created_at
- SELECT role, count(*) FROM users GROUP BY role
- SELECT p.titulo, count(c.id) FROM pqrs p LEFT JOIN comments c ON c.pqr_id=p.id GROUP BY p.id, p.titulo

Las fechas se guardan como timestamp; usa DATE(created_at) para filtrar por día.
"""


# --- Herramientas de consulta (solo lectura).

def contar_pqrs(db: Session) -> dict:
    return {"total_pqrs": db.query(Pqr).count()}


def contar_usuarios(db: Session) -> dict:
    return {"total_usuarios": db.query(User).count()}


def contar_comentarios(db: Session) -> dict:
    return {"total_comentarios": db.query(Comment).count()}


def consultar_bd(db: Session, sql: str) -> dict:
    """Ejecuta una consulta SQL de SOLO LECTURA (SELECT) y devuelve las filas."""
    sql_limpio = (sql or "").strip().rstrip(";").strip()
    if not re.match(r"^(SELECT|WITH)\b", sql_limpio, re.IGNORECASE):
        return {"error": "Solo se permiten consultas SELECT (solo lectura)"}
    try:
        filas = db.execute(text(sql_limpio)).mappings().all()
        resultado = [dict(r) for r in filas[:50]]
        return {"filas": resultado, "total_filas": len(filas)}
    except Exception as e:
        return {"error": f"Error en la consulta SQL: {e}"}


TOOL_FUNCTIONS = {
    "contar_pqrs": contar_pqrs,
    "contar_usuarios": contar_usuarios,
    "contar_comentarios": contar_comentarios,
    "consultar_bd": consultar_bd,
}

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "contar_pqrs",
            "description": "Cuenta cuÃ¡ntas PQR (peticiones, quejas y reclamos) hay registradas en total en el sistema.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contar_usuarios",
            "description": "Cuenta cuÃ¡ntos usuarios hay registrados en total en el sistema.",
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
    {
        "type": "function",
        "function": {
            "name": "consultar_bd",
            "description": "Ejecuta una consulta SQL de solo lectura (SELECT) sobre la base de datos para responder preguntas sobre el contenido real: PQR, usuarios, comentarios, sesiones de chat. Devuelve las filas encontradas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "Consulta SQL válida, ej: SELECT * FROM pqrs WHERE estado='En proceso' LIMIT 20",
                    }
                },
                "required": ["sql"],
            },
        },
    },
]


class AssistantQuery(BaseModel):
    question: str


class AssistantAnswer(BaseModel):
    answer: str
    tools_used: list[str]


def _llm_chat(messages: list[dict]) -> dict:
    """Consulta al LLM: Groq si hay clave configurada (nube), si no Ollama (local).
    Devuelve el mensaje crudo del proveedor (para reenviarlo en el ciclo de herramientas)."""
    if using_groq():
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "tools": TOOL_DEFINITIONS,
            "stream": False,
            "temperature": 0.2,
        }
        req = urllib.request.Request(
            GROQ_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}", "User-Agent": BROWSER_UA},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return (result.get("choices") or [{}])[0].get("message") or {}

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
        result = json.loads(resp.read().decode("utf-8"))
    return result.get("message") or {}


def _extract_tool_calls(message: dict) -> list[dict]:
    """Normaliza las llamadas a herramientas de ambos proveedores."""
    calls = []
    for c in message.get("tool_calls") or []:
        fn = c.get("function") or {}
        name = fn.get("name", "")
        args = fn.get("arguments", {})
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}
        calls.append({"id": c.get("id", ""), "name": name, "arguments": args})
    return calls


def _tool_result_message(call: dict, result: dict) -> dict:
    content = json.dumps(result, ensure_ascii=False, default=str)
    if using_groq():
        return {"role": "tool", "tool_call_id": call.get("id", ""), "content": content}
    return {"role": "tool", "name": call.get("name", ""), "content": content}


@router.post("/query", response_model=AssistantAnswer)
def assistant_query(data: AssistantQuery, db: Session = Depends(get_db)):
    question = data.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacÃ­a")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    tools_used: list[str] = []

    try:
        message = _llm_chat(messages)

        # Si el modelo pide usar herramientas, las ejecutamos y volvemos a consultar
        for _ in range(3):  # mÃ¡ximo 3 rondas de herramientas
            calls = _extract_tool_calls(message)
            if not calls:
                break
            messages.append(message)
            for call in calls:
                name = call["name"]
                func = TOOL_FUNCTIONS.get(name)
                if func is None:
                    tool_result = {"error": f"herramienta '{name}' no existe"}
                else:
                    tool_result = func(db, **call.get("arguments", {}))
                    tools_used.append(name)
                messages.append(_tool_result_message(call, tool_result))
            message = _llm_chat(messages)
    except urllib.error.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"El proveedor de IA respondiÃ³ con error HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}",
        )
    except urllib.error.URLError as e:
        if using_groq():
            raise HTTPException(status_code=503, detail=f"No se pudo conectar con Groq. Detalle: {e.reason}")
        raise HTTPException(status_code=503, detail=f"No se pudo conectar con Ollama. Detalle: {e.reason}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al consultar el modelo de IA: {e}")

    answer = (message.get("content") or "").strip()
    if not answer:
        answer = "Lo siento, no pude generar una respuesta. Intenta reformular tu pregunta."

    return AssistantAnswer(answer=answer, tools_used=tools_used)

