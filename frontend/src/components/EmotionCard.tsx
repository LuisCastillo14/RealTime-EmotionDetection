import React from "react";

export type EmotionRow = {
  key: string;          // "happiness", "neutral", etc.
  label: string;        // "Feliz", "Neutral", etc. (ES)
  pct: number;          // 0..100
  avgConf: number;      // 0..1
};

type Props = {
  title?: string;
  rows: EmotionRow[];        // todas las emociones en orden
  main?: EmotionRow | null;  // emoción principal (por %)
};

const EMOJI: Record<string, string> = {
  happiness: "😊",
  neutral: "😐",
  surprise: "😮",
  sadness: "😢",
  anger: "😠",
  disgust: "🤢",
  fear: "😨",
};

const COLORS: Record<string, string> = {
  neutral: "#7f8c8d",
  happiness: "#2ecc71",
  surprise: "#f1c40f",
  sadness: "#3498db",
  anger: "#e74c3c",
  disgust: "#6ab04c",
  fear: "#8e44ad",
};

const BAR_BG = "#e9ecef";

const ProgressBar: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{
      width: "100%", height: 10, borderRadius: 999,
      background: BAR_BG, overflow: "hidden"
    }}>
      <div style={{
        width: `${v}%`, height: "100%",
        background: color, borderRadius: 999, transition: "width .2s"
      }} />
    </div>
  );
};

const EmotionCard: React.FC<Props> = ({ title = "Resumen en vivo", rows, main }) => {
  return (
    <div style={{
      maxWidth: 620,
      margin: "18px auto",
      background: "#fff",
      borderRadius: 10,
      boxShadow: "0 8px 18px rgba(0,0,0,.08)",
      padding: 16,
    }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{title}</div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14 }}>
        {/* Columna izquierda: emoción principal */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 6, padding: "6px 0"
        }}>
          <div style={{ color: "#6c757d", fontSize: 14 }}>Emoción principal</div>
          <div style={{ fontSize: 34 }}>
            {main ? EMOJI[main.key] ?? "🙂" : "🙂"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {main ? main.label : "—"}
          </div>
          <div style={{ color: "#6c757d", fontSize: 13 }}>
            Confianza: {main ? (main.avgConf * 100).toFixed(1) : "0.0"}%
          </div>
        </div>

        {/* Columna derecha: barras */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#343a40" }}>{r.label}</span>
                <span style={{ color: "#6c757d" }}>{r.pct.toFixed(0)}%</span>
              </div>
              <ProgressBar value={r.pct} color={COLORS[r.key] || "#0E1D36"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmotionCard;
