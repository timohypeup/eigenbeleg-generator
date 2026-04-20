import { COMPANY_DEFAULTS } from "../config";
import type { CompanyData } from "../types";

interface Props {
  value: CompanyData;
  onChange: (next: CompanyData) => void;
}

const DEFAULT_COMPANY: CompanyData = {
  name: COMPANY_DEFAULTS.name,
  street: COMPANY_DEFAULTS.street,
  zip: COMPANY_DEFAULTS.zip,
  city: COMPANY_DEFAULTS.city,
  country: COMPANY_DEFAULTS.country,
  ustId: COMPANY_DEFAULTS.ustId,
};

function isDefault(c: CompanyData): boolean {
  return (
    c.name === DEFAULT_COMPANY.name &&
    c.street === DEFAULT_COMPANY.street &&
    c.zip === DEFAULT_COMPANY.zip &&
    c.city === DEFAULT_COMPANY.city &&
    c.country === DEFAULT_COMPANY.country &&
    c.ustId === DEFAULT_COMPANY.ustId
  );
}

export function CompanyDataPanel({ value, onChange }: Props) {
  const atDefault = isDefault(value);

  function update<K extends keyof CompanyData>(key: K, val: CompanyData[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="card">
      <h2>Firmendaten</h2>
      <p className="card-sub">
        Diese Daten erscheinen im Kopf des Eigenbelegs. Standardmäßig ist die aktuelle HYPEUP-Adresse
        vorausgefüllt — bei Bedarf (z. B. für Belege aus der Zeit vor dem Umzug) anpassen.
      </p>
      <div className="grid-2">
        <div>
          <label>Firmenname</label>
          <input value={value.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label>USt-ID</label>
          <input value={value.ustId} onChange={(e) => update("ustId", e.target.value)} />
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div>
          <label>Straße + Hausnr.</label>
          <input value={value.street} onChange={(e) => update("street", e.target.value)} />
        </div>
        <div>
          <label>Land</label>
          <input value={value.country} onChange={(e) => update("country", e.target.value)} />
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 10 }}>
        <div>
          <label>PLZ</label>
          <input value={value.zip} onChange={(e) => update("zip", e.target.value)} />
        </div>
        <div>
          <label>Ort</label>
          <input value={value.city} onChange={(e) => update("city", e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_COMPANY)}
          disabled={atDefault}
          title="Setzt die Firmenadresse auf die aktuelle HYPEUP-Adresse zurück."
        >
          Auf aktuelle Adresse zurücksetzen
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_COMPANY };
