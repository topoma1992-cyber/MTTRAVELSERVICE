import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { bagsLabel, euro, formatDuration, formatWhen, kmLabel, paymentDueLine, paymentNotice, peopleLabel } from "@/lib/format";
import { priceSplit, VEHICLES, billedWaitMinutes, waitBlockLabel, type Quote } from "@/lib/tariff";
import type { Place, VehicleId } from "@/lib/types";

export type TripSnapshot = {
  origin: Place;
  destination: Place;
  stops: Place[];
  roundTrip: boolean;
  date: string;
  time: string;
  landingDate: string;
  landingTime: string;
  returnDate: string;
  returnTime: string;
  passengers: number;
  luggage: number;
  oversized: boolean;
  oversizedNote: string;
  vehicle: VehicleId;
  childSeats: number;
  boosters: number;
  meetGreet: boolean;
  pet: boolean;
  waitMinutes: number;
  flight: string;
};

export type Customer = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
};

export type PaymentMethod = "bonifico" | "link" | "satispay" | "rate";

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "bonifico", label: "Bonifico istantaneo" },
  { id: "link", label: "Link di pagamento" },
  { id: "satispay", label: "Satispay" },
  { id: "rate", label: "4 rate" },
];

export const BANK = {
  iban: "IT30F0200809500000421149653",
  holder: "Mario Topo",
};

export type Booking = {
  id: string;
  code: string;
  createdAt: string;
  trip: TripSnapshot;
  customer: Customer;
  quote: Quote;
  paymentMethod: PaymentMethod;
  status: "pending" | "confirmed";
  paymentLink: string;
  revised?: boolean;
};

type BookingState = {
  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  removeBooking: (id: string) => void;
  confirmBooking: (id: string, patch: { paymentMethod: PaymentMethod; paymentLink: string }) => void;
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      bookings: [],
      addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
      removeBooking: (id) =>
        set((state) => ({ bookings: state.bookings.filter((booking) => booking.id !== id) })),
      confirmBooking: (id, patch) =>
        set((state) => ({
          bookings: state.bookings.map((booking) =>
            booking.id === id
              ? {
                  ...booking,
                  status: "confirmed",
                  paymentMethod: patch.paymentMethod,
                  paymentLink: patch.paymentLink.trim(),
                }
              : booking,
          ),
        })),
    }),
    { name: "mt-travel-bookings-v1", skipHydration: true },
  ),
);

export function useStoreReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = useBookingStore.persist.onFinishHydration(() => setReady(true));
    void useBookingStore.persist.rehydrate();
    if (useBookingStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);
  return ready;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeBookingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `MT-${code}`;
}

export function bookingMessage(booking: Booking) {
  const { trip, customer, quote } = booking;
  const vehicle = VEHICLES[trip.vehicle];
  const lines = [
    "Richiesta NCC · MT Travel Service",
    `Codice: ${booking.code}`,
    "",
    `Cliente: ${customer.firstName} ${customer.lastName}`,
    `Telefono: ${customer.phone}`,
    `Email: ${customer.email}`,
    "",
    `${vehicle.name} · ${peopleLabel(trip.passengers)} · ${bagsLabel(trip.luggage)} standard`,
    `Partenza: ${trip.origin.label}`,
    ...trip.stops.map((stop, index) => `Fermata ${index + 1}: ${stop.label}`),
    `Arrivo: ${trip.destination.label}`,
    `Data: ${formatWhen(trip.date, trip.time)}`,
    trip.roundTrip ? `Ritorno: ${formatWhen(trip.returnDate, trip.returnTime)}` : "Solo andata",
  ];
  if (trip.oversizedNote?.trim()) lines.push(`Bagagli fuori misura: ${trip.oversizedNote.trim()}`);
  if (trip.meetGreet && trip.landingTime) {
    lines.push(`Volo: ${trip.flight.trim() || "—"}`);
    lines.push(`Atterraggio previsto: ${formatWhen(trip.landingDate || trip.date, trip.landingTime)}`);
    lines.push(
      `Attesa gratuita in aeroporto con cartello nominativo: 1 ora dall'atterraggio previsto. Ritrovo: ${formatWhen(trip.date, trip.time)}`,
    );
  } else if (trip.flight.trim()) {
    lines.push(`Volo o treno: ${trip.flight.trim()}`);
  }
  if (trip.waitMinutes > 0) {
    const billed = billedWaitMinutes(trip.waitMinutes);
    lines.push(
      billed > 0
        ? `Attesa: ${waitBlockLabel(billed)} a pagamento${trip.meetGreet ? " (oltre l'ora gratuita dall'atterraggio previsto)" : " (oltre 15 min, a scatti di 30)"}`
        : trip.meetGreet
          ? "Attesa extra: inclusa nell'ora gratuita dall'atterraggio previsto"
          : "Attesa: entro 15 min, inclusa",
    );
  }
  const split = priceSplit(quote.total, trip.passengers);
  lines.push(
    "",
    `Distanza: ${kmLabel(quote.km)}${quote.estimated ? " (stima)" : ""}`,
    `Durata: ${formatDuration(quote.minutes)}`,
    `A passeggero: ${euro(split.perPassenger)}`,
    `Totale: ${euro(quote.total)}`,
    `4 rate da ${euro(split.installment)} · totale a rate ${euro(split.installmentTotal)} (+5%)`,
    ...quote.lines.map((line) => `· ${line.label}: ${euro(line.amount)}`),
  );
  if (customer.notes.trim()) lines.push("", `Note: ${customer.notes.trim()}`);
  lines.push("", `Pagamento scelto: ${paymentLabel(booking.paymentMethod)}`);
  lines.push("", "Acqua inclusa. Vietato mangiare e fumare a bordo.");
  lines.push("", paymentNotice(trip.date, trip.time));
  lines.push("", "Preventivo indicativo, da confermare da MT Travel.");
  return lines.join("\n");
}

