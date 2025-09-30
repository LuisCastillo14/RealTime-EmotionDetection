import React from "react";

const WebcamPage: React.FC = () => {
  return (
    <div className="text-center mt-4">
      <div className="border p-5" style={{ minHeight: "200px" }}>
        <p>Vista previa de la cámara</p>
      </div>
      <button className="btn btn-dark mt-3">Empezar análisis</button>
    </div>
  );
};

export default WebcamPage;
