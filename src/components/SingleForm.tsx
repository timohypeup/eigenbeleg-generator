import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import {
  BELEG_PREFIX,
  COMMON_CATEGORIES,
  COMMON_REASONS,
  COMPANY_DEFAULTS,
  PLAUSIBILITY_WARNING_THRESHOLD_EUR,
} from "../config";
import { generateEigenbelegPdf } from "../lib/pdf";
import { buildPdfFilename } from "../lib/filename";
import { MAX_PDF_BYTES, formatBytes } from "../lib/size";
import type { CompanyData, EigenbelegData, PaymentMethod } from "../types";
import { PAYMENT_METHOD_LABELS } from "../types";
import { SignaturePad } from "./SignaturePad";

interface Props {
  company: CompanyData;
  aussteller: string;
  onAusstellerChange: (name: string) => void;
  counter: number;
  onCounterChange: (next: number) => void;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatBelegNummer(counter: number): string {
  const year = new Date().getFullYear();
  return `${BELEG_PREFIX}-${year}-${String(counter).padStart(4, "0")}`;
}

export function SingleForm({
  company,
  aussteller,
  onAusstellerChange,
  counter,
  onCounterChange,
}: Props) {
  const [belegNummer, setBelegNummer] = useState(() => formatBelegNummer(counter));
  const [ausgabeDatum, setAusgabeDatum] = useState(todayIso());
  const [ausstellungsDatum, setAusstellungsDatum] = useState(todayIso());
  const [empfaengerName, setEmpfaengerName] = useState("");
  const [empfaengerAdresse, setEmpfaengerAdresse] = useState("");
  const [artDerAufwendung, setArtDerAufwendung] = useState("");
  const [betrag, setBetrag] = useState<string>("");
  const [zahlungsart, setZahlungsart] = useState<PaymentMethod>("bar");
  const [grund, setGrund] = useState("");
  const [anmerkungen, setAnmerkungen] = useState("");
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Wenn sich der Zähler-Wert im Parent ändert (z. B. nach Reset),
  // Belegnummer automatisch mitziehen — außer der User hat sie manuell überschrieben.
  const autoBelegNummer = useMemo(() => formatBelegNummer(counter), [counter]);
  const [belegIsManual, setBelegIsManual] = useState(false);

  const effectiveBeleg = belegIsManual ? belegNummer : autoBelegNummer;

  function applyCategory(label: string) {
    const cat = COMMON_CATEGORIES.find((c) => c.label === label);
    if (!cat) return;
    if (!artDerAufwendung) setArtDerAufwendung(cat.label);
    if (!grund && cat.defaultReason) setGrund(cat.defaultReason);
  }

  function resetForm(newCounter: number) {
    onCounterChange(newCounter);
    setBelegNummer(formatBelegNummer(newCounter));
    setBelegIsManual(false);
    setAusgabeDatum(todayIso());
    setAusstellungsDatum(todayIso());
    setEmpfaengerName("");
    setEmpfaengerAdresse("");
    setArtDerAufwendung("");
    setBetrag("");
    setZahlungsart("bar");
    setGrund("");
    setAnmerkungen("");
    setSignature(undefined);
  }

  const betragNumber = Number(betrag.replace(",", "."));
  const showWarning = Number.isFinite(betragNumber) && betragNumber >= PLAUSIBILITY_WARNING_THRESHOLD_EUR;

  const missing: string[] = [];
  if (!effectiveBeleg.trim()) missing.push("Belegnummer");
  if (!ausstellungsDatum) missing.push("Ausstellungsdatum");
  if (!aussteller.trim()) missing.push("Aussteller");
  if (!ausgabeDatum) missing.push("Datum der Ausgabe");
  if (!empfaengerName.trim()) missing.push("Zahlungsempfänger");
  if (!artDerAufwendung.trim()) missing.push("Art der Aufwendung");
  if (!Number.isFinite(betragNumber) || betragNumber <= 0) missing.push("Betrag");
  if (!grund.trim()) missing.push("Grund");

  async function handleGenerate() {
    if (missing.length > 0) return;
    setBusy(true);
    try {
      const data: EigenbelegData = {
        belegNummer: effectiveBeleg,
        ausstellungsDatum,
        aussteller: aussteller.trim(),
        ausgabeDatum,
        empfaengerName: empfaengerName.trim(),
        empfaengerAdresse: empfaengerAdresse.trim() || undefined,
        artDerAufwendung: artDerAufwendung.trim(),
        betrag: betragNumber,
        zahlungsart,
        grundDesEigenbelegs: grund.trim(),
        anmerkungen: anmerkungen.trim() || undefined,
        signatureDataUrl: signature,
      };

      const doc = await generateEigenbelegPdf(data, company, COMPANY_DEFAULTS.logoPath);
      const filename = buildPdfFilename(effectiveBeleg, aussteller);
      const blob = doc.output("blob");
      saveAs(blob, filename);

      const sizeNote =
        blob.size > MAX_PDF_BYTES
          ? ` ⚠ Datei ist ${formatBytes(blob.size)} groß und überschreitet das 8-MB-Limit. Eventuell eine kleinere Unterschrift hochladen.`
          : ` (${formatBytes(blob.size)})`;
      setLastResult(`${filename}${sizeNote}`);
      resetForm(counter + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Einzelner Eigenbeleg</h2>
      <p className="card-sub">
        Alle mit * markierten Felder sind Pflichtangaben für das Finanzamt. Nach dem Erstellen wird
        automatisch das nächste Belegnummer-Kürzel vorgeschlagen.
      </p>

      <div className="counter-row" style={{ marginBottom: 14 }}>
        <div>
          <label>Mitarbeiter / Aussteller *</label>
          <input
            value={aussteller}
            onChange={(e) => onAusstellerChange(e.target.value)}
            placeholder="z. B. Max Mustermann"
            style={{ minWidth: 220 }}
          />
        </div>
        <div>
          <label>Nächste laufende Nr.</label>
          <input
            type="number"
            min={1}
            value={counter}
            onChange={(e) => {
              const next = Math.max(1, parseInt(e.target.value || "1", 10));
              onCounterChange(next);
              if (!belegIsManual) setBelegNummer(formatBelegNummer(next));
            }}
            style={{ width: 100 }}
          />
        </div>
        <div className="grow">
          <label>Belegnummer *</label>
          <input
            value={effectiveBeleg}
            onChange={(e) => {
              setBelegNummer(e.target.value);
              setBelegIsManual(true);
            }}
          />
        </div>
        {belegIsManual && (
          <div style={{ alignSelf: "flex-end" }}>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setBelegIsManual(false);
                setBelegNummer(autoBelegNummer);
              }}
              title="Auf automatisch generierte Belegnummer zurücksetzen"
            >
              ↺ Auto
            </button>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div>
          <label>Datum der Ausgabe *</label>
          <input type="date" value={ausgabeDatum} onChange={(e) => setAusgabeDatum(e.target.value)} />
        </div>
        <div>
          <label>Ausstellungsdatum des Belegs *</label>
          <input
            type="date"
            value={ausstellungsDatum}
            onChange={(e) => setAusstellungsDatum(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Kategorie (optional — füllt Art &amp; Grund vor)</label>
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) applyCategory(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">— auswählen —</option>
          {COMMON_CATEGORIES.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Art der Aufwendung *</label>
        <input
          value={artDerAufwendung}
          onChange={(e) => setArtDerAufwendung(e.target.value)}
          placeholder="z. B. Parkgebühr am Bahnhof Bochum"
        />
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <div>
          <label>Zahlungsempfänger (Name / Firma) *</label>
          <input
            value={empfaengerName}
            onChange={(e) => setEmpfaengerName(e.target.value)}
            placeholder="z. B. Parkhaus Bochum Hbf"
          />
        </div>
        <div>
          <label>Anschrift des Empfängers (optional)</label>
          <input
            value={empfaengerAdresse}
            onChange={(e) => setEmpfaengerAdresse(e.target.value)}
            placeholder="z. B. Buddenbergplatz 1, 44787 Bochum"
          />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <div>
          <label>Betrag (EUR) *</label>
          <input
            type="text"
            inputMode="decimal"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            placeholder="z. B. 4,50"
          />
          {showWarning && (
            <div className="warning" style={{ marginTop: 6 }}>
              Bei Beträgen ab {PLAUSIBILITY_WARNING_THRESHOLD_EUR} € prüft das Finanzamt kritischer.
              Die Begründung unten sollte besonders nachvollziehbar sein.
            </div>
          )}
        </div>
        <div>
          <label>Zahlungsart *</label>
          <select value={zahlungsart} onChange={(e) => setZahlungsart(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
              <option key={k} value={k}>
                {PAYMENT_METHOD_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Grund für den Eigenbeleg *</label>
        <input
          list="common-reasons"
          value={grund}
          onChange={(e) => setGrund(e.target.value)}
          placeholder="z. B. Automat ohne Quittung"
        />
        <datalist id="common-reasons">
          {COMMON_REASONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Anmerkungen (optional)</label>
        <textarea value={anmerkungen} onChange={(e) => setAnmerkungen(e.target.value)} />
      </div>

      <div style={{ marginTop: 14 }}>
        <label>Unterschrift (optional)</label>
        <SignaturePad value={signature} onChange={setSignature} />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          className="primary"
          onClick={handleGenerate}
          disabled={busy || missing.length > 0}
          title={missing.length ? `Fehlend: ${missing.join(", ")}` : ""}
        >
          {busy ? "Erstelle PDF …" : "PDF erstellen & herunterladen"}
        </button>
        {missing.length > 0 && (
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            Fehlend: {missing.join(", ")}
          </span>
        )}
      </div>

      {lastResult && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--success)" }}>
          ✓ {lastResult} wurde heruntergeladen. Formular für den nächsten Beleg zurückgesetzt.
        </div>
      )}
    </div>
  );
}
