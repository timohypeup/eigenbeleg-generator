import jsPDF from "jspdf";
import type { CompanyData, EigenbelegData } from "../types";
import { PAYMENT_METHOD_LABELS } from "../types";

// ---------------------------------------------------------------------------
// Layout-Konstanten (alle Maße in mm, A4 = 210 × 297 mm)
// ---------------------------------------------------------------------------
const PAGE_W = 210;
const MARGIN_X = 20;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

const COLOR_TEXT = "#111111";
const COLOR_MUTED = "#555555";
const COLOR_RULE = "#DDDDDD";
const COLOR_ACCENT = "#E6007E"; // HYPEUP Pink

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Lädt das Logo als Data-URL inklusive natürlicher Pixelmaße,
 * damit wir das Seitenverhältnis beim Platzieren im PDF halten können.
 */
async function loadLogo(
  logoPath: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(logoPath);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

/**
 * Erzeugt das PDF für einen Eigenbeleg.
 *
 * Layout:
 *   - Logo oben rechts (falls vorhanden)
 *   - Firmenadresse oben links
 *   - Überschrift "Eigenbeleg" + Belegnummer
 *   - Zwei Info-Spalten: Belegdaten / Empfänger
 *   - Ausgabe-Details (Art, Zahlungsart, Betrag groß)
 *   - Grund des Eigenbelegs
 *   - Optionale Anmerkungen
 *   - Hinweis "kein Vorsteuerabzug"
 *   - Unterschriftsfeld (Signatur-Bild oder Linie zum handschriftlichen Unterschreiben)
 */
export async function generateEigenbelegPdf(
  data: EigenbelegData,
  company: CompanyData,
  logoPath: string
): Promise<jsPDF> {
  // `compress: true` aktiviert Deflate-Kompression auf allen PDF-Streams.
  // Spart ~20–30 % an Gesamt-Dateigröße — vor allem bei eingebetteten Bildern.
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = await loadLogo(logoPath);

  // --- Header: Logo rechts oben ---
  let logoBottom = MARGIN_X;
  if (logo) {
    const maxLogoH = 18;
    const maxLogoW = 55;
    const ratio = logo.width / logo.height;
    let h = maxLogoH;
    let w = h * ratio;
    if (w > maxLogoW) {
      w = maxLogoW;
      h = w / ratio;
    }
    doc.addImage(logo.dataUrl, "PNG", PAGE_W - MARGIN_X - w, MARGIN_X, w, h);
    logoBottom = MARGIN_X + h;
  }

  // --- Firmenabsenderzeile oben links ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED);
  const senderLine = [
    company.name,
    `${company.street}, ${company.zip} ${company.city}`,
    company.ustId ? `USt-ID: ${company.ustId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(senderLine, MARGIN_X, MARGIN_X + 4);

  // --- Titel ---
  const titleY = Math.max(logoBottom + 12, MARGIN_X + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(COLOR_TEXT);
  doc.text("Eigenbeleg", MARGIN_X, titleY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(COLOR_ACCENT);
  doc.text(data.belegNummer, MARGIN_X, titleY + 7);

  // Trennlinie
  doc.setDrawColor(COLOR_RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, titleY + 11, PAGE_W - MARGIN_X, titleY + 11);

  // --- Info-Block: zwei Spalten ---
  let y = titleY + 20;
  const colGap = 10;
  const colW = (CONTENT_W - colGap) / 2;

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    yPos: number,
    width: number
  ): number => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR_MUTED);
    doc.text(label.toUpperCase(), x, yPos);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(COLOR_TEXT);
    const lines = doc.splitTextToSize(value || "—", width);
    doc.text(lines, x, yPos + 5);
    return yPos + 5 + lines.length * 5;
  };

  // Linke Spalte: Belegdaten
  let leftY = y;
  leftY = drawLabelValue("Ausstellungsdatum", formatDate(data.ausstellungsDatum), MARGIN_X, leftY, colW) + 3;
  leftY = drawLabelValue("Datum der Ausgabe", formatDate(data.ausgabeDatum), MARGIN_X, leftY, colW) + 3;
  leftY = drawLabelValue("Aussteller", data.aussteller, MARGIN_X, leftY, colW) + 3;

  // Rechte Spalte: Empfänger
  const rightX = MARGIN_X + colW + colGap;
  let rightY = y;
  rightY = drawLabelValue("Zahlungsempfänger", data.empfaengerName, rightX, rightY, colW) + 3;
  if (data.empfaengerAdresse && data.empfaengerAdresse.trim()) {
    rightY = drawLabelValue("Anschrift des Empfängers", data.empfaengerAdresse, rightX, rightY, colW) + 3;
  }
  rightY = drawLabelValue("Zahlungsart", PAYMENT_METHOD_LABELS[data.zahlungsart], rightX, rightY, colW) + 3;

  y = Math.max(leftY, rightY) + 4;

  // Trennlinie
  doc.setDrawColor(COLOR_RULE);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 8;

  // --- Art der Aufwendung ---
  y = drawLabelValue("Art der Aufwendung", data.artDerAufwendung, MARGIN_X, y, CONTENT_W) + 6;

  // --- Betrag groß ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED);
  doc.text("RECHNUNGSBETRAG", MARGIN_X, y);
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(COLOR_TEXT);
  doc.text(formatEuro(data.betrag), MARGIN_X, y + 10);
  y += 16;

  // --- Grund ---
  y = drawLabelValue(
    "Grund für den Eigenbeleg",
    data.grundDesEigenbelegs,
    MARGIN_X,
    y,
    CONTENT_W
  ) + 4;

  // --- Anmerkungen ---
  if (data.anmerkungen && data.anmerkungen.trim()) {
    y = drawLabelValue("Anmerkungen", data.anmerkungen, MARGIN_X, y, CONTENT_W) + 4;
  }

  // --- Steuerlicher Hinweis ---
  doc.setDrawColor(COLOR_RULE);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED);
  const hinweis =
    "Hinweis: Dieser Eigenbeleg dient als Ersatz für einen fehlenden Fremdbeleg. " +
    "Ein Vorsteuerabzug ist aus diesem Beleg nicht möglich (§ 14, 15 UStG). " +
    "Aufbewahrungsfrist: 10 Jahre (GoBD).";
  const hinweisLines = doc.splitTextToSize(hinweis, CONTENT_W);
  doc.text(hinweisLines, MARGIN_X, y);
  y += hinweisLines.length * 4 + 10;

  // --- Unterschrift ---
  // Wir brauchen mindestens ~35 mm Platz; sonst neue Seite.
  if (y > 297 - 40) {
    doc.addPage();
    y = MARGIN_X;
  }

  doc.setDrawColor(COLOR_RULE);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(COLOR_MUTED);
  doc.text("UNTERSCHRIFT", MARGIN_X, y);

  if (data.signatureDataUrl) {
    // Signatur als Bild einfügen — Format aus Data-URL ableiten, damit auch JPEGs
    // (z. B. eingescannte Unterschriften) sauber eingebettet werden.
    const url = data.signatureDataUrl;
    const fmt: "PNG" | "JPEG" | "WEBP" = url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")
      ? "JPEG"
      : url.startsWith("data:image/webp")
        ? "WEBP"
        : "PNG";
    try {
      // Höhe leicht erhöht (max 22 mm), damit eingescannte Signaturen mit etwas Rand gut Platz finden.
      // Das maxWidth/maxHeight-Verhältnis wird von jsPDF eingehalten, wenn wir 0 als eine Dimension setzen
      // — wir nehmen aber explizite Maße für ein konsistentes Layout.
      // `compression: "FAST"` weist jsPDF an, eingebettete Bilder nochmal zu komprimieren.
      doc.addImage(url, fmt, MARGIN_X, y + 2, 60, 22, undefined, "FAST");
    } catch {
      // Fallback: Linie
      doc.line(MARGIN_X, y + 20, MARGIN_X + 80, y + 20);
    }
  } else {
    // Leere Linie zum handschriftlichen Unterschreiben
    doc.setDrawColor("#999999");
    doc.line(MARGIN_X, y + 20, MARGIN_X + 80, y + 20);
  }

  // Name unter der Unterschrift
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(COLOR_TEXT);
  doc.text(
    `${data.aussteller}${data.ausstellungsDatum ? `, ${formatDate(data.ausstellungsDatum)}` : ""}`,
    MARGIN_X,
    y + 26
  );

  return doc;
}
