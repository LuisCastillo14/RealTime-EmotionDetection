// src/services/api.ts
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().replace(/\/+$/, "") ||
  "/api/v1";

export const analyzeImage = async (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await axios.post(`${API_URL}/analyze-image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

// ---------- NUEVO: para frames ----------
export const analyzeFrame = async (blob: Blob) => {
  const fd = new FormData();
  // nombre sugerido (no importa, pero útil para logs)
  fd.append("file", blob, "frame.jpg");
  const { data } = await axios.post(`${API_URL}/analyze-frame`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    // timeouts prudentes para RT
    timeout: 10000,
  });
  return data as {
    num_faces: number;
    results: { id: number; bbox: number[]; emotion: string; confidence: number }[];
  };
};