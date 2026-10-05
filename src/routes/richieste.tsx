import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  bookingMessage,
  confirmationMessage,
  mailHref,
  PAYMENT_METHODS,
  paymentLabel,
  rejectionMessage,
  whatsappHref,
  whatsappTo,
  type Booking,
  type PaymentMethod,
} from "@/lib/bookings";
import {
  claimStaff,
  confirmStaffBooking,
  listStaffBookings,
  removeStaffBooking,
  staffStatus,
} from "@/lib/bookings.functions";
import { RequestActions } from "@/components/request-actions";
import { AlertSettings } from "@/components/alert-settings";
import { StaffQuote } from "@/components/staff-quote";
import { PaymentBadge } from "@/components/payment-marks";
import { euro, formatWhen, peopleLabel } from "@/lib/format";
import { downloadDriverPdf } from "@/lib/pdf";
import { VEHICLES } from "@/lib/tariff";

const PIN_KEY = "mt-travel-staff-pin";

export const Route = createFileRoute("/richieste")({
  head: () => ({
    meta: [{ title: "Gestione · MT Travel" }],
  }),
  component: RichiestePage,
});

function RichiestePage() {
  const [phase, setPhase] = useState<"loading" | "setup" | "locked" | "ready">("loading");
  const [pin, setPin] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  async function openWith(nextPin: string) {
    const rows = await listStaffBookings({ data: { pin: nextPin } });
    setPin(nextPin);
    setBookings(rows);
    setPhase("ready");
    localStorage.setItem(PIN_KEY, nextPin);
  }

  useEffect(() => {
    let alive = true;
    void staffStatus()
      .then((status) => {
        if (!alive) return;
        if (!status.claimed) {
          setPhase("setup");
          return;
        }
        const saved = localStorage.getItem(PIN_KEY) ?? "";
        if (!saved) {
          setPhase("locked");
          return;
        }
        return openWith(saved).catch(() => {
          localStorage.removeItem(PIN_KEY);
          if (alive) setPhase("locked");
        });
      })
      .catch(() => {
        if (alive) {
          setError("Archivio non disponibile. Riprova.");
          setPhase("locked");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 lg:py-10">
      <p className="text-sm text-primary">Solo per te</p>
      <h1 className="mt-1 font-display text-4xl">Richieste</h1>
      <p className="mt-2 text-muted">
        I clienti vedono solo la prenotazione. Qui arrivano le richieste, dopo il codice di gestione.
      </p>

      {phase === "loading" ? <p className="mt-8 text-muted">Carico…</p> : null}
      {phase === "setup" ? (
        <PinForm
          title="Crea il codice"
          hint="Fallo subito, prima di mandare il link ai clienti. Chi crea il codice è l'unico che vede le richieste."
          submitLabel="Crea codice"
          confirm
          onSubmit={async (next) => {
            await claimStaff({ data: { pin: next } });
            await openWith(next);
          }}
        />
      ) : null}
      {phase === "locked" ? (
        <PinForm
          title="Entra in gestione"
          hint={error || "Inserisci il codice che hai creato su questo servizio."}
          submitLabel="Apri"
          onSubmit={openWith}
        />
      ) : null}

      {phase === "ready" ? <AlertSettings pin={pin} /> : null}
      {phase === "ready" ? <StaffQuote pin={pin} onSaved={(booking) => setBookings((current) => [booking, ...current])} /> : null}

      {phase === "ready" && bookings.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-surface p-5">
          <p>Nessuna richiesta per ora.</p>
          <Link
            to="/"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg"
          >
            Apri la prenotazione
          </Link>
        </div>
      ) : null}

      {phase === "ready" ? (
        <ul className="mt-6 grid gap-3">
          {bookings.map((booking) => {
            const text = bookingMessage(booking);
            const removing = pendingId === booking.id;
            const confirmed = booking.status === "confirmed";
            return (
              <li key={booking.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-2xl">{booking.code}</p>
                  <p className={`text-sm ${confirmed ? "text-fg" : "text-primary"}`}>
                    {confirmed ? "Confermata" : booking.revised ? "Modificata · da riconfermare" : "Da confermare"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">{formatWhen(booking.trip.date, booking.trip.time)}</p>
                <p className="mt-3">
                  {booking.trip.origin.label}
                  <span className="text-muted"> → </span>
                  {booking.trip.destination.label}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {VEHICLES[booking.trip.vehicle].name} · {peopleLabel(booking.trip.passengers)}
                  {booking.trip.roundTrip ? " · A/R" : ""}
                  {" · "}
                  {paymentLabel(booking.paymentMethod)}
                </p>
                <div className="mt-3">
                  <p className="text-sm text-muted">Totale</p>
                  <p className="font-display text-3xl tabular-nums">{euro(booking.quote.total)}</p>
                </div>
                <p className="mt-3">
                  {booking.customer.firstName} {booking.customer.lastName}
                </p>
                <p className="text-sm">
                  <a className="text-primary" href={`tel:${booking.customer.phone.replace(/\s/g, "")}`}>
                    {booking.customer.phone}
                  </a>
                  <span className="text-muted"> · </span>
                  <a className="text-primary" href={`mailto:${booking.customer.email}`}>
                    {booking.customer.email}
                  </a>
                </p>
                {confirmId === booking.id ? (
                  <ConfirmPanel
                    booking={booking}
                    onClose={() => setConfirmId(null)}
                    onConfirm={async (patch) => {
                      await confirmStaffBooking({ data: { pin, id: booking.id, ...patch } });
                      setBookings((current) =>
                        current.map((item) =>
                          item.id === booking.id
                            ? { ...item, status: "confirmed", paymentMethod: patch.paymentMethod, paymentLink: patch.paymentLink }
                            : item,
                        ),
                      );
                    }}
                  />
                ) : null}
                {driverId === booking.id ? (
                  <DriverPanel booking={booking} onClose={() => setDriverId(null)} />
                ) : null}
                {rejectId === booking.id ? (
                  <RejectPanel booking={booking} onClose={() => setRejectId(null)} />
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmId(booking.id)}
                    className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
                  >
                    {confirmed ? "Riapri conferma" : "Conferma"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverId(booking.id)}
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    Altro autista
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(booking.id)}
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    Rifiuta
                  </button>
                  <a
                    href={whatsappHref(text)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    WhatsApp richiesta
                  </a>
                  <RequestActions booking={booking} />
                  {removing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void removeStaffBooking({ data: { pin, id: booking.id } }).then(() => {
                            setBookings((current) => current.filter((item) => item.id !== booking.id));
                            setPendingId(null);
                          });
                        }}
                        className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm"
                      >
                        Elimina
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingId(null)}
                        className="inline-flex h-11 items-center px-3 text-sm text-muted"
                      >
                        Annulla
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingId(booking.id)}
                      className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}

function PinForm({
  title,
  hint,
  submitLabel,
  confirm = false,
  onSubmit,
}: {
  title: string;
  hint: string;
  submitLabel: string;
  confirm?: boolean;
  onSubmit: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-8 grid max-w-md gap-3 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pin.trim().length < 4) {
          setError("Almeno 4 caratteri.");
          return;
        }
        if (confirm && pin !== again) {
          setError("I due codici non coincidono.");
          return;
        }
        setBusy(true);
        setError("");
        void onSubmit(pin.trim())
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "Non riuscito.");
            setBusy(false);
          });
      }}
    >
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted">{hint}</p>
      <input
        type="password"
        autoComplete={confirm ? "new-password" : "current-password"}
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        placeholder="Codice"
        className="h-12 rounded-md border border-border bg-bg px-3 text-base"
      />
      {confirm ? (
        <input
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          placeholder="Ripeti il codice"
          className="h-12 rounded-md border border-border bg-bg px-3 text-base"
        />
      ) : null}
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50"
      >
        {busy ? "Attendi…" : submitLabel}
      </button>
    </form>
  );
}

function DriverPanel({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const reduced = Math.round(booking.quote.total * 0.8 * 100) / 100;
  const [mode, setMode] = useState<"cut" | "custom">("cut");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = mode === "cut" ? reduced : Number(custom.replace(",", "."));

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium">Assegnazione viaggio</p>
      <p className="text-sm text-muted">Totale cliente {euro(booking.quote.total)}. Scegli il compenso da scrivere nel PDF.</p>
      <div className="grid gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name={`driver-${booking.id}`} checked={mode === "cut"} onChange={() => setMode("cut")} />
          20% in meno · {euro(reduced)}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name={`driver-${booking.id}`} checked={mode === "custom"} onChange={() => setMode("custom")} />
          Altra cifra
        </label>
        {mode === "custom" ? (
          <input
            inputMode="decimal"
            value={custom}
            placeholder="Es. 80"
            onChange={(event) => setCustom(event.target.value)}
            className="h-12 rounded-md border border-border bg-surface px-3 text-base"
          />
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!Number.isFinite(amount) || amount <= 0) {
              setError("Inserisci una cifra valida.");
              return;
            }
            setError("");
            setBusy(true);
            void downloadDriverPdf(booking, amount)
              .catch(() => setError("Non riesco a creare il PDF. Riprova."))
              .finally(() => setBusy(false));
          }}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          {busy ? "PDF…" : "Genera PDF"}
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center px-3 text-sm text-muted">
          Chiudi
        </button>
      </div>
    </div>
  );
}

function RejectPanel({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [kind, setKind] = useState<"distance" | "unavailable" | "">("");
  const [base, setBase] = useState("");
  const [error, setError] = useState("");
  const reason = kind === "distance" ? { kind, base } : kind === "unavailable" ? { kind } : null;
  const draft = reason && (kind !== "distance" || base.trim().length > 1) ? rejectionMessage(booking, reason) : "";

  function send(channel: "whatsapp" | "mail") {
    if (!kind) {
      setError("Scegli il motivo.");
      return;
    }
    if (kind === "distance" && base.trim().length < 2) {
      setError("Scrivi la sede.");
      return;
    }
    const text = rejectionMessage(booking, kind === "distance" ? { kind, base } : { kind: "unavailable" });
    const href =
      channel === "whatsapp"
        ? whatsappTo(booking.customer.phone, text)
        : mailHref(booking, text, `Transfer ${booking.code}`);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium">Rifiuta la richiesta</p>
      <div className="grid gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="radio" name={`no-${booking.id}`} checked={kind === "distance"} onChange={() => setKind("distance")} />
          Troppo distante dalla sede
        </label>
        {kind === "distance" ? (
          <input
            value={base}
            placeholder="Sede, es. Gambettola"
            onChange={(event) => setBase(event.target.value)}
            className="h-12 rounded-md border border-border bg-surface px-3 text-base"
          />
        ) : null}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="radio"
            name={`no-${booking.id}`}
            checked={kind === "unavailable"}
            onChange={() => setKind("unavailable")}
          />
          Nessuna disponibilità dei mezzi
        </label>
      </div>
      {draft ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm">
          {draft}
        </pre>
      ) : null}
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send("whatsapp")}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          WhatsApp al cliente
        </button>
        <button
          type="button"
          onClick={() => send("mail")}
          className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
        >
          Email al cliente
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center px-3 text-sm text-muted">
          Chiudi
        </button>
      </div>
    </div>
  );
}

function ConfirmPanel({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: (patch: { paymentMethod: PaymentMethod; paymentLink: string }) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod | "">(booking.paymentMethod ?? "");
  const [link, setLink] = useState(booking.paymentLink ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needsLink = method !== "" && method !== "bonifico";
  const draft = method
    ? confirmationMessage({ ...booking, paymentMethod: method, paymentLink: link }, link)
    : "";

  function send(channel: "whatsapp" | "mail") {
    if (!method) {
      setError("Scegli il metodo di pagamento.");
      return;
    }
    if (needsLink && !/^https?:\/\/\S+$/i.test(link.trim())) {
      setError("Incolla il link di pagamento, completo di https://");
      return;
    }
    setError("");
    setBusy(true);
    const patch = { paymentMethod: method, paymentLink: needsLink ? link.trim() : "" };
    void onConfirm(patch)
      .then(() => {
        const saved = { ...booking, ...patch, status: "confirmed" as const };
        const text = confirmationMessage(saved);
        const href =
          channel === "whatsapp"
            ? whatsappTo(booking.customer.phone, text)
            : mailHref(saved, text, `Conferma transfer ${booking.code}`);
        window.open(href, "_blank", "noopener,noreferrer");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Conferma non riuscita.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium">Conferma per {booking.customer.firstName}</p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Metodo di pagamento">
        {PAYMENT_METHODS.map((item) => (
          <label
            key={item.id}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 text-sm ${
              method === item.id ? "border-primary bg-surface-2" : "border-border"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={`pay-${booking.id}`}
                checked={method === item.id}
                onChange={() => setMethod(item.id)}
              />
              {item.label}
            </span>
            <PaymentBadge method={item.id} />
          </label>
        ))}
      </div>
      {needsLink ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium">Link di pagamento</span>
          <input
            value={link}
            inputMode="url"
            placeholder="https://"
            onChange={(event) => setLink(event.target.value)}
            className="h-12 w-full rounded-md border border-border bg-surface px-3 text-base"
          />
        </label>
      ) : null}
      {method === "bonifico" ? (
        <p className="text-sm text-muted">
          Nel messaggio vanno IBAN, intestazione Mario Topo e la causale con data e nome del passeggero.
        </p>
      ) : null}
      {draft ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm">
          {draft}
        </pre>
      ) : null}
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => send("whatsapp")}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50"
        >
          WhatsApp al cliente
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => send("mail")}
          className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50"
        >
          Email al cliente
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center px-3 text-sm text-muted">
          Chiudi
        </button>
      </div>
    </div>
  );
}
