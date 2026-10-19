import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
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
import { DiscountCodes } from "@/components/discount-codes";
import { StaffAccess } from "@/components/staff-access";
import { StaffEdit } from "@/components/staff-edit";
import { StaffQuote } from "@/components/staff-quote";
import { PaymentBadge } from "@/components/payment-marks";
import { euro, formatWhen, peopleLabel } from "@/lib/format";
import { downloadDriverPdf, type VatChoice } from "@/lib/pdf";
import { fleetLabel, tripFleet } from "@/lib/tariff";

const SESSION_KEY = "mt-travel-staff";
const LEGACY_PIN_KEY = "mt-travel-staff-pin";
const OWNER_EMAIL = "info@mttravelservice.com";

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { staffEmail?: string; pin?: string };
      if (parsed.staffEmail && parsed.pin) return { staffEmail: parsed.staffEmail, pin: parsed.pin };
    }
  } catch {
    /* sessione illeggibile */
  }
  const pin = localStorage.getItem(LEGACY_PIN_KEY);
  if (pin) return { staffEmail: OWNER_EMAIL, pin };
  return null;
}

export const Route = createFileRoute("/richieste")({
  head: () => ({
    meta: [{ title: "Gestione · MT Travel" }],
  }),
  component: RichiestePage,
});

