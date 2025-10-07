# app/services/analyzer.py
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

# ========== Configuración y carga única ==========
detector = MTCNN()
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "mobilenetv2_ferplus_final.h5")
)
model = load_model(MODEL_PATH, custom_objects={"KLDivergence": tf.keras.losses.KLDivergence})
TARGET_SIZE = (224, 224)
model_lock = threading.Lock()  # evita colisiones entre peticiones

def get_class_names(n: int):
    if n == 5:  return ["neutral", "happiness", "surprise", "sadness", "anger"]
    if n == 6:  return ["neutral", "happiness", "surprise", "sadness", "anger", "fear"]
    if n == 7:  return ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear"]
    return [f"class_{i}" for i in range(n)]

NUM_CLASSES = int(model.output_shape[-1])
CLASS_NAMES = get_class_names(NUM_CLASSES)

# ========== Utilidades ==========
def read_image_to_rgb(file_bytes: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        return np.array(img)
    except Exception as e:
        raise ValueError(f"No se pudo leer la imagen: {e}")

def detect_faces(img_rgb: np.ndarray):
    detections = detector.detect_faces(img_rgb)
    bboxes = []
    for det in detections:
        x, y, w, h = det["box"]
        x = max(0, x); y = max(0, y)
        w = max(1, w); h = max(1, h)
        bboxes.append((x, y, w, h))
    return bboxes

def preprocess_face(face_rgb: np.ndarray) -> np.ndarray:
    resized = cv2.resize(face_rgb, TARGET_SIZE, interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32)
    x = preprocess_input(x)
    return np.expand_dims(x, axis=0)

# ========== Lógica principal ==========
def analyze_bytes(file_bytes: bytes) -> Dict:
    img_rgb = read_image_to_rgb(file_bytes)
    img_h, img_w = img_rgb.shape[:2]
    bboxes = detect_faces(img_rgb)
    if not bboxes:
        bboxes = [(0, 0, img_w, img_h)]

    results = []
    with model_lock:  # asegura que no se mezclen predicciones concurrentes
        for i, (x, y, w, h) in enumerate(bboxes):
            roi = img_rgb[y:y+h, x:x+w]
            if roi.size == 0:
                continue

            x_input = preprocess_face(roi)
            preds = model.predict(x_input, verbose=0)[0]

            labels = CLASS_NAMES
            if len(labels) != preds.shape[0]:
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

    return {"num_faces": len(results), "results": results}

# ========== Compatibilidad con endpoint anterior ==========
async def analyze_image(file) -> Dict:
    await file.seek(0)  # <-- por seguridad
    file_bytes = await file.read()
    if not file_bytes:
        raise ValueError("Archivo vacío o no válido")
    return analyze_bytes(file_bytes)
