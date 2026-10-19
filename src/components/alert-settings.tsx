import { useEffect, useState } from "react";
import { alertSettings, saveAlertSettings } from "@/lib/bookings.functions";

const field = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base";

export function AlertSettings({ staffEmail, pin }: { staffEmail: string; pin: string }) {
  const [email, setEmail] = useState("info@mttravelservice.com");
  const [pass, setPass] = useState("");
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void alertSettings({ data: { staffEmail, pin } })
      .then((row) => {
        setEmail(row.notifyEmail);
        setReady(row.mailReady);
      })
      .catch(() => setNote("Avvisi non disponibili."));
  }, [staffEmail, pin]);

  async function save() {
    setNote("");
    try {
      const row = await saveAlertSettings({ data: { staffEmail, pin, notifyEmail: email, smtpPass: pass } });
      setReady(row.mailReady || ready);
      setPass("");
      setNote(row.mailReady || (ready && !pass) ? "Salvato. Le mail partono da sole." : "Salvato. Senza password delle app la mail al cliente non parte ancora.");
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : "Non salvato.");
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Avvisi</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm font-medium"
        >
          {open ? "Chiudi" : "Apri"}
        </button>
      </div>
      {open ? (
        <>
      <p className="mt-1 text-sm text-muted">
        Ogni nuova richiesta, e ogni modifica del cliente, ti arriva su questa email. Con la password delle app di Gmail
        parte anche la mail al cliente, con il link per vedere e modificare.
      </p>
      <label className="mt-3 grid gap-1 text-sm">
        La tua email
        <input value={email} onChange={(event) => setEmail(event.target.value)} className={field} />
      </label>
      <label className="mt-3 grid gap-1 text-sm">
        Password delle app Gmail
        <input
          type="password"
          value={pass}
          autoComplete="new-password"
          placeholder={ready ? "Già attiva, lasciala vuota per non cambiarla" : "Incolla la password delle app"}
          onChange={(event) => setPass(event.target.value)}
          className={field}
        />
      </label>
      <p className="mt-2 text-sm text-muted">
        Su Google: Sicurezza, poi Password per le app. Non è la password normale di Gmail.
        {ready ? " La posta verso i clienti è attiva." : " Senza questa password il cliente vede comunque il link a fine richiesta."}
      </p>
      <button type="button" onClick={() => void save()} className="mt-3 inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg">
        Salva avvisi
      </button>
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
        </>
      ) : null}
    </section>
  );
}