function RichiestePage() {
  const [phase, setPhase] = useState<"loading" | "setup" | "locked" | "ready">("loading");
  const [staffEmail, setStaffEmail] = useState("");
  const [pin, setPin] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [moreId, setMoreId] = useState<string | null>(null);

  async function openWith(nextEmail: string, nextPin: string) {
    const rows = await listStaffBookings({ data: { staffEmail: nextEmail, pin: nextPin } });
    setStaffEmail(nextEmail);
    setPin(nextPin);
    setBookings(rows);
    setPhase("ready");
    localStorage.setItem(SESSION_KEY, JSON.stringify({ staffEmail: nextEmail, pin: nextPin }));
    localStorage.removeItem(LEGACY_PIN_KEY);
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
        const saved = readSession();
        if (!saved) {
          setPhase("locked");
          return;
        }
        return openWith(saved.staffEmail, saved.pin).catch(() => {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(LEGACY_PIN_KEY);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-primary">Solo per te</p>
          <h1 className="mt-1 text-center text-2xl">Richieste</h1>
        </div>
        {phase === "ready" ? <NoticeBell bookings={bookings} /> : null}
      </div>
      <p className="mt-2 text-muted">
        I clienti vedono solo la prenotazione. Qui arrivano le richieste, dopo l'accesso.
      </p>

      {phase === "loading" ? <p className="mt-8 text-muted">Carico…</p> : null}
      {phase === "setup" ? (
        <PinForm
          title="Crea il codice"
          hint="Il codice vale per info@mttravelservice.com. È l'unico accesso finché non ne aggiungi altri."
          submitLabel="Crea codice"
          confirm
          onSubmit={async (next) => {
            await claimStaff({ data: { pin: next } });
            await openWith(OWNER_EMAIL, next);
          }}
        />
      ) : null}
      {phase === "locked" ? (
        <LoginForm
          hint={error || "Entra con una mail autorizzata e il suo codice. info@mttravelservice.com usa il codice che hai già."}
          onSubmit={openWith}
        />
      ) : null}

      {phase === "ready" ? <StaffAccess staffEmail={staffEmail} pin={pin} /> : null}
      {phase === "ready" ? <AlertSettings staffEmail={staffEmail} pin={pin} /> : null}
      {phase === "ready" ? <DiscountCodes staffEmail={staffEmail} pin={pin} /> : null}
      {phase === "ready" ? <StaffQuote staffEmail={staffEmail} pin={pin} onSaved={(booking) => setBookings((current) => [booking, ...current])} /> : null}

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
              <li id={`richiesta-${booking.id}`} key={booking.id} className="scroll-mt-6 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xl font-semibold">{booking.code}</p>
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
                  {fleetLabel(tripFleet(booking.trip))} · {peopleLabel(booking.trip.passengers)}
                  {booking.trip.roundTrip ? " · A/R" : ""}
                  {" · "}
                  {paymentLabel(booking.paymentMethod)}
                </p>
                <div className="mt-3">
                  <p className="text-sm text-muted">Totale</p>
                  <p className="text-2xl font-semibold tabular-nums">{euro(booking.quote.total)}</p>
                  {booking.quote.approachKm ? (
                    <p className="text-sm text-muted">Km sede inseriti: {booking.quote.approachKm}. Il cliente vede solo l'asterisco.</p>
                  ) : null}
                  {booking.quote.remote ? (
                    <p className="text-sm text-muted">Partenza e arrivo oltre 20 km dalla sede: il cliente vede l'asterisco e l'avviso sul vettore vicino.</p>
                  ) : null}
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
                {editId === booking.id ? (
                  <StaffEdit
                    booking={booking}
                    pin={pin}
                    staffEmail={staffEmail}
                    onClose={() => setEditId(null)}
                    onSaved={(next) =>
                      setBookings((current) => current.map((item) => (item.id === next.id ? next : item)))
                    }
                  />
                ) : null}
                {confirmId === booking.id ? (
                  <ConfirmPanel
                    booking={booking}
                    onClose={() => setConfirmId(null)}
                    onConfirm={async (patch) => {
                      await confirmStaffBooking({ data: { staffEmail, pin, id: booking.id, ...patch } });
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
                    {confirmed ? "Riapri conferma" : "Accetta"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectId(booking.id)}
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    Rifiuta
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoreId((current) => (current === booking.id ? null : booking.id))}
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                  >
                    {moreId === booking.id ? "Chiudi" : "Altro"}
                  </button>
                </div>
                {moreId === booking.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditId(booking.id)}
                      className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriverId(booking.id)}
                      className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
                    >
                      Altro autista
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
                            void removeStaffBooking({ data: { staffEmail, pin, id: booking.id } }).then(() => {
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
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}

function NoticeBell({ bookings }: { bookings: Booking[] }) {
  const [open, setOpen] = useState(false);
  const items = bookings.filter((booking) => booking.status !== "confirmed");

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Richieste da vedere"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-fg">
            {items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">Nessuna richiesta nuova o modifica da accettare.</p>
          ) : (
            <ul>
              {items.map((booking) => (
                <li key={booking.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left hover:bg-bg"
                    onClick={() => {
                      setOpen(false);
                      document.getElementById(`richiesta-${booking.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <p className="font-medium">{booking.code}</p>
                    <p className="text-sm text-muted">
                      {booking.revised ? "Modifica da accettare" : "Nuova richiesta"} · {booking.customer.firstName}{" "}
                      {booking.customer.lastName}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PinForm({
  title,
  hint,
  submitLabel,
  confirm = false,
  onSubmit,
  onError,
}: {
  title: string;
  hint: string;
  submitLabel: string;
  confirm?: boolean;
  onSubmit: (pin: string) => Promise<void>;
  onError?: (message: string) => void;
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
            const message = reason instanceof Error ? reason.message : "Non riuscito.";
            setError(message);
            onError?.(message);
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

function LoginForm({ hint, onSubmit }: { hint: string; onSubmit: (email: string, pin: string) => Promise<void> }) {
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-8 grid max-w-md gap-3 rounded-lg border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!email.includes("@") || pin.trim().length < 4) {
          setError("Servono mail e codice, almeno 4 caratteri.");
          return;
        }
        setBusy(true);
        setError("");
        void onSubmit(email.trim().toLowerCase(), pin.trim()).catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : "Accesso non riuscito.");
          setBusy(false);
        });
      }}
    >
      <p className="font-medium">Entra in gestione</p>
      <p className="text-sm text-muted">{hint}</p>
      <input
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Mail"
        className="h-12 rounded-md border border-border bg-bg px-3 text-base"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        placeholder="Codice"
        className="h-12 rounded-md border border-border bg-bg px-3 text-base"
      />
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50"
      >
        {busy ? "Attendi…" : "Apri"}
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
  const [vat, setVat] = useState<VatChoice | "">("");
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
      <p className="text-sm font-medium">Regime IVA da scrivere nel PDF. Il compenso non cambia.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" className="mt-1" checked={vat === "zero"} onChange={() => setVat("zero")} />
        <span>IVA 0%. Operazione senza applicazione dell'IVA ai sensi dell'art. 1, commi da 54 a 89, L. 190/2014 come modificato dalla L. 208/2015 e L. 145/2018.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="radio" className="mt-1" checked={vat === "ten"} onChange={() => setVat("ten")} />
        <span>IVA 10% già inclusa nella cifra indicata.</span>
      </label>
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
            if (!vat) {
              setError("Scegli il regime IVA del PDF.");
              return;
            }
            setError("");
            setBusy(true);
            void downloadDriverPdf(booking, amount, vat)
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
