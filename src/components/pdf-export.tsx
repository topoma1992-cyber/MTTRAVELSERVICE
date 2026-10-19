import { useState } from "react";
import { FileDown } from "lucide-react";
import type { VatChoice } from "@/lib/pdf";

export function PdfExport({
  label,
  onExport,
}: {
  label: string;
  onExport: (vat: VatChoice) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [vat, setVat] = useState<VatChoice | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
      >
        <FileDown className="size-4" aria-hidden="true" />
        {label}
      </button>
      {open ? (
        <VatFields
          vat={vat}
          busy={busy}
          error={error}
          onVat={setVat}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            if (!vat) {
              setError("Scegli il regime IVA del PDF.");
              return;
            }
            setError("");
            setBusy(true);
            void onExport(vat)
              .then(() => setOpen(false))
              .catch(() => setError("Non riesco a creare il PDF. Riprova."))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </div>
  );
}

export function VatFields({
  vat,
  busy,
  error,
  onVat,
  onCancel,
  onConfirm,
}: {
  vat: VatChoice | "";
  busy?: boolean;
  error?: string;
  onVat: (vat: VatChoice) => void;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium">Regime IVA da scrivere nel PDF</p>
      <p className="text-sm text-muted">Il totale per il cliente non cambia. Serve solo sul documento.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" className="mt-1" checked={vat === "zero"} onChange={() => onVat("zero")} />
        <span>IVA 0%. Operazione senza applicazione dell'IVA ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 come modificato dalla L. 208/2015 e L. 145/2018.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" className="mt-1" checked={vat === "ten"} onChange={() => onVat("ten")} />
        <span>IVA 10% già inclusa nel totale indicato.</span>
      </label>
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          {busy ? "PDF…" : "Genera PDF"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="inline-flex h-11 items-center px-3 text-sm text-muted">
            Annulla
          </button>
        ) : null}
      </div>
    </div>
  );
}
