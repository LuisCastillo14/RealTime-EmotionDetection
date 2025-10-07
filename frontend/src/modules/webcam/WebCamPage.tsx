import React, { useEffect, useRef, useState } from "react";
import { analyzeFrame } from "../../services/api";
import EmotionCard from "../../components/EmotionCard";
import type { EmotionRow } from "../../components/EmotionCard";

type PersonResult = {
  id: number;
  bbox: number[];
  emotion: string;
  confidence: number;
  all_probs?: Record<string, number>;
};

const INITIAL_INTERVAL_MS = 500;

const VIDEO_WIDTH = 800;
const VIDEO_HEIGHT = 600;


const EMOTIONS = ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear"] as const;
type EmotionKey = typeof EMOTIONS[number];

const LABEL_ES: Record<EmotionKey, string> = {
  neutral: "Neutral",
  happiness: "Feliz",
  surprise: "Sorpresa",
  sadness: "Tristeza",
  anger: "Enojo",
  disgust: "Disgusto",
  fear: "Miedo",
};

type Stat = { count: number; confSum: number };
type StatMap = Record<EmotionKey, Stat>;

const makeEmptyStats = (): StatMap =>
  EMOTIONS.reduce((acc, e) => {
    acc[e] = { count: 0, confSum: 0 };
    return acc;
  }, {} as StatMap);

const WebcamPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false); // 👈 nuevo flag de animación

  const isProcessingRef = useRef(false);
  const loopTimeout = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stats, setStats] = useState<StatMap>(makeEmptyStats());

  const decayAndAdd = (results: PersonResult[]) => {
    setStats((prev) => {
      const next: StatMap = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev));
      for (const e of EMOTIONS) {
        next[e].count *= 0.97;
        next[e].confSum *= 0.97;
      }
      for (const r of results) {
        const key = r.emotion as EmotionKey;
        if (!EMOTIONS.includes(key)) continue;
        next[key].count += 1;
        next[key].confSum += r.confidence;
      }
      return next;
    });
  };

  // =========================
  // Inicializar cámara
  // =========================
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
          audio: false,
        });


        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        setError("No se pudo acceder a la cámara. Revisa permisos.");
      }
    };

    startCamera();

    return () => {
      if (loopTimeout.current) {
        window.clearTimeout(loopTimeout.current);
        loopTimeout.current = null;
      }
      isProcessingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // =========================
  // Preparar video/overlay
  // =========================
  const onVideoCanPlay = () => {
    const v = videoRef.current!;
    const overlay = overlayRef.current!;
    const cap = (captureRef.current = document.createElement("canvas"));

    const waitForSize = () => {
      if (!v.videoWidth || !v.videoHeight) {
        requestAnimationFrame(waitForSize);
        return;
      }
      const ow = v.videoWidth;
      const oh = v.videoHeight;
      overlay.width = ow;
      overlay.height = oh;
      cap.width = ow;
      cap.height = oh;
    };
    waitForSize();
  };

  // =========================
  // Capturar y analizar frame
  // =========================
  const captureAndSendFrame = async () => {
    if (!isDetecting) return;
    const v = videoRef.current;
    const cap = captureRef.current;
    const overlay = overlayRef.current;
    if (!v || !cap || !overlay || isProcessingRef.current) return;

    const cctx = cap.getContext("2d")!;
    cctx.drawImage(v, 0, 0, cap.width, cap.height);

    isProcessingRef.current = true;

    try {
      const blob: Blob = await new Promise((resolve) =>
        cap.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.7)
      );

      const data = await analyzeFrame(blob);
      drawOverlay(overlay, data.results);
      decayAndAdd(data.results);
    } catch (e) {
      console.error("Error analizando frame:", e);
    } finally {
      isProcessingRef.current = false;
    }
  };


  // =========================
  // Loop adaptativo
  // =========================
  const startFixedLoop = () => {
    if (!isDetecting) return;

    const loop = async () => {
      if (isDetecting) await captureAndSendFrame();
    };

    // Repite con velocidad fija
    loopTimeout.current = window.setInterval(loop, INITIAL_INTERVAL_MS );
  };

  // =========================
  // Dibujo del overlay
  // =========================
  const drawOverlay = (canvas: HTMLCanvasElement, results: PersonResult[]) => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const COLORS: Record<string, string> = {
      neutral: "#bdc3c7",
      happiness: "#2ecc71",
      surprise: "#f1c40f",
      sadness: "#3498db",
      anger: "#e74c3c",
      disgust: "#16a085",
      fear: "#8e44ad",
    };

    const EMOJI: Record<string, string> = {
      neutral: "😐",
      happiness: "😊",
      surprise: "😮",
      sadness: "😢",
      anger: "😠",
      disgust: "🤢",
      fear: "😨",
    };

    results.forEach((r) => {
      const [x, y, w, h] = r.bbox;
      const baseColor = COLORS[r.emotion] || "#2ecc71";

      ctx.save();
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.stroke();
      ctx.restore();

      const emoji = EMOJI[r.emotion] || "🙂";
      const text = `${emoji} ${r.emotion.toUpperCase()} (${(r.confidence * 100).toFixed(1)}%)`;

      const labelWidth = ctx.measureText(text).width + 40;
      const labelHeight = 40;
      const labelX = x + w / 2 - labelWidth / 2;
      const labelY = y - labelHeight - 8 < 0 ? y + h + 8 : y - labelHeight - 8;

      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 6;
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
      ctx.restore();

      ctx.font = "bold 20px 'Segoe UI', sans-serif";
      ctx.fillStyle = baseColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 8;
      ctx.fillText(text, x + w / 2, labelY + labelHeight / 2);
      ctx.shadowBlur = 0;
    });
  };

  // =========================
  // Control pestaña
  // =========================
  useEffect(() => {
  if (isDetecting) {
    startFixedLoop();
  } else if (loopTimeout.current) {
    window.clearInterval(loopTimeout.current);
    loopTimeout.current = null;
  }
}, [isDetecting]);

  // =========================
  // Botón Iniciar / Finalizar
  // =========================
  const handleToggleDetection = () => {
    if (isDetecting) {
      // 🔴 detener detección
      setIsDetecting(false);
      setShowOverlay(false);

      // animación de salida
      setDashboardVisible(false);
      setTimeout(() => setShowDashboard(false), 600);

      setStats(makeEmptyStats());
      if (loopTimeout.current) {
        window.clearTimeout(loopTimeout.current);
        loopTimeout.current = null;
      }
    } else {
      // 🟢 iniciar detección
      setIsDetecting(true);
      setShowOverlay(true);
      setShowDashboard(true);

      // retrasa el visible para permitir animación de entrada
      setTimeout(() => setDashboardVisible(true), 50);
    }
  };

  // loop principal
  useEffect(() => {
    if (isDetecting) {
      startFixedLoop();
    } else if (loopTimeout.current) {
      window.clearInterval(loopTimeout.current);
      loopTimeout.current = null;
    }
  }, [isDetecting]);

  // =========================
  // Dashboard resumen
  // =========================
  const rows: EmotionRow[] = React.useMemo(() => {
    const total = EMOTIONS.reduce((s, e) => s + stats[e].count, 0) || 1;
    return EMOTIONS.map((e) => ({
      key: e,
      label: LABEL_ES[e],
      pct: (stats[e].count / total) * 100,
      avgConf: stats[e].count > 0 ? stats[e].confSum / stats[e].count : 0,
    }));
  }, [stats]);

  const main = React.useMemo<EmotionRow | null>(() => {
    if (!rows.length) return null;
    return rows.reduce((a, b) => (b.pct > a.pct ? b : a), rows[0]);
  }, [rows]);

  // =========================
  // Render principal
  // =========================
  return (
    <div className="text-center mt-4">
      <h3>Cámara Web</h3>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : (
        <>
          {/* VIDEO */}
          <div
            style={{
              position: "relative",
              display: "inline-block",
              borderRadius: 8,
              border: "2px solid #0E1D36",
              overflow: "hidden",
              width: VIDEO_WIDTH,
              height: VIDEO_HEIGHT,
            }}
          >

            <video
              ref={videoRef}
              onCanPlay={onVideoCanPlay}
              autoPlay
              playsInline
              muted
              style={{
                width: `${VIDEO_WIDTH}px`,
                height: `${VIDEO_HEIGHT}px`,
                display: "block",
                backgroundColor: "#000",
              }}
            />

            <canvas
              ref={overlayRef}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: `${VIDEO_WIDTH}px`,
                height: `${VIDEO_HEIGHT}px`,
                pointerEvents: "none",
                opacity: showOverlay ? 1 : 0,
                transition: "opacity 0.4s ease-in-out",
              }}
            />

          </div>

          {/* BOTÓN */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={handleToggleDetection}
              style={{
                background: isDetecting ? "#c0392b" : "#0E1D36",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {isDetecting ? "Finalizar detección" : "Iniciar detección"}
            </button>
          </div>

          {/* DASHBOARD con fade in/out */}
          {showDashboard && (
            <div
              style={{
                transition: "opacity 0.6s ease, transform 0.6s ease",
                opacity: dashboardVisible ? 1 : 0,
                transform: dashboardVisible ? "translateY(0)" : "translateY(20px)",
                pointerEvents: dashboardVisible ? "auto" : "none",
              }}
            >
              <EmotionCard title="Persona 1" rows={rows} main={main ?? undefined} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WebcamPage;
