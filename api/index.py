import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from seed import seed
from routers.auth_router import router as auth_router
from routers.pqrs_router import router as pqrs_router
from routers.users_router import router as users_router

app = FastAPI(title="CivicBQ API", version="1.0.0")

origins = ["http://localhost:4200"]
vercel_url = os.environ.get("VERCEL_URL")
if vercel_url:
    origins.append(f"https://{vercel_url}")
    origins.append(f"https://{vercel_url.replace('-git-', '.').replace('.vercel.app', '-git.vercel.app')}")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Base.metadata.create_all(bind=engine)
seed()

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(pqrs_router, prefix="/api/pqrs", tags=["pqrs"])
app.include_router(users_router, prefix="/api/users", tags=["users"])


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "CivicBQ API running"}
