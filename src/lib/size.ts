// Maximalgröße, ab der wir Belege als „zu groß" anzeigen.
// Liegt bewusst 1 MB unter dem 9-MB-Limit des Ziel-Tools, damit Puffer bleibt.
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
