export interface CompanyData {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  ustId: string;
}

export type PaymentMethod = "bar" | "karte" | "ueberweisung" | "sonstige";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bar: "Bar",
  karte: "Karte",
  ueberweisung: "Überweisung",
  sonstige: "Sonstige",
};

/**
 * Alle Pflichtangaben eines Eigenbelegs.
 * Alle Felder außer den als optional markierten müssen gesetzt sein,
 * damit das Finanzamt den Beleg anerkennt.
 */
export interface EigenbelegData {
  // Belegkopf
  belegNummer: string; // z. B. EB-2026-0042
  ausstellungsDatum: string; // ISO-Datum, wann der Eigenbeleg erstellt wurde
  aussteller: string; // Name des Mitarbeiters, der den Beleg ausstellt

  // Ausgabe
  ausgabeDatum: string; // ISO-Datum, wann die Ausgabe getätigt wurde
  empfaengerName: string; // Name / Firma des Zahlungsempfängers
  empfaengerAdresse?: string; // Adresse des Zahlungsempfängers (soweit bekannt)
  artDerAufwendung: string; // z. B. "Parkgebühr am Bahnhof Bochum"
  betrag: number; // in Euro
  zahlungsart: PaymentMethod;
  grundDesEigenbelegs: string; // z. B. "Automat ohne Quittung"
  anmerkungen?: string; // Optionale zusätzliche Anmerkungen

  // Unterschrift (optional — falls leer, wird Platz zum handschriftlichen Unterschreiben gelassen)
  signatureDataUrl?: string; // Data-URL eines gezeichneten PNGs
}
