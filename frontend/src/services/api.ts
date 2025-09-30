import axios from "axios";

const API_URL = "http://127.0.0.1:8000/api/v1";

export const analyzeImage = async (file: File) => {
  const fd = new FormData();
  fd.append("file", file);

  const { data } = await axios.post(`${API_URL}/analyze-image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data; // devolvemos el JSON completo (puede haber 1 o más personas)
};