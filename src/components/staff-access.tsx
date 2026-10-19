import { useEffect, useState } from "react";
import { listStaffLogins, removeStaffLogin, saveStaffLogin } from "@/lib/bookings.functions";

const field = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base";

export function StaffAccess({ staffEmail, pin }: { staffEmail: string; pin: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ email: string; owner: boolean }[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [again, setAgain] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const list = await listStaffLogins({ data: { staffEmail, pin } });
    setRows(list);
  }

  useEffect(() => {
    if (!open) return;
    void load().catch(() => setNote("Accessi non disponibili."));
  }, [open, staffEmail, pin]);

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Accessi</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-10 items-center rounded-md border border-border px-3 text-sm font-medium"
        >
          {open ? "Chiudi" : "Apri"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        info@mttravelservice.com entra con il codice che hai già. Qui aggiungi altre mail, ognuna con il suo codice.
      </p>
      {open ? (
        <div className="mt-4 grid gap-4">
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={row.email} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {row.email}
                  {row.owner ? <span className="text-muted"> · principale, codice invariato</span> : null}
                </span>
                {row.owner ? null : (
                  <button
                    type="button"
                    className="text-muted"
                    onClick={() => {
                      setBusy(true);
                      setNote("");
                      void removeStaffLogin({ data: { staffEmail, pin, loginEmail: row.email } })
                        .then(() => load())
                        .then(() => setNote("Mail tolta."))
                        .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Non tolta."))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Rimuovi
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim().length < 4) {
                setNote("Il codice deve avere almeno 4 caratteri.");
                return;
              }
              if (code !== again) {
                setNote("I due codici non coincidono.");
                return;
              }
              setBusy(true);
              setNote("");
              void saveStaffLogin({ data: { staffEmail, pin, loginEmail: email, loginPin: code.trim() } })
                .then(() => load())
                .then(() => {
                  setEmail("");
                  setCode("");
                  setAgain("");
                  setNote("Mail autorizzata.");
                })
                .catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Non salvata."))
                .finally(() => setBusy(false));
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Nuova mail"
              autoComplete="off"
              className={field}
            />
            <input
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Codice"
              autoComplete="new-password"
              className={field}
            />
            <input
              type="password"
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              placeholder="Ripeti il codice"
              autoComplete="new-password"
              className={field}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50"
            >
              Autorizza mail
            </button>
          </form>
          {note ? <p className="text-sm text-primary">{note}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
