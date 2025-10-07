import React, { useState } from "react";
import { analyzeImage } from "../../services/api";
import "../../styles/UploadPage.css";
import ImageWithBoxes from "../../components/ImageWithBoxes";

interface PersonResult {
  id: number;
  bbox: number[]; // coordenadas
  emotion: string;
  confidence: number;
  all_probs: Record<string, number>;
}

interface ApiResponse {
  num_faces: number;
  results: PersonResult[];
}

const emotionMap: Record<string, string> = {
  neutral: "Neutral",
  happiness: "Feliz",
  surprise: "Sorpresa",
  sadness: "Tristeza",
  anger: "Enojo",
  disgust: "Disgusto",
  fear: "Miedo",
};

const UploadPage: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setFile(file);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const response = await analyzeImage(file);
      setResult(response); // guardamos toda la respuesta con results[]
    } catch (error) {
      console.error("Error en análisis", error);
      alert("Hubo un error en el análisis.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setFile(null);
    setResult(null);
  };

  console.table(result?.results?.map((r,i)=>({i, id:r.id, x:r.bbox[0], w:r.bbox[2], emo:r.emotion})));


  return (
    <div className="text-center mt-4">
      {/* Cuadro de Upload siempre visible */}
      <div
        className="upload-box"
        onClick={() => document.getElementById("fileInput")?.click()}
      >
        {preview ? (
          result ? (
            <ImageWithBoxes imageUrl={preview} results={result.results} />
          ) : (
            <img
              src={preview}
              alt="preview"
              style={{
                maxHeight: "200px",
                maxWidth: "100%",
                borderRadius: "8px",
              }}
            />
          )
        ) : (
          <>
            <i className="fas fa-upload fa-2x" style={{ color: "#666" }}></i>
            <p className="upload-text">Subir imagen</p>
          </>
        )}
        <input
          type="file"
          id="fileInput"
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleInput}
        />
      </div>

      {/* Botón */}
      {!result ? (
        <button
          className="btn-analysis mt-3"
          onClick={handleAnalyze}
          disabled={!file || loading}
        >
          {loading ? "Analizando..." : "Empezar análisis"}
        </button>
      ) : (
        <button className="btn-analysis mt-3" onClick={handleReset}>
          Analizar otra imagen
        </button>
      )}

      {/* Dashboard múltiple */}
{result && result.results
  .slice() // clonar para no mutar
  .sort((a, b) => a.bbox[0] - b.bbox[0]) // ordenar por X (izq→der)
  .map((person, index) => (
    <div
      key={`${index}-${person.bbox.join(",")}`} // key única
      className="card mt-4 p-3 text-start mx-auto"
      style={{ maxWidth: "600px" }}
    >
      <h5 className="mb-3">Persona {index + 1}</h5>
      <div className="d-flex align-items-center">
        <div className="me-4 text-center">
          <p className="mt-2 mb-1">Emoción principal</p>
          <span style={{ fontSize: "2rem" }}>
            {person.emotion === "happiness" && "😊"}
            {person.emotion === "sadness" && "😢"}
            {person.emotion === "anger" && "😡"}
            {person.emotion === "neutral" && "😐"}
            {person.emotion === "surprise" && "😲"}
            {person.emotion === "disgust" && "🤢"}
            {person.emotion === "fear" && "😨"}
          </span>
          <p className="fw-bold">
            {emotionMap[person.emotion] || person.emotion}
          </p>
          <p className="text-muted">
            Confianza: {Math.min(100, Math.max(0, person.confidence * 100)).toFixed(1)}%
          </p>
        </div>

        {/* Barras */}
        <div className="flex-grow-1">
          {Object.entries(person.all_probs).map(([emo, prob]) => {
            const pct = Math.min(100, Math.max(0, prob * 100));
            let color = "#6c757d";
            if (emo === "happiness") color = "#28a745";
            if (emo === "sadness") color = "#007bff";
            if (emo === "anger") color = "#dc3545";
            if (emo === "neutral") color = "#6c757d";
            if (emo === "surprise") color = "#ffc107";
            if (emo === "disgust") color = "#8e44ad";
            if (emo === "fear") color = "#17a2b8";

            return (
              <div key={`${emo}-${index}`} className="mb-2">
                <div className="d-flex justify-content-between">
                  <span>{emotionMap[emo] || emo}</span>
                  <span>{Math.round(pct)}%</span>
                </div>
                <div className="progress" style={{ height: "20px" }}>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
))}

    </div>
  );
};

export default UploadPage;
