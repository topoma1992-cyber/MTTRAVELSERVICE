import { useEffect, useState } from "react";
import { PlaceInput } from "@/components/place-input";
import { getPublicBooking, lookupDiscount, updatePublicBooking } from "@/lib/bookings.functions";
import { paymentLabel, type Booking } from "@/lib/bookings";
import { customerPrice, customerCanEdit, formatWhen, peopleLabel, priceMarked, REMOTE_NOTICE } from "@/lib/format";
import { farFromBase, routeTrip } from "@/lib/geo";
import { buildQuote, findDiscount, fleetForPassengers, fleetLabel, normalizeDiscount, serviceInBologna, tripFleet, VEHICLES } from "@/lib/tariff";
import type { Place } from "@/lib/types";

const field = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base";

export function CustomerRequest({ token }: { token: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [luggage, setLuggage] = useState("0");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    const openEdit = new URLSearchParams(window.location.search).get("modifica") === "1";
    void getPublicBooking({ data: { token } })
      .then((row) => {
        if (!alive) return;
        setBooking(row);
        fill(row);
        if (openEdit && customerCanEdit(row.trip.date, row.trip.time)) setEditing(true);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  function fill(row: Booking) {
    setOrigin(row.trip.origin);
    setDestination(row.trip.destination);
    setDate(row.trip.date);
    setTime(row.trip.time);
    setReturnDate(row.trip.returnDate);
    setReturnTime(row.trip.returnTime);
    setPassengers(String(row.trip.passengers));
    setLuggage(String(row.trip.luggage));
    setFirstName(row.customer.firstName);
    setLastName(row.customer.lastName);
    setPhone(row.customer.phone);
    setEmail(row.customer.email);
    setNotes(row.customer.notes);
  }

  async function save() {
    if (!booking || !origin || !destination) {
      setError("Servono partenza e arrivo.");
      return;
    }
    if (!customerCanEdit(booking.trip.date, booking.trip.time)) {
      setEditing(false);
      setError("La modifica è possibile solo fino a 48 ore prima del viaggio.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const people = Math.min(16, Math.max(1, Number(passengers) || 1));
      const bags = Math.max(0, Number(luggage) || 0);
      const fleet = people > 8 ? fleetForPassengers(people, bags) : undefined;
      const forced = fleet ? "van" : people > VEHICLES.car.passengers || bags > VEHICLES.car.bagsIncluded ? "van" : booking.trip.vehicle;
      const back = booking.trip.roundTrip ? [destination, origin] : null;
      const [route, remote] = await Promise.all([
        routeTrip([origin, ...booking.trip.stops, destination], back, new AbortController().signal),
        farFromBase(origin, destination),
      ]);
      const code = booking.quote.discountCode ?? "";
      const found = code
        ? normalizeDiscount(await lookupDiscount({ data: { code } }).catch(() => findDiscount(code)))
        : null;
      const quote = buildQuote({
        vehicle: forced,
        km: route.km,
        minutes: route.minutes,
        outboundKm: route.outboundKm,
        outboundMinutes: route.outboundMinutes,
        estimated: route.estimated,
        roundTrip: booking.trip.roundTrip,
        date,
        time,
        returnDate,
        returnTime,
        luggage: bags,
        childSeats: 0,
        boosters: 0,
        meetGreet: booking.trip.meetGreet,
        pet: false,
        waitMinutes: booking.trip.waitMinutes,
        stopCount: booking.trip.stops.length,
        discountCode: booking.paymentMethod === "rate" ? "" : found?.code ?? "",
        discountRules: booking.paymentMethod === "rate" || !found ? [] : [found],
        passengers: people,
        approachKm: booking.quote.approachKm ?? 0,
        remote,
        includeSlow: Boolean(booking.quote.includeSlow) || booking.quote.lines.some((line) => line.kind === "slow"),
        bologna: serviceInBologna([origin, destination, ...booking.trip.stops]),
        vehicleStay: Boolean(booking.trip.roundTrip && booking.trip.vehicleStay),
      });
      const next = await updatePublicBooking({
        data: {
          token,
          pageOrigin: window.location.origin,
          paymentMethod: booking.paymentMethod,
          quote,
          customer: { firstName, lastName, phone, email, notes },
          trip: {
            ...booking.trip,
            origin,
            destination,
            date,
            time,
            returnDate,
            returnTime,
            passengers: people,
            luggage: bags,
            vehicle: forced,
            fleet,
            childSeats: 0,
            boosters: 0,
            pet: false,
          },
        },
      });
      setBooking(next);
      setEditing(false);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Modifica non salvata.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <h1 className="text-center text-2xl">Richiesta non trovata</h1>
        <p className="mt-2 text-muted">Il link non è più valido.</p>
      </main>
    );
  }
  if (!booking) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <p className="text-muted">Carico la richiesta…</p>
      </main>
    );
  }

  const canEdit = customerCanEdit(booking.trip.date, booking.trip.time);
  const confirmed = booking.status === "confirmed" && !saved;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <p className="text-sm text-primary">{booking.code}</p>
      <h1 className="mt-1 text-center text-2xl">La tua richiesta</h1>
      <p className="mt-2 text-muted">
        {confirmed ? "Confermata da MT TRAVEL SERVICE." : "In attesa di conferma. Non paghi ora."}
      </p>
      {saved ? (
        <p className="mt-3 text-sm font-medium text-primary">
          Modifica salvata. La richiesta è di nuovo da confermare.
        </p>
      ) : null}

      {editing && canEdit ? (
        <div className="mt-6 grid gap-3">
          <PlaceInput label="Partenza" place={origin} onPlace={setOrigin} presets />
          <PlaceInput label="Arrivo" place={destination} onPlace={setDestination} presets />
          <label className="grid gap-1 text-sm">
            Data
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Ora
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={field} />
          </label>
          {booking.trip.roundTrip ? (
            <>
              <label className="grid gap-1 text-sm">
                Data ritorno
                <input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className={field} />
              </label>
              <label className="grid gap-1 text-sm">
                Ora ritorno
                <input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className={field} />
              </label>
            </>
          ) : null}
          <label className="grid gap-1 text-sm">
            Passeggeri
            <input value={passengers} inputMode="numeric" onChange={(event) => setPassengers(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Bagagli standard
            <input value={luggage} inputMode="numeric" onChange={(event) => setLuggage(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Nome
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Cognome
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Telefono
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            Note
            <textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} className="min-h-24 w-full rounded-md border border-border bg-bg px-3 py-3 text-base" />
          </label>
          {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex h-12 items-center rounded-md bg-primary px-4 font-medium text-primary-fg disabled:opacity-50">
              {busy ? "Salvo…" : "Salva modifica"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex h-12 items-center rounded-md border border-border px-4">
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <article className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p>{booking.trip.origin.label}</p>
          <p className="text-muted">verso {booking.trip.destination.label}</p>
          <p className="mt-3">{formatWhen(booking.trip.date, booking.trip.time)}</p>
          <p className="mt-1 text-sm text-muted">
            {fleetLabel(tripFleet(booking.trip))} · {peopleLabel(booking.trip.passengers)} · {paymentLabel(booking.paymentMethod)}
          </p>
          <p className="mt-3 text-center text-2xl font-semibold tabular-nums">{customerPrice(booking.quote.total, priceMarked(booking.quote))}</p>
          {booking.quote.remote ? <p className="mt-2 text-sm text-muted">{REMOTE_NOTICE}</p> : null}
          <p className="mt-3">
            {booking.customer.firstName} {booking.customer.lastName}
          </p>
          <p className="text-sm text-muted">{booking.customer.phone} · {booking.customer.email}</p>
          {canEdit ? (
            <button type="button" onClick={() => setEditing(true)} className="mt-5 inline-flex h-12 items-center rounded-md bg-primary px-4 font-medium text-primary-fg">
              Modifica
            </button>
          ) : (
            <p className="mt-5 text-sm text-muted">
              La modifica online è possibile solo fino a 48 ore prima del viaggio. Dopo, chiama o scrivi a MT TRAVEL SERVICE.
            </p>
          )}
        </article>
      )}
    </main>
  );
}
