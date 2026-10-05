import { useState } from "react";
import { CalendarPlus, FileDown } from "lucide-react";
import { googleCalendarHref, type Booking } from "@/lib/bookings";
import { downloadBookingPdf } from "@/lib/pdf";

export function RequestActions({ booking }: { booking: Booking }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError("");
          setBusy(true);
          void downloadBookingPdf(booking)
            .catch(() => setError("Non riesco a creare il PDF. Riprova."))
            .finally(() => setBusy(false));
        }}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50"
      >
        <FileDown className="size-4" aria-hidden="true" />
        {busy ? "PDF…" : "Scarica PDF"}
      </button>
      <a
        href={googleCalendarHref(booking)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        Google Calendar
      </a>
      {error ? <p className="basis-full text-sm text-primary">{error}</p> : null}
    </>
  );
}
