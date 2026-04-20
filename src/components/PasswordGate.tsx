import { useState } from "react";
import { persistAuth, verifyPassword } from "../lib/auth";
import { COMPANY_DEFAULTS } from "../config";

interface Props {
  onUnlocked: () => void;
}

export function PasswordGate({ onUnlocked }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const ok = await verifyPassword(password);
    setChecking(false);
    if (ok) {
      persistAuth();
      onUnlocked();
    } else {
      setError("Passwort falsch.");
      setPassword("");
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={handleSubmit}>
        <img src={COMPANY_DEFAULTS.logoPath} alt="HYPEUP" />
        <h1>Eigenbeleg Generator</h1>
        <p>Dieser Bereich ist passwortgeschützt.</p>
        <input
          type="password"
          placeholder="Passwort"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error-text">{error}</div>}
        <button
          type="submit"
          className="primary"
          style={{ width: "100%" }}
          disabled={checking || !password}
        >
          {checking ? "Prüfe …" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
