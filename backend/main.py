import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from seed import seed
from routers import auth, pqrs, users

app = FastAPI(
    title="CivicBQ API",
    description="Backend para la plataforma de gestión de PQR ciudadanas",
    version="1.0.0"
)

VERCEL_DOMAIN = os.environ.get("VERCEL_URL", "").replace("https://", "")
CORS_ORIGINS = [
    "http://localhost:4200",
    "https://civicbq.vercel.app",
]

if VERCEL_DOMAIN:
    CORS_ORIGINS.append(f"https://{VERCEL_DOMAIN}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
seed()

app.include_router(auth.router)
app.include_router(pqrs.router)
app.include_router(users.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "CivicBQ API running"}
