// ============================================================================
// Eigenbeleg Generator — Zentrale Konfiguration
// ============================================================================
// Hier alle Anpassungen vornehmen (Firmendaten, Passwort-Hash).
// ============================================================================

// SHA-256-Hash des Zugangspassworts.
// Aktuell: "Campuskeller"
// Neues Passwort setzen:
//   printf "%s" "NeuesPasswort" | shasum -a 256
// und den hier eingefügten Hash ersetzen.
export const PASSWORD_HASH =
  "ed7080586dd7d469ddf74308b7acbb4393b4c38c1d759430ee11019217eabaa7";

// Firmenstammdaten (aktuelle Adresse, Standard beim Laden)
export const COMPANY_DEFAULTS = {
  name: "HYPEUP GmbH",
  street: "Viktoriastr. 39",
  zip: "44787",
  city: "Bochum",
  country: "Deutschland",
  ustId: "DE 341748955",
  logoPath: `${import.meta.env.BASE_URL}logo.png`,
} as const;

// Häufige Kategorien für Eigenbelege (Dropdown-Vorschläge)
// Optional auswählbar, überschreibt das Freitextfeld nicht.
export const COMMON_CATEGORIES: Array<{
  label: string;
  defaultReason: string;
}> = [
  {
    label: "Parkgebühr",
    defaultReason: "Automat ohne Quittung",
  },
  {
    label: "Trinkgeld",
    defaultReason: "Trinkgeld ohne Beleg",
  },
  {
    label: "Porto / Briefmarken",
    defaultReason: "Automat ohne Quittung",
  },
  {
    label: "Kleinbetrag Bewirtung",
    defaultReason: "Beleg verloren",
  },
  {
    label: "Büromaterial",
    defaultReason: "Beleg verloren",
  },
  {
    label: "Fahrtkosten (ÖPNV)",
    defaultReason: "Ticket entwertet/verloren",
  },
  {
    label: "Sonstiges",
    defaultReason: "",
  },
];

// Häufige Gründe, warum kein Originalbeleg vorliegt
export const COMMON_REASONS = [
  "Beleg verloren",
  "Kein Beleg erhalten",
  "Automat ohne Quittung",
  "Trinkgeld ohne Beleg",
  "Beleg unleserlich",
] as const;

// Belegnummer-Präfix (wird mit Jahr + laufender Nummer kombiniert)
// Ergebnis: EB-2026-0042
export const BELEG_PREFIX = "EB";

// Schwellwert, ab dem ein Hinweis zur Prüfung durch das Finanzamt erscheint
export const PLAUSIBILITY_WARNING_THRESHOLD_EUR = 150;
