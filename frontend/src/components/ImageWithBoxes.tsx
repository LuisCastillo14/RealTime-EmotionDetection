import React, { useRef, useEffect } from "react";

interface PersonResult {
  id: number;
  bbox: number[]; // [x, y, w, h]
  emotion: string;
  confidence: number;
}

interface Props {
  imageUrl: string;
  results: PersonResult[];
}

const ImageWithBoxes: React.FC<Props> = ({ imageUrl, results }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      results.forEach((r, index) => {
        const [x, y, w, h] = r.bbox;
        ctx.strokeStyle = "limegreen";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Texto: Persona + emoción
        ctx.fillStyle = "limegreen";
        ctx.font = "16px Arial";
        const text = `Persona ${index + 1}: ${r.emotion} (${(r.confidence * 100).toFixed(1)}%)`;
        ctx.fillText(text, x, y > 20 ? y - 5 : y + 15);
      });
    };
  }, [imageUrl, results]);

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: "100%", borderRadius: "8px" }}
    />
  );
};

export default ImageWithBoxes;
