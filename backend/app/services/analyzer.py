import io
import os
import cv2
import numpy as np
from PIL import Image
from typing import List, Dict, Tuple

import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# Detector de rostros
from mtcnn import MTCNN
detector = MTCNN()

# =====================
# Configuración modelo
# =====================
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "model", "mobilenetv2_ferplus_final.h5")
)
print(">> Cargando modelo desde:", os.path.abspath(MODEL_PATH))

# Si tu modelo usó KLDivergence como loss
model = load_model(MODEL_PATH, custom_objects={"KLDivergence": tf.keras.losses.KLDivergence})

# Tamaño de entrada esperado (usamos 224x224 porque es tu pipeline)
TARGET_SIZE = (224, 224)

# ===== Etiquetas dinámicas según # de clases del modelo =====
def get_class_names(n: int) -> List[str]:
    if n == 5:
        return ["neutral", "happiness", "surprise", "sadness", "anger"]
    if n == 6:
        return ["neutral", "happiness", "surprise", "sadness", "anger", "fear"]
    if n == 7:
        return ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear"]
    return [f"class_{i}" for i in range(n)]

NUM_CLASSES = int(model.output_shape[-1])
CLASS_NAMES = get_class_names(NUM_CLASSES)
print(f">> El modelo devuelve {NUM_CLASSES} clases: {CLASS_NAMES}")

# =====================
# Utilidades
# =====================
def read_image_to_rgb(file_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return np.array(img)

def detect_faces(img_rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
    detections = detector.detect_faces(img_rgb)
    bboxes = []
    for det in detections:
        x, y, w, h = det["box"]
        # asegurar coordenadas válidas
        x = max(0, x)
        y = max(0, y)
        w = max(1, w)
        h = max(1, h)
        bboxes.append((x, y, w, h))
    return bboxes

def preprocess_face(face_rgb: np.ndarray) -> np.ndarray:
    resized = cv2.resize(face_rgb, TARGET_SIZE, interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32)
    x = preprocess_input(x)   # Normalización MobileNetV2
    return np.expand_dims(x, axis=0)  # (1,224,224,3)

# =====================
# Lógica principal
# =====================
async def analyze_image(file) -> Dict:
    file_bytes = await file.read()
    img_rgb = read_image_to_rgb(file_bytes)
    img_h, img_w = img_rgb.shape[:2]

    bboxes = detect_faces(img_rgb)
    if not bboxes:
        print("[DEBUG] No se detectaron caras, usando fallback (imagen completa)")
        bboxes = [(0, 0, img_w, img_h)]

    results = []
    for i, (x, y, w, h) in enumerate(bboxes):
        roi = img_rgb[y:y+h, x:x+w]
        if roi.size == 0:
            print(f"[DEBUG] ROI vacío para bbox {i}: {(x,y,w,h)}")
            continue

        # Guardar ROI original para debug
        cv2.imwrite(f"debug_face_raw_{i}.jpg", cv2.cvtColor(roi, cv2.COLOR_RGB2BGR))

        # Preprocesar
        x_input = preprocess_face(roi)

        # Guardar ROI redimensionado
        resized_debug = cv2.resize(roi, TARGET_SIZE)
        cv2.imwrite(f"debug_face_resized_{i}.jpg", cv2.cvtColor(resized_debug, cv2.COLOR_RGB2BGR))

        # Predicción
        preds = model.predict(x_input, verbose=0)[0]

        # DEBUG: mostrar probabilidades
        print(f"[DEBUG] Persona {i+1} bbox={x,y,w,h}")
        for lbl, prob in zip(CLASS_NAMES, preds):
            print(f"   {lbl}: {prob:.4f}")

        num = preds.shape[0]
        labels = CLASS_NAMES
        if len(labels) != num:
            labels = (labels[:num] if len(labels) > num else labels + [f"class_{i}" for i in range(num - len(labels))])

        top_idx = int(np.argmax(preds))
        result = {
            "id": i + 1,
            "bbox": [int(x), int(y), int(w), int(h)],
            "emotion": labels[top_idx],
            "confidence": float(preds[top_idx]),
            "all_probs": {labels[j]: float(preds[j]) for j in range(num)}
        }
        results.append(result)

    return {"num_faces": len(results), "results": results}
