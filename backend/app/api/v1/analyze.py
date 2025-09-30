from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.analyzer import analyze_image

router = APIRouter()

@router.post("/analyze-image")
async def analyze_image_route(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")
    return await analyze_image(file)
