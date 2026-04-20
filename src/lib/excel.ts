import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { EigenbelegData, PaymentMethod } from "../types";

// Spalten in der Excel-Vorlage. Reihenfolge = spaltenweise Anzeige.
export const TEMPLATE_COLUMNS = [
  "Belegnummer",
  "Ausstellungsdatum",
  "Aussteller",
  "Datum der Ausgabe",
  "Empfänger Name",
  "Empfänger Adresse",
  "Art der Aufwendung",
  "Betrag (EUR)",
  "Zahlungsart",
  "Grund für Eigenbeleg",
  "Anmerkungen",
] as const;

type TemplateRow = Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string | number>>;

/**
 * Erzeugt eine leere Excel-Vorlage und lädt sie herunter.
 * Enthält eine Beispielzeile, damit Format und Datumsnotation klar sind.
 */
export function downloadTemplate(): void {
  const exampleRow: TemplateRow = {
    Belegnummer: "EB-2026-0001",
    Ausstellungsdatum: "20.04.2026",
    Aussteller: "Max Mustermann",
    "Datum der Ausgabe": "18.04.2026",
    "Empfänger Name": "Parkhaus Bochum Hbf",
    "Empfänger Adresse": "Buddenbergplatz 1, 44787 Bochum",
    "Art der Aufwendung": "Parkgebühr während Kundentermin",
    "Betrag (EUR)": 4.5,
    Zahlungsart: "bar",
    "Grund für Eigenbeleg": "Automat ohne Quittung",
    Anmerkungen: "",
  };

  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: [...TEMPLATE_COLUMNS] });

  // Spaltenbreiten
  ws["!cols"] = [
    { wch: 16 }, // Belegnummer
    { wch: 18 }, // Ausstellungsdatum
    { wch: 22 }, // Aussteller
    { wch: 18 }, // Datum der Ausgabe
    { wch: 28 }, // Empfänger Name
    { wch: 40 }, // Empfänger Adresse
    { wch: 40 }, // Art der Aufwendung
    { wch: 14 }, // Betrag
    { wch: 14 }, // Zahlungsart
    { wch: 32 }, // Grund
    { wch: 32 }, // Anmerkungen
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Eigenbelege");

  // Zweites Tabellenblatt mit Anleitung
  const help = [
    ["Anleitung zur Eigenbeleg-Vorlage"],
    [""],
    ["• Belegnummer: eindeutig, fortlaufend, z. B. EB-2026-0001, EB-2026-0002 …"],
    ["• Datumsfelder: Format TT.MM.JJJJ (z. B. 20.04.2026)"],
    ["• Betrag: Punkt oder Komma als Dezimaltrennzeichen (4.50 oder 4,50)"],
    ["• Zahlungsart: einer von 'bar', 'karte', 'ueberweisung', 'sonstige'"],
    ["• Empfänger Adresse + Anmerkungen sind optional"],
    [""],
    ["Beim Import werden alle Zeilen verarbeitet, in denen mindestens"],
    ["Belegnummer, Aussteller, Datum der Ausgabe und Betrag gefüllt sind."],
  ];
  const helpWs = XLSX.utils.aoa_to_sheet(help);
  helpWs["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, helpWs, "Anleitung");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "Eigenbeleg_Vorlage.xlsx"
  );
}

/**
 * Normalisiert deutsche Datumsangaben (TT.MM.JJJJ) zu ISO (JJJJ-MM-TT).
 * Akzeptiert auch Excel-serial-Numbers (falls das Feld als Datum formatiert war).
 */
function parseDateToIso(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  // Excel-Datum als Zahl (seit 1900-01-01)
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString().split("T")[0];
  }

  const str = String(value).trim();

  // Bereits ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);

  // TT.MM.JJJJ
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // TT/MM/JJJJ
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return str;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return NaN;
  const str = String(value).trim().replace(/\./g, "").replace(",", ".");
  return Number(str);
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const str = String(value || "").toLowerCase().trim();
  if (["bar", "cash", "barzahlung"].includes(str)) return "bar";
  if (["karte", "card", "ec", "kreditkarte"].includes(str)) return "karte";
  if (["ueberweisung", "überweisung", "transfer"].includes(str)) return "ueberweisung";
  return "sonstige";
}

export interface ParsedRow {
  rowIndex: number;
  data: EigenbelegData | null;
  errors: string[];
}

/**
 * Liest eine hochgeladene Excel-/CSV-Datei und wandelt sie in EigenbelegData-Objekte um.
 * Zeilen mit Pflichtfeld-Fehlern werden markiert aber mit zurückgegeben,
 * damit der User in der UI sehen kann was schiefgelaufen ist.
 */
export async function parseExcelUpload(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("eigenbeleg")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows.map((row, idx) => {
    const errors: string[] = [];

    const belegNummer = String(row["Belegnummer"] || "").trim();
    const ausstellungsDatum = parseDateToIso(row["Ausstellungsdatum"]);
    const aussteller = String(row["Aussteller"] || "").trim();
    const ausgabeDatum = parseDateToIso(row["Datum der Ausgabe"]);
    const empfaengerName = String(row["Empfänger Name"] || "").trim();
    const empfaengerAdresse = String(row["Empfänger Adresse"] || "").trim();
    const artDerAufwendung = String(row["Art der Aufwendung"] || "").trim();
    const betrag = parseNumber(row["Betrag (EUR)"]);
    const zahlungsart = parsePaymentMethod(row["Zahlungsart"]);
    const grund = String(row["Grund für Eigenbeleg"] || "").trim();
    const anmerkungen = String(row["Anmerkungen"] || "").trim();

    if (!belegNummer) errors.push("Belegnummer fehlt");
    if (!ausstellungsDatum) errors.push("Ausstellungsdatum fehlt");
    if (!aussteller) errors.push("Aussteller fehlt");
    if (!ausgabeDatum) errors.push("Datum der Ausgabe fehlt");
    if (!empfaengerName) errors.push("Empfänger fehlt");
    if (!artDerAufwendung) errors.push("Art der Aufwendung fehlt");
    if (!Number.isFinite(betrag) || betrag <= 0) errors.push("Betrag ungültig");
    if (!grund) errors.push("Grund fehlt");

    // Wenn zu viele Pflichtfelder fehlen: gilt als leere Zeile → ignorieren
    const nonEmpty = [belegNummer, aussteller, ausgabeDatum, empfaengerName].filter(Boolean).length;
    if (nonEmpty === 0) {
      return { rowIndex: idx + 2, data: null, errors: [] };
    }

    if (errors.length > 0) {
      return { rowIndex: idx + 2, data: null, errors };
    }

    const data: EigenbelegData = {
      belegNummer,
      ausstellungsDatum,
      aussteller,
      ausgabeDatum,
      empfaengerName,
      empfaengerAdresse: empfaengerAdresse || undefined,
      artDerAufwendung,
      betrag,
      zahlungsart,
      grundDesEigenbelegs: grund,
      anmerkungen: anmerkungen || undefined,
    };
    return { rowIndex: idx + 2, data, errors: [] };
  });
}
