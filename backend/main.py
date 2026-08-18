import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from seed import seed
from routers.auth import router as auth_router
from routers.pqrs import router as pqrs_router
from routers.users import router as users_router
from routers.chat import router as chat_router
from routers.assistant import router as assistant_router
from routers.livechat import router as livechat_router


def _start_telegram_bot() -> None:
    """Inicia el bot de Telegram en un hilo si el token está configurado."""
    if not os.getenv("TELEGRAM_BOT_TOKEN", "").strip():
        return
    from telegram_bot import run_bot

    t = threading.Thread(target=run_bot, daemon=True, name="telegram-bot")
    t.start()
    print("Telegram bot iniciado en hilo de fondo")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _start_telegram_bot()
    yield


app = FastAPI(title="CivicBQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Base.metadata.create_all(bind=engine)
seed()

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(pqrs_router, prefix="/api/pqrs", tags=["pqrs"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(assistant_router, prefix="/api/assistant", tags=["assistant"])
app.include_router(livechat_router, prefix="/api/livechat", tags=["livechat"])


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "CivicBQ API running"}
