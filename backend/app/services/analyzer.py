import io
import os
import cv2
import numpy as np
from PIL import Image
from typing import List, Dict, Tuple
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from mtcnn import MTCNN
import threading
import logging
import time

# ========== CONFIGURAR LOGGING GLOBAL ==========
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ========== CONFIGURACIÓN Y CARGA ÚNICA ==========
logger.info("Inicializando detector y modelo de emociones...")

start_time = time.time()
detector = MTCNN()
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "mobilenetv2_ferplus_final.h5")
)
logger.info(f"Ruta del modelo: {MODEL_PATH}")

model = load_model(MODEL_PATH, custom_objects={"KLDivergence": tf.keras.losses.KLDivergence})
load_time = time.time() - start_time
logger.info(f"Modelo cargado correctamente en {load_time:.2f}s")

TARGET_SIZE = (224, 224)
model_lock = threading.Lock()

def get_class_names(n: int):
    if n == 5:  return ["neutral", "happiness", "surprise", "sadness", "anger"]
    if n == 6:  return ["neutral", "happiness", "surprise", "sadness", "anger", "fear"]
    if n == 7:  return ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear"]
    return [f"class_{i}" for i in range(n)]

NUM_CLASSES = int(model.output_shape[-1])
CLASS_NAMES = get_class_names(NUM_CLASSES)
logger.info(f"Clases del modelo: {CLASS_NAMES}")

# ========== UTILIDADES ==========
def read_image_to_rgb(file_bytes: bytes) -> np.ndarray:
    logger.info(f"Intentando leer imagen (tamaño recibido: {len(file_bytes)} bytes)")
    try:
        img = Image.open(io.BytesIO(file_bytes))
        logger.info(f"Formato detectado: {img.format}, tamaño: {img.size}, modo: {img.mode}")
        img = img.convert("RGB")
        return np.array(img)
    except Exception as e:
        logger.exception("Error al leer imagen con PIL")
        raise ValueError(f"No se pudo leer la imagen: {e}")

def detect_faces(img_rgb: np.ndarray):
    logger.info("Iniciando detección facial con MTCNN...")
    detections = detector.detect_faces(img_rgb)
    logger.info(f"Caras detectadas: {len(detections)}")
    bboxes = []
    for det in detections:
        x, y, w, h = det["box"]
        x = max(0, x); y = max(0, y)
        w = max(1, w); h = max(1, h)
        bboxes.append((x, y, w, h))
        logger.info(f"→ BoundingBox: x={x}, y={y}, w={w}, h={h}")
    return bboxes

def preprocess_face(face_rgb: np.ndarray) -> np.ndarray:
    resized = cv2.resize(face_rgb, TARGET_SIZE, interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32)
    x = preprocess_input(x)
    return np.expand_dims(x, axis=0)

# ========== LÓGICA PRINCIPAL ==========
def analyze_bytes(file_bytes: bytes) -> Dict:
    logger.info("===== INICIO analyze_bytes =====")
    try:
        img_rgb = read_image_to_rgb(file_bytes)
    except Exception as e:
        logger.error(f"Fallo al leer imagen: {e}")
        raise

    img_h, img_w = img_rgb.shape[:2]
    logger.info(f"Dimensiones de imagen: {img_w}x{img_h}")

    bboxes = detect_faces(img_rgb)
    if not bboxes:
        logger.warning("No se detectaron caras, usando imagen completa como ROI")
        bboxes = [(0, 0, img_w, img_h)]

    results = []
    with model_lock:
        for i, (x, y, w, h) in enumerate(bboxes):
            roi = img_rgb[y:y+h, x:x+w]
            if roi.size == 0:
                logger.warning(f"ROI vacío en cara {i+1}, se omite")
                continue

            logger.info(f"Procesando rostro {i+1}...")
            x_input = preprocess_face(roi)
            preds = model.predict(x_input, verbose=0)[0]

            labels = CLASS_NAMES
            if len(labels) != preds.shape[0]:
                logger.warning(f"Desajuste de clases ({len(labels)} vs {preds.shape[0]}), ajustando etiquetas")
                num = preds.shape[0]
                labels = (labels[:num] if len(labels) > num else labels + [f"class_{k}" for k in range(num - len(labels))])

            top_idx = int(np.argmax(preds))
            results.append({
                "id": i + 1,
                "bbox": [int(x), int(y), int(w), int(h)],
                "emotion": labels[top_idx],
                "confidence": float(preds[top_idx]),
                "all_probs": {labels[j]: float(preds[j]) for j in range(len(labels))}
            })
            logger.info(f"→ Cara {i+1}: {labels[top_idx]} ({preds[top_idx]:.3f})")

    logger.info(f"===== FIN analyze_bytes: {len(results)} rostros procesados =====")
    return {"num_faces": len(results), "results": results}

# ========== ENDPOINT COMPATIBLE ==========
async def analyze_image(file) -> Dict:
    logger.info("===== INICIO analyze_image (UploadFile) =====")
    try:
        await file.seek(0)
        file_bytes = await file.read()
        logger.info(f"Tamaño recibido: {len(file_bytes)} bytes, tipo: {file.content_type}")
        if not file_bytes:
            raise ValueError("Archivo vacío o no válido")
        result = analyze_bytes(file_bytes)
        logger.info("Análisis completado correctamente")
        return result
    except Exception as e:
        logger.exception("Error en analyze_image")
        raise
