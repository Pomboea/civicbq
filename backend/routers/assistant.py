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

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"


def using_groq() -> bool:
    return bool(GROQ_API_KEY)

SYSTEM_PROMPT = """Eres el asistente virtual de CivicBQ (sistema de gestiÃ³n de PQR de una alcaldÃ­a) y atiendes consultas por Telegram.

REGLAS:
- Responde SIEMPRE en espaÃ±ol, de forma breve y amable (mÃ¡ximo 2-3 frases).
- Para preguntas sobre datos de la base de datos, USA las herramientas disponibles. NUNCA inventes nÃºmeros: solo reportas lo que la herramienta devuelva.
- Solo puedes responder con datos que las herramientas te den (conteos de PQR, usuarios y comentarios). Si te preguntan algo que las herramientas no pueden responder, dilo amablemente y menciona quÃ© sÃ­ puedes consultar.
- No reveles datos personales ni detalles internos del sistema.
"""


# --- Herramientas autorizadas (solo lectura). La IA NO puede ejecutar SQL libre,
# --- solo estas funciones predefinidas (misma filosofÃ­a del tools.yaml de la prÃ¡ctica).

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
            "description": "Cuenta cuÃ¡ntos comentarios de seguimiento hay en total en las PQR.",
            "parameters": {"type": "object", "properties": {}, "required": []},
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
    content = json.dumps(result, ensure_ascii=False)
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
                    tool_result = func(db)
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

