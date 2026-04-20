import { useEffect, useState } from "react";
import { PasswordGate } from "./components/PasswordGate";
import { SingleForm } from "./components/SingleForm";
import { BatchMode } from "./components/BatchMode";
import { CompanyDataPanel, DEFAULT_COMPANY } from "./components/CompanyDataPanel";
import { clearAuth, isAuthenticated } from "./lib/auth";
import { COMPANY_DEFAULTS } from "./config";
import type { CompanyData } from "./types";

type Tab = "single" | "batch";

const LS_COMPANY = "eigenbeleg:company:v1";
const LS_AUSSTELLER = "eigenbeleg:aussteller:v1";
const LS_COUNTER = "eigenbeleg:counter:v1";

function loadCompany(): CompanyData {
  try {
    const raw = localStorage.getItem(LS_COMPANY);
    if (raw) return JSON.parse(raw) as CompanyData;
  } catch {
    // ignore
  }
  return DEFAULT_COMPANY;
}

function loadAussteller(): string {
  return localStorage.getItem(LS_AUSSTELLER) || "";
}

function loadCounter(): number {
  const raw = localStorage.getItem(LS_COUNTER);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function App() {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [tab, setTab] = useState<Tab>("single");
  const [company, setCompany] = useState<CompanyData>(loadCompany);
  const [aussteller, setAussteller] = useState<string>(loadAussteller);
  const [counter, setCounter] = useState<number>(loadCounter);
  const [showCompany, setShowCompany] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_COMPANY, JSON.stringify(company));
  }, [company]);

  useEffect(() => {
    localStorage.setItem(LS_AUSSTELLER, aussteller);
  }, [aussteller]);

  useEffect(() => {
    localStorage.setItem(LS_COUNTER, String(counter));
  }, [counter]);

  if (!authed) {
    return <PasswordGate onUnlocked={() => setAuthed(true)} />;
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <img src={COMPANY_DEFAULTS.logoPath} alt="HYPEUP" />
          <div>
            <h1>Eigenbeleg Generator</h1>
            <div className="sub">HYPEUP GmbH · intern</div>
          </div>
        </div>
        <div className="row-actions">
          <button className="ghost" onClick={() => setShowCompany((s) => !s)}>
            {showCompany ? "Firmendaten ausblenden" : "Firmendaten bearbeiten"}
          </button>
          <button
            className="ghost"
            onClick={() => {
              clearAuth();
              setAuthed(false);
            }}
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="container">
        {showCompany && <CompanyDataPanel value={company} onChange={setCompany} />}

        <div className="tabs">
          <button className={tab === "single" ? "active" : ""} onClick={() => setTab("single")}>
            Einzelner Beleg
          </button>
          <button className={tab === "batch" ? "active" : ""} onClick={() => setTab("batch")}>
            Batch-Verarbeitung
          </button>
        </div>

        {tab === "single" ? (
          <SingleForm
            company={company}
            aussteller={aussteller}
            onAusstellerChange={setAussteller}
            counter={counter}
            onCounterChange={setCounter}
          />
        ) : (
          <BatchMode
            company={company}
            aussteller={aussteller}
            onAusstellerChange={setAussteller}
            counter={counter}
            onCounterChange={setCounter}
          />
        )}

        <footer style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "32px 0" }}>
          Eigenbelege sind 10 Jahre aufzubewahren (GoBD) · Kein Vorsteuerabzug · Alle Daten werden
          ausschließlich lokal im Browser verarbeitet.
        </footer>
      </main>
    </>
  );
}
