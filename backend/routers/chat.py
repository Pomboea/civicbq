import json
import os
import urllib.request
import urllib.error

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

SYSTEM_PROMPT = """Eres el asistente virtual de CivicBQ, un sistema de gestión de PQR (Peticiones, Quejas y Reclamos) de una alcaldía municipal en Colombia. Tu nombre es "Asistente CivicBQ".

REGLAS:
- Responde SIEMPRE en español, de forma clara, amable y concisa (máximo 3-4 párrafos cortos).
- Solo respondes preguntas relacionadas con el sistema CivicBQ, las PQR y trámites ciudadanos. Si te preguntan algo fuera de ese tema, indica amablemente que solo puedes ayudar con temas de CivicBQ.
- Si no sabes algo con certeza, no inventes datos: sugiere contactar la línea de atención ciudadana.
- No uses formato markdown complejo; puedes usar listas simples si ayudan a la claridad.

INFORMACIÓN DEL SISTEMA CIVICBQ:
- Crear una PQR: el ciudadano ingresa al módulo "Nueva PQR" desde el menú lateral, completa título, categoría, descripción detallada, ubicación y prioridad. Al enviarla recibe un número de radicado para seguimiento.
- Categorías: Infraestructura (vías, puentes, espacios públicos), Seguridad (vigilancia, emergencias), Salud (hospitales, medicamentos), Medio Ambiente (árboles, contaminación), Tránsito (semáforos, señalización) y Otros.
- Estados de una PQR: Recibida, En revisión, En proceso, Resuelta y Rechazada.
- Prioridades y tiempos de respuesta inicial: Urgente (máx. 24 horas), Alta (máx. 3 días hábiles), Media (máx. 8 días hábiles), Baja (máx. 15 días hábiles).
- Edición: el ciudadano solo puede editar su PQR mientras está en estado "Recibida".
- Seguimiento: desde "Mis PQR" el ciudadano ve el estado actual y los comentarios del operador.
- Asignación: los supervisores asignan operadores según categoría y carga de trabajo.
- Rechazo: se notifica con los motivos; el ciudadano puede crear una nueva PQR corregida o pedir revisión al supervisor.
- Roles del sistema: Ciudadano (crea y consulta sus PQR), Operador (gestiona PQR asignadas), Supervisor (supervisa y asigna) y Administrador (configura el sistema y gestiona usuarios).
- Contraseña olvidada: el administrador del sistema debe restablecerla; no hay recuperación automática.
- Contacto: Línea de Atención Ciudadana 01 8000 123 456 (gratuita), correo atencion@civicbq.gov.co, oficina en la Alcaldía Municipal, primer piso, lunes a viernes de 8:00 am a 5:00 pm.

ESCALACIÓN A ASESOR HUMANO:
- Si el usuario pide hablar con una persona, un asesor, un humano o un operador, o si muestra frustración porque no logras resolver su duda, USA la herramienta "solicitar_asesor".
- Después de usarla, dile al usuario que lo estás comunicando con un asesor humano.
"""

ESCALATION_TOOL = {
    "type": "function",
    "function": {
        "name": "solicitar_asesor",
        "description": "Escala la conversación a un asesor humano cuando el usuario lo pide o la IA no puede resolver la duda.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessageIn]


class ChatResponse(BaseModel):
    reply: str
    model: str
    escalate: bool = False


@router.post("", response_model=ChatResponse)
def chat(data: ChatRequest):
    if not data.messages:
        raise HTTPException(status_code=400, detail="Se requiere al menos un mensaje")

    ollama_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in data.messages[-20:]:
        role = msg.role if msg.role in ("user", "assistant") else "user"
        ollama_messages.append({"role": role, "content": msg.content})

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "tools": [ESCALATION_TOOL],
        "stream": False,
        "options": {"temperature": 0.3},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        message = result.get("message") or {}
        escalate = False

        # Si el modelo pide escalar a un asesor, confirmamos y pedimos la respuesta final
        for _ in range(2):
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                break
            ollama_messages.append(message)
            for call in tool_calls:
                name = (call.get("function") or {}).get("name", "")
                if name == "solicitar_asesor":
                    escalate = True
                    tool_result = {"resultado": "escalado", "mensaje": "El usuario será comunicado con un asesor humano."}
                else:
                    tool_result = {"error": f"herramienta '{name}' no existe"}
                ollama_messages.append({
                    "role": "tool",
                    "name": name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })
            payload = json.dumps({
                "model": OLLAMA_MODEL,
                "messages": ollama_messages,
                "tools": [ESCALATION_TOOL],
                "stream": False,
                "options": {"temperature": 0.3},
            }).encode("utf-8")
            req = urllib.request.Request(
                f"{OLLAMA_URL}/api/chat",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            message = result.get("message") or {}
    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar con Ollama ({OLLAMA_URL}). Verifica que esté en ejecución. Detalle: {e.reason}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al consultar el modelo de IA: {e}")

    reply = (message.get("content") or "").strip()
    if not reply:
        if escalate:
            reply = "Entendido, te comunico con un asesor humano. Un momento, por favor."
        else:
            raise HTTPException(status_code=502, detail="El modelo no devolvió una respuesta")

    return ChatResponse(reply=reply, model=OLLAMA_MODEL, escalate=escalate)


@router.get("/status")
def chat_status():
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
        models = [m.get("name", "") for m in tags.get("models", [])]
        return {
            "ollama": "ok",
            "url": OLLAMA_URL,
            "model": OLLAMA_MODEL,
            "model_available": any(m == OLLAMA_MODEL or m.startswith(OLLAMA_MODEL) for m in models),
            "models": models,
        }
    except Exception as e:
        return {"ollama": "unreachable", "url": OLLAMA_URL, "model": OLLAMA_MODEL, "detail": str(e)}
