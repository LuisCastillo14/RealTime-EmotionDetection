# app/api/v1/analyze.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.analyzer import analyze_image, analyze_bytes

router = APIRouter()

@router.post("/analyze-image")
async def analyze_image_route(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")

    # 🔧 Parche: aseguramos que el archivo esté al inicio antes de leerlo
    await file.seek(0)
    return await analyze_image(file)


# ---------- NUEVO ----------
@router.post("/analyze-frame")
async def analyze_frame_route(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen (frame).")
    file_bytes = await file.read()
    return analyze_bytes(file_bytes)
