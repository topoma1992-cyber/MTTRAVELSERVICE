import { CalendarPlus } from "lucide-react";
import { googleCalendarHref, type Booking } from "@/lib/bookings";
import { downloadBookingPdf } from "@/lib/pdf";
import { PdfExport } from "@/components/pdf-export";

export function RequestActions({ booking }: { booking: Booking }) {
  return (
    <>
      <PdfExport label="Scarica PDF" onExport={(vat) => downloadBookingPdf(booking, vat)} />
      <a
        href={googleCalendarHref(booking)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        Google Calendar
      </a>
    </>
  );
}