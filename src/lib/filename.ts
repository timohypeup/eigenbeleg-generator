/**
 * Macht Strings dateinamen-sicher:
 *  - Umlaute → ae/oe/ue/ss
 *  - alles andere Nicht-Alphanumerische → Bindestrich
 *  - mehrfache Bindestriche werden zusammengefasst
 */
export function sanitizeForFilename(input: string): string {
  return input
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

/**
 * Baut den endgültigen PDF-Dateinamen.
 * Format: Eigenbeleg_<Belegnummer>_<Mitarbeiter>.pdf
 */
export function buildPdfFilename(belegNummer: string, aussteller: string): string {
  const safeBeleg = sanitizeForFilename(belegNummer) || "Eigenbeleg";
  const safeName = sanitizeForFilename(aussteller) || "unbekannt";
  return `Eigenbeleg_${safeBeleg}_${safeName}.pdf`;
}
