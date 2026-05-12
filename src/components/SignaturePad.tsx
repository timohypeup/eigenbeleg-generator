import { useEffect, useRef, useState } from "react";

interface Props {
  value: string | undefined; // aktuelle Signatur als Data-URL
  onChange: (dataUrl: string | undefined) => void;
}

// Max. Breite des hochgeladenen Signaturbildes. 800 px ist für die 60 mm × 22 mm
// Darstellung im PDF mehr als ausreichend (~340 dpi bei der finalen Größe).
const MAX_UPLOAD_WIDTH = 800;
// JPEG-Qualität für Re-Encoding. 0.8 liefert visuell unauffällige Ergebnisse bei
// einem Bruchteil der PNG-Dateigröße — Unterschriften vertragen das problemlos.
const JPEG_QUALITY = 0.8;

/**
 * Liest eine Datei als Data-URL ein.
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = src;
  });
}

/**
 * Bereitet einen Upload für das PDF auf:
 *  - skaliert auf max. MAX_UPLOAD_WIDTH herunter (proportional)
 *  - encodiert immer als JPEG mit fester Qualität
 *
 * PNG-Originale werden hier bewusst nach JPEG konvertiert: eingescannte oder
 * fotografierte Unterschriften enthalten Pixel-Variationen (Antialiasing, Papier-
 * textur, Schatten), die PNG schlecht komprimiert — JPEG ist hier um Größenordnungen
 * effizienter. Reine Strich-Zeichnungen aus dem Canvas durchlaufen diesen Pfad nicht.
 */
async function processUpload(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const ratio = img.naturalWidth / img.naturalHeight;
  const w = Math.min(MAX_UPLOAD_WIDTH, img.naturalWidth);
  const h = w / ratio;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  // JPEG hat keinen Alpha-Kanal → vorher mit Weiß ausfüllen, damit transparente
  // PNG-Hintergründe nicht schwarz werden.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * Canvas-Komponente zum Erfassen einer Unterschrift.
 * Drei Wege: zeichnen, Datei hochladen, oder leer lassen (PDF bekommt dann eine Linie zum
 * handschriftlichen Unterzeichnen).
 */
export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // True = der aktuelle Wert kommt von einem Upload (höhere Auflösung als Canvas).
  // In dem Fall darf der Canvas-Inhalt nicht versehentlich zurückgeschrieben werden.
  const [uploadedHiRes, setUploadedHiRes] = useState(false);

  // High-DPI-Canvas einrichten und ggf. vorhandene Signatur als Preview einzeichnen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    if (value) {
      loadImage(value)
        .then((img) => {
          // Proportional zentriert ins Canvas einpassen (für die Preview).
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = rect.width / rect.height;
          let dw: number;
          let dh: number;
          if (imgRatio > canvasRatio) {
            dw = rect.width;
            dh = dw / imgRatio;
          } else {
            dh = rect.height;
            dw = dh * imgRatio;
          }
          const dx = (rect.width - dw) / 2;
          const dy = (rect.height - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
          setIsEmpty(false);
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [value]);

  function getPoint(e: PointerEvent | React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    // Sobald der User zeichnet, „besitzt" der Canvas die Signatur — eventuelles
    // hochaufgelöstes Upload-Original wird durch den Canvas-Inhalt ersetzt.
    setUploadedHiRes(false);
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    setIsEmpty(false);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && !isEmpty && !uploadedHiRes) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setIsEmpty(true);
    setUploadedHiRes(false);
    setUploadError(null);
    onChange(undefined);
  }

  async function handleUpload(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei hochladen (PNG, JPG, …).");
      return;
    }
    try {
      const raw = await readFileAsDataUrl(file);
      const processed = await processUpload(raw);
      setUploadedHiRes(true);
      onChange(processed);
    } catch (err) {
      setUploadError(`Upload fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f);
          e.target.value = "";
        }}
      />
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ flex: 1, minWidth: 200 }}>
          {isEmpty
            ? "Hier zeichnen, Datei hochladen oder leer lassen für eine handschriftliche Unterschrift."
            : uploadedHiRes
              ? "Unterschrift aus Datei übernommen."
              : "Unterschrift erfasst."}
        </span>
        <button type="button" className="ghost" onClick={() => fileInputRef.current?.click()}>
          📤 Datei hochladen
        </button>
        {!isEmpty && (
          <button type="button" className="ghost" onClick={handleClear}>
            Löschen
          </button>
        )}
      </div>
      {uploadError && <div className="error-text">{uploadError}</div>}
    </div>
  );
}
