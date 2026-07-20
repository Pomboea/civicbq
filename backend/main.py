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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
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