export function paymentLabel(method: PaymentMethod | undefined) {
  return PAYMENT_METHODS.find((item) => item.id === method)?.label ?? "Da scegliere";
}

export function transferCausale(booking: Booking) {
  const [year, month, day] = booking.trip.date.split("-");
  const date = day && month && year ? `${day}/${month}/${year}` : booking.trip.date;
  return `pagamento transfer ${date} ${booking.customer.firstName} ${booking.customer.lastName}`.trim();
}

export function confirmationMessage(booking: Booking, paymentLink = booking.paymentLink ?? "") {
  const { trip, customer, quote } = booking;
  const vehicle = VEHICLES[trip.vehicle];
  const split = priceSplit(quote.total, trip.passengers);
  const method = booking.paymentMethod;
  const lines = [
    `Buongiorno ${customer.firstName},`,
    "",
    `il transfer ${booking.code} è confermato.`,
    "",
    `${vehicle.name} · ${peopleLabel(trip.passengers)}`,
    `Partenza: ${trip.origin.label}`,
    `Arrivo: ${trip.destination.label}`,
    `Data: ${formatWhen(trip.date, trip.time)}`,
    trip.roundTrip ? `Ritorno: ${formatWhen(trip.returnDate, trip.returnTime)}` : "Solo andata",
    "",
  ];
  if (trip.meetGreet && trip.landingTime) {
    lines.push(
      `Attesa gratuita in aeroporto con cartello nominativo: 1 ora dall'orario di atterraggio previsto del volo (${formatWhen(trip.landingDate || trip.date, trip.landingTime)}).`,
    );
    lines.push("");
  }
  if (method === "rate") {
    lines.push(`Totale a rate: ${euro(split.installmentTotal)} (+5%)`);
    lines.push(`4 rate da ${euro(split.installment)}`);
  } else {
    lines.push(`Totale: ${euro(quote.total)}`);
  }
  lines.push("");
  if (method === "bonifico") {
    lines.push("Pagamento con bonifico.");
    lines.push(`IBAN: ${BANK.iban}`);
    lines.push(`Intestato a ${BANK.holder}`);
    lines.push(`Causale: ${transferCausale(booking)}`);
  } else {
    lines.push(`Pagamento: ${paymentLabel(method)}.`);
    lines.push(`Link: ${paymentLink.trim()}`);
  }
  lines.push("", paymentDueLine(trip.date, trip.time));
  lines.push("", "Acqua inclusa.");
  lines.push("", "MT TRAVEL SERVICE");
  lines.push("Noleggio con conducente");
  return lines.join("\n");
}

export function rejectionMessage(booking: Booking, reason: { kind: "distance"; base: string } | { kind: "unavailable" }) {
  const { trip, customer } = booking;
  const lines = [`Buongiorno ${customer.firstName},`, "", `non possiamo confermare il transfer ${booking.code}.`];
  if (reason.kind === "distance") {
    lines.push(`La tratta è troppo distante dalla nostra sede di ${reason.base.trim()}.`);
  } else {
    lines.push(`Non abbiamo disponibilità dei mezzi per la data selezionata (${formatWhen(trip.date, trip.time)}).`);
  }
  lines.push("", "MT TRAVEL SERVICE", "Noleggio con conducente");
  return lines.join("\n");
}

export function whatsappHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function whatsappTo(phone: string, text: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = `39${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailHref(booking: Booking, text: string, subject = `Richiesta NCC ${booking.code}`) {
  return `mailto:${encodeURIComponent(booking.customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

function calendarStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function atLocal(date: string, time: string, extraMinutes = 0) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "00:00").split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, (minute || 0) + extraMinutes);
}

export function googleCalendarHref(booking: Booking) {
  const { trip, quote } = booking;
  const start = atLocal(trip.date, trip.time);
  const end =
    trip.roundTrip && trip.returnDate && trip.returnTime
      ? atLocal(trip.returnDate, trip.returnTime, Math.max(quote.minutes, 45))
      : atLocal(trip.date, trip.time, Math.max(quote.minutes, 45));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Transfer NCC ${booking.code} · MT Travel`,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    details: bookingMessage(booking),
    location: trip.origin.label,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
