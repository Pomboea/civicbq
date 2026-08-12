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

app = FastAPI(title="CivicBQ API", version="1.0.0")

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
