from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import analyze

app = FastAPI(title="EmotiScan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],  # * SOLO en dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api/v1", tags=["Análisis"])

@app.get("/")
def read_root():
    return {"message": "Backend FastAPI listo con modelo"}
