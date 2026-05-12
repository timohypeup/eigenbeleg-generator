import { useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { BELEG_PREFIX, COMPANY_DEFAULTS } from "../config";
import { downloadTemplate, parseExcelUpload } from "../lib/excel";
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

interface Row {
  // Nicht `EigenbelegData` direkt, weil Strings während der Bearbeitung leichter zu handhaben sind.
  id: string;
  belegNummer: string;
  ausstellungsDatum: string;
  aussteller: string;
  ausgabeDatum: string;
  empfaengerName: string;
  empfaengerAdresse: string;
  artDerAufwendung: string;
  betrag: string;
  zahlungsart: PaymentMethod;
  grundDesEigenbelegs: string;
  anmerkungen: string;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatBelegNummer(counter: number): string {
  const year = new Date().getFullYear();
  return `${BELEG_PREFIX}-${year}-${String(counter).padStart(4, "0")}`;
}

function emptyRow(counter: number, aussteller: string): Row {
  return {
    id: crypto.randomUUID(),
    belegNummer: formatBelegNummer(counter),
    ausstellungsDatum: todayIso(),
    aussteller,
    ausgabeDatum: todayIso(),
    empfaengerName: "",
    empfaengerAdresse: "",
    artDerAufwendung: "",
    betrag: "",
    zahlungsart: "bar",
    grundDesEigenbelegs: "",
    anmerkungen: "",
  };
}

function validateRow(row: Row): { data: EigenbelegData | null; errors: string[] } {
  const errors: string[] = [];
  if (!row.belegNummer.trim()) errors.push("Belegnummer");
  if (!row.ausstellungsDatum) errors.push("Ausstellungsdatum");
  if (!row.aussteller.trim()) errors.push("Aussteller");
  if (!row.ausgabeDatum) errors.push("Datum der Ausgabe");
  if (!row.empfaengerName.trim()) errors.push("Empfänger");
  if (!row.artDerAufwendung.trim()) errors.push("Art der Aufwendung");
  const betrag = Number(row.betrag.replace(",", "."));
  if (!Number.isFinite(betrag) || betrag <= 0) errors.push("Betrag");
  if (!row.grundDesEigenbelegs.trim()) errors.push("Grund");

  if (errors.length > 0) return { data: null, errors };

  return {
    data: {
      belegNummer: row.belegNummer.trim(),
      ausstellungsDatum: row.ausstellungsDatum,
      aussteller: row.aussteller.trim(),
      ausgabeDatum: row.ausgabeDatum,
      empfaengerName: row.empfaengerName.trim(),
      empfaengerAdresse: row.empfaengerAdresse.trim() || undefined,
      artDerAufwendung: row.artDerAufwendung.trim(),
      betrag,
      zahlungsart: row.zahlungsart,
      grundDesEigenbelegs: row.grundDesEigenbelegs.trim(),
      anmerkungen: row.anmerkungen.trim() || undefined,
    },
    errors: [],
  };
}

export function BatchMode({
  company,
  aussteller,
  onAusstellerChange,
  counter,
  onCounterChange,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(counter, aussteller)]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validations = useMemo(() => rows.map(validateRow), [rows]);
  const readyCount = validations.filter((v) => v.data).length;

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    // nächste laufende Nummer = counter + Anzahl schon existierender Zeilen mit Standard-Präfix-Nummern
    const nextCounter = counter + rows.length;
    setRows((prev) => [...prev, emptyRow(nextCounter, aussteller)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function fillDown(field: keyof Row) {
    // Nimmt den Wert der ersten Zeile und füllt alle weiteren leeren Zeilen in dieser Spalte damit.
    if (rows.length < 2) return;
    const value = rows[0][field] as string;
    if (!value) return;
    setRows((prev) =>
      prev.map((r, i) => (i === 0 ? r : (r[field] as string) ? r : { ...r, [field]: value }))
    );
  }

  async function handleFile(file: File) {
    setImportWarnings([]);
    try {
      const parsed = await parseExcelUpload(file);
      const warnings: string[] = [];
      const nextRows: Row[] = [];

      for (const p of parsed) {
        if (!p.data && p.errors.length === 0) continue; // leere Zeilen überspringen
        if (!p.data) {
          warnings.push(`Zeile ${p.rowIndex}: ${p.errors.join(", ")}`);
          continue;
        }
        nextRows.push({
          id: crypto.randomUUID(),
          belegNummer: p.data.belegNummer,
          ausstellungsDatum: p.data.ausstellungsDatum,
          aussteller: p.data.aussteller,
          ausgabeDatum: p.data.ausgabeDatum,
          empfaengerName: p.data.empfaengerName,
          empfaengerAdresse: p.data.empfaengerAdresse || "",
          artDerAufwendung: p.data.artDerAufwendung,
          betrag: String(p.data.betrag).replace(".", ","),
          zahlungsart: p.data.zahlungsart,
          grundDesEigenbelegs: p.data.grundDesEigenbelegs,
          anmerkungen: p.data.anmerkungen || "",
        });
      }

      if (nextRows.length > 0) {
        setRows(nextRows);
      } else {
        warnings.unshift("Keine gültigen Zeilen in der Datei gefunden.");
      }
      setImportWarnings(warnings);
    } catch (err) {
      setImportWarnings([`Import fehlgeschlagen: ${(err as Error).message}`]);
    }
  }

  async function handleGenerateAll() {
    if (readyCount === 0) return;
    setBusy(true);
    setLog([]);
    try {
      const zip = new JSZip();
      const messages: string[] = [];
      // In der Reihenfolge der Zeilen, damit Belegnummern deterministisch sind
      for (let i = 0; i < rows.length; i++) {
        const v = validations[i];
        if (!v.data) {
          messages.push(`Zeile ${i + 1} übersprungen (${v.errors.join(", ")})`);
          continue;
        }
        // Globale Batch-Signatur in jedes Beleg-Objekt einsetzen.
        const beleg: EigenbelegData = signature ? { ...v.data, signatureDataUrl: signature } : v.data;
        const doc = await generateEigenbelegPdf(beleg, company, COMPANY_DEFAULTS.logoPath);
        const filename = buildPdfFilename(beleg.belegNummer, beleg.aussteller);
        const arrayBuffer = doc.output("arraybuffer");
        zip.file(filename, arrayBuffer);
        const tooBig = arrayBuffer.byteLength > MAX_PDF_BYTES;
        messages.push(
          `${tooBig ? "⚠" : "✓"} ${filename} (${formatBytes(arrayBuffer.byteLength)})${tooBig ? " — überschreitet 8 MB" : ""}`
        );
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const ts = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
      saveAs(blob, `Eigenbelege_${ts}.zip`);
      setLog(messages);

      // Counter um Anzahl erstellter Belege erhöhen
      onCounterChange(counter + readyCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Batch-Verarbeitung</h2>
        <p className="card-sub">
          Erfasse mehrere Eigenbelege in der Tabelle oder lade eine ausgefüllte Excel-Vorlage hoch.
          Alle Belege werden als einzelne PDFs erstellt und gebündelt in einem ZIP heruntergeladen.
        </p>

        <div className="counter-row">
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
              onChange={(e) => onCounterChange(Math.max(1, parseInt(e.target.value || "1", 10)))}
              style={{ width: 100 }}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="button" onClick={() => downloadTemplate()}>
              📥 Excel-Vorlage herunterladen
            </button>
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              📤 Excel hochladen
            </button>
          </div>
        </div>

        {importWarnings.length > 0 && (
          <div className="warning" style={{ marginTop: 12 }}>
            <strong>Import-Hinweise:</strong>
            <ul style={{ margin: "6px 0 0 18px" }}>
              {importWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Unterschrift für alle Belege im Stapel (optional)</h2>
        <p className="card-sub">
          Wird auf <strong>jeden</strong> der unten gelisteten Belege angewendet. Leer lassen, wenn jeder
          Beleg nach dem Druck handschriftlich unterschrieben werden soll.
        </p>
        <SignaturePad value={signature} onChange={setSignature} />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <strong>{rows.length}</strong> Zeile(n), davon {readyCount} vollständig.
          </div>
          <div className="row-actions">
            <button type="button" onClick={addRow}>
              + Zeile
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleGenerateAll}
              disabled={busy || readyCount === 0}
            >
              {busy ? "Erstelle PDFs …" : `ZIP mit ${readyCount} PDF${readyCount === 1 ? "" : "s"} erstellen`}
            </button>
          </div>
        </div>

        <div className="batch-table-wrap">
          <table className="batch">
            <thead>
              <tr>
                <th></th>
                <th>Belegnr.</th>
                <th>Ausgabe-Datum</th>
                <th>Ausstellungs-Datum</th>
                <th>Aussteller</th>
                <th>Empfänger</th>
                <th>Empfänger-Adresse</th>
                <th>Art der Aufwendung</th>
                <th>Betrag (€)</th>
                <th>Zahlungsart</th>
                <th>Grund</th>
                <th>Anmerkungen</th>
                <th></th>
              </tr>
              <tr>
                <th></th>
                <th colSpan={11} style={{ fontWeight: 400, fontSize: 11, color: "var(--muted)" }}>
                  Tipp: Erste Zeile ausfüllen und dann ↓ klicken, um leere Zellen mit dem Wert zu füllen.
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const v = validations[i];
                return (
                  <tr key={row.id} className={v.errors.length > 0 ? "has-error" : ""}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        value={row.belegNummer}
                        onChange={(e) => updateRow(row.id, { belegNummer: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.ausgabeDatum}
                        onChange={(e) => updateRow(row.id, { ausgabeDatum: e.target.value })}
                      />
                      {i === 0 && rows.length > 1 && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => fillDown("ausgabeDatum")}
                          title="In alle leeren Zeilen kopieren"
                        >
                          ↓
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.ausstellungsDatum}
                        onChange={(e) => updateRow(row.id, { ausstellungsDatum: e.target.value })}
                      />
                      {i === 0 && rows.length > 1 && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => fillDown("ausstellungsDatum")}
                        >
                          ↓
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        value={row.aussteller}
                        onChange={(e) => updateRow(row.id, { aussteller: e.target.value })}
                      />
                      {i === 0 && rows.length > 1 && (
                        <button type="button" className="ghost" onClick={() => fillDown("aussteller")}>
                          ↓
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        value={row.empfaengerName}
                        onChange={(e) => updateRow(row.id, { empfaengerName: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.empfaengerAdresse}
                        onChange={(e) => updateRow(row.id, { empfaengerAdresse: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.artDerAufwendung}
                        onChange={(e) => updateRow(row.id, { artDerAufwendung: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={row.betrag}
                        onChange={(e) => updateRow(row.id, { betrag: e.target.value })}
                        inputMode="decimal"
                        style={{ minWidth: 80 }}
                      />
                    </td>
                    <td>
                      <select
                        value={row.zahlungsart}
                        onChange={(e) =>
                          updateRow(row.id, { zahlungsart: e.target.value as PaymentMethod })
                        }
                      >
                        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                          <option key={k} value={k}>
                            {PAYMENT_METHOD_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={row.grundDesEigenbelegs}
                        onChange={(e) => updateRow(row.id, { grundDesEigenbelegs: e.target.value })}
                      />
                      {i === 0 && rows.length > 1 && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => fillDown("grundDesEigenbelegs")}
                        >
                          ↓
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        value={row.anmerkungen}
                        onChange={(e) => updateRow(row.id, { anmerkungen: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        title="Zeile entfernen"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {validations.some((v) => v.errors.length > 0) && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)" }}>
            Rot markierte Zeilen haben fehlende Pflichtfelder und werden beim Erstellen übersprungen.
          </div>
        )}

        {log.length > 0 && (
          <ul className="result-list">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
