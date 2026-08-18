"""Bot de Telegram para CivicBQ.

Recibe preguntas en lenguaje natural por Telegram y las responde usando
el asistente de IA del backend (FastAPI) que consulta la base de datos
con herramientas autorizadas de solo lectura.

Se ejecuta en dos modos:
  1. En la nube (Render): el backend lo inicia automáticamente en un hilo
     cuando la variable TELEGRAM_BOT_TOKEN está configurada. No hace falta
     nada más: se despliega y el bot queda activo.
  2. Local (script):
        $env:TELEGRAM_BOT_TOKEN="tu-token"
        python telegram_bot.py

Crea el bot con @BotFather en Telegram y copia el token.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
BACKEND_URL = (
    os.getenv("BACKEND_URL")
    or os.getenv("RENDER_EXTERNAL_URL")  # Render expone aquí la URL pública del servicio
    or "http://localhost:8000"
)
TELEGRAM_API = f"https://api.telegram.org/bot{TOKEN}"

WELCOME_MESSAGE = (
    "¡Hola! Soy el asistente virtual de CivicBQ.\n\n"
    "Puedo consultar la base de datos del sistema por ti. Por ejemplo:\n"
    "- ¿Cuántas PQR hay registradas?\n"
    "- ¿Cuántos usuarios tiene el sistema?\n"
    "- ¿Cuántos comentarios se han hecho?\n\n"
    "Escribe tu pregunta cuando quieras."
)


def http_post(url: str, payload: dict, timeout: int = 200) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get(url: str, timeout: int = 60) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_message(chat_id: int, text: str) -> None:
    http_post(f"{TELEGRAM_API}/sendMessage", {"chat_id": chat_id, "text": text})


def ask_assistant(question: str) -> str:
    try:
        result = http_post(f"{BACKEND_URL}/api/assistant/query", {"question": question})
        return result.get("answer", "No obtuve respuesta del asistente.")
    except urllib.error.URLError:
        return (
            "El servicio del asistente no está disponible en este momento. "
            "Verifica que el backend de CivicBQ esté en ejecución."
        )
    except Exception as e:
        return f"Ocurrió un error al procesar tu pregunta: {e}"


def run_bot() -> None:
    """Bucle principal de polling (bloqueante). Corre en un hilo cuando lo
    inicia el backend en la nube, o como script local."""
    if not TOKEN:
        print("ERROR: Falta TELEGRAM_BOT_TOKEN. El bot de Telegram no se inició.")
        return

    print(f"Bot de Telegram iniciado (polling). Backend: {BACKEND_URL}")
    offset = 0

    while True:
        try:
            updates = http_get(f"{TELEGRAM_API}/getUpdates?offset={offset}&timeout=30")
        except urllib.error.URLError as e:
            print(f"Sin conexión con Telegram ({e.reason}). Reintentando en 5s...")
            time.sleep(5)
            continue
        except Exception as e:
            print(f"Error consultando Telegram: {e}. Reintentando en 5s...")
            time.sleep(5)
            continue

        for update in updates.get("result", []):
            offset = update["update_id"] + 1
            message = update.get("message") or {}
            text = (message.get("text") or "").strip()
            chat = message.get("chat") or {}
            chat_id = chat.get("id")
            if not text or chat_id is None:
                continue

            user = (message.get("from") or {}).get("first_name", "")
            print(f"[{chat.get('username', user)}] {text}")

            if text.startswith("/start") or text.startswith("/ayuda"):
                reply = WELCOME_MESSAGE
            else:
                reply = ask_assistant(text)

            try:
                send_message(chat_id, reply)
            except Exception as e:
                print(f"No se pudo enviar la respuesta: {e}")


def main() -> None:
    if not TOKEN:
        print("ERROR: Falta el token del bot.")
        print('En PowerShell ejecuta:  $env:TELEGRAM_BOT_TOKEN="tu-token"')
        sys.exit(1)

    try:
        run_bot()
    except KeyboardInterrupt:
        print("\nBot detenido.")


if __name__ == "__main__":
    main()