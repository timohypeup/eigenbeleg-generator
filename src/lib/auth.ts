import { PASSWORD_HASH } from "../config";

const STORAGE_KEY = "eigenbeleg:auth:v1";

/**
 * Berechnet SHA-256 einer Zeichenkette und liefert Hex-Encoding.
 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Prüft ein eingegebenes Passwort gegen den konfigurierten Hash.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = await sha256Hex(password);
  return hash === PASSWORD_HASH;
}

/**
 * Markiert die aktuelle Browser-Session als authentifiziert.
 * sessionStorage: geht beim Schließen des Tabs verloren → bewusster Re-Login.
 */
export function persistAuth(): void {
  sessionStorage.setItem(STORAGE_KEY, "1");
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function clearAuth(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
