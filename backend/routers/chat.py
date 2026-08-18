import json
import os
import urllib.request
import urllib.error

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

SYSTEM_PROMPT = """Eres el asistente virtual de CivicBQ, un sistema de gestiÃ³n de PQR (Peticiones, Quejas y Reclamos) de una alcaldÃ­a municipal en Colombia. Tu nombre es "Asistente CivicBQ".

REGLAS:
- Responde SIEMPRE en espaÃ±ol, de forma clara, amable y concisa (mÃ¡ximo 3-4 pÃ¡rrafos cortos).
- Solo respondes preguntas relacionadas con el sistema CivicBQ, las PQR y trÃ¡mites ciudadanos. Si te preguntan algo fuera de ese tema, indica amablemente que solo puedes ayudar con temas de CivicBQ.
- Si no sabes algo con certeza, no inventes datos: sugiere contactar la lÃ­nea de atenciÃ³n ciudadana.
- No uses formato markdown complejo; puedes usar listas simples si ayudan a la claridad.

INFORMACIÃ“N DEL SISTEMA CIVICBQ:
- Crear una PQR: el ciudadano ingresa al mÃ³dulo "Nueva PQR" desde el menÃº lateral, completa tÃ­tulo, categorÃ­a, descripciÃ³n detallada, ubicaciÃ³n y prioridad. Al enviarla recibe un nÃºmero de radicado para seguimiento.
- CategorÃ­as: Infraestructura (vÃ­as, puentes, espacios pÃºblicos), Seguridad (vigilancia, emergencias), Salud (hospitales, medicamentos), Medio Ambiente (Ã¡rboles, contaminaciÃ³n), TrÃ¡nsito (semÃ¡foros, seÃ±alizaciÃ³n) y Otros.
- Estados de una PQR: Recibida, En revisiÃ³n, En proceso, Resuelta y Rechazada.
- Prioridades y tiempos de respuesta inicial: Urgente (mÃ¡x. 24 horas), Alta (mÃ¡x. 3 dÃ­as hÃ¡biles), Media (mÃ¡x. 8 dÃ­as hÃ¡biles), Baja (mÃ¡x. 15 dÃ­as hÃ¡biles).
- EdiciÃ³n: el ciudadano solo puede editar su PQR mientras estÃ¡ en estado "Recibida".
- Seguimiento: desde "Mis PQR" el ciudadano ve el estado actual y los comentarios del operador.
- AsignaciÃ³n: los supervisores asignan operadores segÃºn categorÃ­a y carga de trabajo.
- Rechazo: se notifica con los motivos; el ciudadano puede crear una nueva PQR corregida o pedir revisiÃ³n al supervisor.
- Roles del sistema: Ciudadano (crea y consulta sus PQR), Operador (gestiona PQR asignadas), Supervisor (supervisa y asigna) y Administrador (configura el sistema y gestiona usuarios).
- ContraseÃ±a olvidada: el administrador del sistema debe restablecerla; no hay recuperaciÃ³n automÃ¡tica.
- Contacto: LÃ­nea de AtenciÃ³n Ciudadana 01 8000 123 456 (gratuita), correo atencion@civicbq.gov.co, oficina en la AlcaldÃ­a Municipal, primer piso, lunes a viernes de 8:00 am a 5:00 pm.

ESCALACIÃ“N A ASESOR HUMANO:
- Si el usuario pide hablar con una persona, un asesor, un humano o un operador, o si muestra frustraciÃ³n porque no logras resolver su duda, USA la herramienta "solicitar_asesor".
- DespuÃ©s de usarla, dile al usuario que lo estÃ¡s comunicando con un asesor humano.
"""

ESCALATION_TOOL = {
    "type": "function",
    "function": {
        "name": "solicitar_asesor",
        "description": "Escala la conversaciÃ³n a un asesor humano cuando el usuario lo pide o la IA no puede resolver la duda.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}


def using_groq() -> bool:
    return bool(GROQ_API_KEY)


def active_model() -> str:
    return GROQ_MODEL if using_groq() else OLLAMA_MODEL


def _llm_chat(messages: list[dict]) -> dict:
    """Consulta al LLM: Groq si hay clave configurada (nube), si no Ollama (local).
    Devuelve el mensaje crudo del proveedor (para poder reenviarlo en el ciclo de herramientas)."""
    if using_groq():
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "tools": [ESCALATION_TOOL],
            "stream": False,
            "temperature": 0.3,
        }
        req = urllib.request.Request(
            GROQ_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}", "User-Agent": BROWSER_UA},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return (result.get("choices") or [{}])[0].get("message") or {}
    else:
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "tools": [ESCALATION_TOOL],
            "stream": False,
            "options": {"temperature": 0.3},
        }
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
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

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in data.messages[-20:]:
        role = msg.role if msg.role in ("user", "assistant") else "user"
        messages.append({"role": role, "content": msg.content})

    escalate = False
    try:
        message = _llm_chat(messages)

        # Si el modelo pide escalar a un asesor, confirmamos y pedimos la respuesta final
        for _ in range(2):
            calls = _extract_tool_calls(message)
            if not calls:
                break
            messages.append(message)  # eco del mensaje del asistente (requerido por ambos proveedores)
            for call in calls:
                if call["name"] == "solicitar_asesor":
                    escalate = True
                    tool_result = {"resultado": "escalado", "mensaje": "El usuario serÃ¡ comunicado con un asesor humano."}
                else:
                    tool_result = {"error": f"herramienta '{call['name']}' no existe"}
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
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar con Ollama ({OLLAMA_URL}). Verifica que estÃ© en ejecuciÃ³n. Detalle: {e.reason}",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error al consultar el modelo de IA: {e}")

    reply = (message.get("content") or "").strip()
    if not reply:
        if escalate:
            reply = "Entendido, te comunico con un asesor humano. Un momento, por favor."
        else:
            raise HTTPException(status_code=502, detail="El modelo no devolviÃ³ una respuesta")

    return ChatResponse(reply=reply, model=active_model(), escalate=escalate)


@router.get("/status")
def chat_status():
    info = {
        "llm": "groq" if using_groq() else "ollama",
        "model": active_model(),
    }
    if using_groq():
        info["groq"] = "configured"
        info["groq_model"] = GROQ_MODEL
        return info
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5) as resp:
            tags = json.loads(resp.read().decode("utf-8"))
        models = [m.get("name", "") for m in tags.get("models", [])]
        info["ollama"] = "ok"
        info["url"] = OLLAMA_URL
        info["model_available"] = any(m == OLLAMA_MODEL or m.startswith(OLLAMA_MODEL) for m in models)
        info["models"] = models
        return info
    except Exception as e:
        info["ollama"] = "unreachable"
        info["url"] = OLLAMA_URL
        info["detail"] = str(e)
        return info
