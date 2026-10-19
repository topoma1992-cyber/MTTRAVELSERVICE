import { useEffect, useRef, useState } from "react";
import { listDiscountCodes, removeDiscountCode, saveDiscountCode } from "@/lib/bookings.functions";
import { discountSummary, type DiscountRule } from "@/lib/tariff";

const field = "h-11 w-full rounded-md border border-border bg-bg px-3 text-base";

const empty: DiscountRule = {
  code: "",
  active: true,
  totalPercent: 0,
  ridePercent: 0,
  minFare: 0,
  nightPercent: 0,
  holidayPercent: 0,
  waitPercent: 0,
  meetGreetFree: false,
  maxAmount: 0,
  vehicle: "all",
};

function num(value: string) {
  const next = Number(value.replace(",", "."));
  return Number.isFinite(next) ? next : 0;
}

export function DiscountCodes({ staffEmail, pin }: { staffEmail: string; pin: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DiscountRule[]>([]);
  const [note, setNote] = useState("");
  const [draftKey, setDraftKey] = useState(0);

  async function load() {
    const list = await listDiscountCodes({ data: { staffEmail, pin } });
    setRows(list);
  }

  useEffect(() => {
    if (!open) return;
    void load().catch(() => setNote("Codici non disponibili."));
  }, [open, staffEmail, pin]);

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Codici sconto</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm font-medium"
        >
          {open ? "Chiudi" : "Apri"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Ogni codice si modifica da solo. I clienti vedono lo sconto solo se il codice è attivo.</p>
      {open ? (
        <div className="mt-4 grid gap-4">
          {note ? <p className="text-sm text-primary">{note}</p> : null}
          <DiscountForm
            key={draftKey}
            initial={{ ...empty }}
            submitLabel="Crea codice"
            onSave={async (rule) => {
              await saveDiscountCode({ data: { staffEmail, pin, ...rule, previousCode: "" } });
              await load();
              setDraftKey((value) => value + 1);
              setNote("Codice creato.");
            }}
          />
          {rows.map((rule) => (
            <DiscountForm
              key={rule.code}
              initial={rule}
              submitLabel="Salva"
              onSave={async (next) => {
                await saveDiscountCode({ data: { staffEmail, pin, ...next, previousCode: rule.code } });
                await load();
                setNote(`${next.code} salvato.`);
              }}
              onRemove={async () => {
                await removeDiscountCode({ data: { staffEmail, pin, code: rule.code } });
                await load();
                setNote(`${rule.code} eliminato.`);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DiscountForm({
  initial,
  submitLabel,
  onSave,
  onRemove,
}: {
  initial: DiscountRule;
  submitLabel: string;
  onSave: (rule: DiscountRule) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [rule, setRule] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setRule(initial);
  }, [initial.code, initial.totalPercent, initial.ridePercent, initial.minFare, initial.nightPercent, initial.holidayPercent, initial.waitPercent, initial.meetGreetFree, initial.active, initial.maxAmount, initial.vehicle]);

  function set<K extends keyof DiscountRule>(key: K, value: DiscountRule[K]) {
    setRule((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="grid gap-3 rounded-md border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        void onSave({ ...rule, code: rule.code.trim().toUpperCase() })
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Non salvato."))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid min-w-40 flex-1 gap-1 text-sm">
          Codice
          <input value={rule.code} maxLength={20} onChange={(event) => set("code", event.target.value.toUpperCase())} className={field} />
        </label>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={rule.active} onChange={(event) => set("active", event.target.checked)} />
          Attivo
        </label>
        {onRemove ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              setBusy(true);
              setError("");
              void onRemove()
                .catch((reason) => {
                  setError(reason instanceof Error ? reason.message : "Non eliminato.");
                  setBusy(false);
                  setConfirmDelete(false);
                });
            }}
            className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
          >
            {confirmDelete ? "Conferma eliminazione" : "Elimina"}
          </button>
        ) : null}
      </div>
      <p className="text-sm text-muted">{discountSummary(rule) || "Nessuno sconto impostato."}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField label="Sconto sul totale %" value={rule.totalPercent} onChange={(value) => set("totalPercent", value)} />
        <NumberField label="Sconto massimo €" value={rule.maxAmount} onChange={(value) => set("maxAmount", value)} />
        <NumberField label="Sconto sulla tratta %" value={rule.ridePercent} onChange={(value) => set("ridePercent", value)} />
        <NumberField label="Solo se la tratta supera €" value={rule.minFare} onChange={(value) => set("minFare", value)} />
        <NumberField label="Sconto notturno %" value={rule.nightPercent} onChange={(value) => set("nightPercent", value)} />
        <NumberField label="Sconto festivo %" value={rule.holidayPercent} onChange={(value) => set("holidayPercent", value)} />
        <NumberField label="Sconto attesa %" value={rule.waitPercent} onChange={(value) => set("waitPercent", value)} />
      </div>
      <label className="grid gap-1 text-sm">
        Vale per
        <select value={rule.vehicle} onChange={(event) => set("vehicle", event.target.value === "car" || event.target.value === "van" ? event.target.value : "all")} className={field}>
          <option value="all">Auto e van</option>
          <option value="car">Solo auto</option>
          <option value="van">Solo van</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rule.meetGreetFree} onChange={(event) => set("meetGreetFree", event.target.checked)} />
        Meet & greet gratuito
      </label>
      <p className="text-sm text-muted">
        Se compili tratta, notturno, festivo, attesa o meet & greet, valgono quelle voci. Lo sconto sul totale si usa solo da solo.
        Sconto massimo 0 = nessun tetto. Esempio: 20% su 1.000 € fa 200 €; con massimo 100 € lo sconto si ferma a 100 €.
      </p>
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">
          {busy ? "Salvo…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(value > 0 ? String(value).replace(".", ",") : "");
  const sent = useRef(value);

  useEffect(() => {
    if (sent.current === value) return;
    sent.current = value;
    setText(value > 0 ? String(value).replace(".", ",") : "");
  }, [value]);

  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0"
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.,]/g, "").replace(/^0+(?=\d)/, "");
          const next = raw === "" || raw === "," || raw === "." ? 0 : num(raw);
          sent.current = next;
          setText(raw);
          onChange(next);
        }}
        className={field}
      />
    </label>
  );
}
