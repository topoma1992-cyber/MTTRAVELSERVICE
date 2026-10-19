import { useEffect, useMemo, useRef, useState } from "react";
import { PlaceInput } from "@/components/place-input";
import { mailHref, PAYMENT_METHODS, whatsappTo, type Booking, type PaymentMethod } from "@/lib/bookings";
import { updateStaffBooking } from "@/lib/bookings.functions";
import { euro, formatDuration, kmLabel, legMeasure } from "@/lib/format";
import { farFromBase, routeTrip } from "@/lib/geo";
import { buildQuote, fleetForPassengers, fleetLabel, serviceInBologna, VEHICLES, type Quote } from "@/lib/tariff";
import type { Place, RouteResult } from "@/lib/types";

const field = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base";

function money(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function moneyInput(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

function quoteWithTotal(quote: Quote, total: number): Quote {
  const kept = quote.lines.filter((line) => line.label !== "Rettifica");
  const sum = Math.round(kept.reduce((totalAmount, line) => totalAmount + line.amount, 0) * 100) / 100;
  const delta = Math.round((total - sum) * 100) / 100;
  return {
    ...quote,
    total,
    lines: Math.abs(delta) < 0.01 ? kept : [...kept, { label: "Rettifica", amount: delta, kind: "extra" }],
  };
}

export function StaffEdit({
  booking,
  staffEmail,
  pin,
  onClose,
  onSaved,
}: {
  booking: Booking;
  staffEmail: string;
  pin: string;
  onClose: () => void;
  onSaved: (booking: Booking) => void;
}) {
  const trip = booking.trip;
  const [origin, setOrigin] = useState<Place | null>(trip.origin);
  const [destination, setDestination] = useState<Place | null>(trip.destination);
  const [stops, setStops] = useState<Place[]>(trip.stops);
  const [roundTrip, setRoundTrip] = useState(trip.roundTrip);
  const [vehicleStay, setVehicleStay] = useState(Boolean(trip.vehicleStay));
  const [date, setDate] = useState(trip.date);
  const [time, setTime] = useState(trip.time);
  const [returnDate, setReturnDate] = useState(trip.returnDate);
  const [returnTime, setReturnTime] = useState(trip.returnTime);
  const [passengers, setPassengers] = useState(String(trip.passengers));
  const [luggage, setLuggage] = useState(String(trip.luggage));
  const [vehicle, setVehicle] = useState(trip.vehicle);
  const [flight, setFlight] = useState(trip.flight);
  const [meetGreet, setMeetGreet] = useState(trip.meetGreet);
  const [waitMinutes, setWaitMinutes] = useState(String(trip.waitMinutes));
  const [oversizedNote, setOversizedNote] = useState(trip.oversizedNote);
  const [firstName, setFirstName] = useState(booking.customer.firstName);
  const [lastName, setLastName] = useState(booking.customer.lastName);
  const [phone, setPhone] = useState(booking.customer.phone);
  const [email, setEmail] = useState(booking.customer.email);
  const [notes, setNotes] = useState(booking.customer.notes);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(booking.paymentMethod || "bonifico");
  const [paymentLink, setPaymentLink] = useState(booking.paymentLink);
  const [total, setTotal] = useState(moneyInput(booking.quote.total));
  const [manualTotal, setManualTotal] = useState(true);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [approachKm, setApproachKm] = useState(booking.quote.approachKm ? String(booking.quote.approachKm).replace(".", ",") : "");
  const [remote, setRemote] = useState(Boolean(booking.quote.remote));
  const [includeSlow, setIncludeSlow] = useState(
    Boolean(booking.quote.includeSlow) || booking.quote.lines.some((line) => line.kind === "slow"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ mailed: boolean; notice: string; silent: boolean } | null>(null);
  const opened = useRef(true);

  const resolvedStops = useMemo(
    () => stops.filter((stop) => stop.label.trim().length >= 2 && Number.isFinite(stop.lat) && stop.lat !== 0),
    [stops],
  );
  const stopKey = resolvedStops.map((stop) => `${stop.lat},${stop.lon}`).join(";");

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      setRouting(false);
      return;
    }
    const controller = new AbortController();
    setRouting(true);
    const going = [origin, ...resolvedStops, destination];
    const back = roundTrip ? [destination, origin] : null;
    void routeTrip(going, back, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRoute(next);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });
    return () => controller.abort();
  }, [origin, destination, stopKey, roundTrip, resolvedStops]);

  useEffect(() => {
    if (!origin || !destination) {
      setRemote(false);
      return;
    }
    const controller = new AbortController();
    void farFromBase(origin, destination, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRemote(next);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [origin, destination]);

  useEffect(() => {
    if (opened.current) {
      opened.current = false;
      return;
    }
    setManualTotal(false);
  }, [
    origin,
    destination,
    stopKey,
    roundTrip,
    date,
    time,
    returnDate,
    returnTime,
    luggage,
    passengers,
    vehicle,
    waitMinutes,
    vehicleStay,
    paymentMethod,
    meetGreet,
    approachKm,
    includeSlow,
  ]);

  const priced = useMemo(() => {
    if (!route) return null;
    const people = Math.min(16, Math.max(1, Number(passengers) || 1));
    const bags = Math.max(0, Number(luggage) || 0);
    const chosen = people > 8 ? "van" : people > VEHICLES.car.passengers || bags > VEHICLES.car.bagsIncluded ? "van" : vehicle;
    return buildQuote({
      vehicle: chosen,
      km: route.km,
      minutes: route.minutes,
      outboundKm: route.outboundKm,
      outboundMinutes: route.outboundMinutes,
      estimated: route.estimated,
      roundTrip,
      vehicleStay: roundTrip && vehicleStay,
      date,
      time,
      returnDate,
      returnTime,
      luggage: bags,
      childSeats: 0,
      boosters: 0,
      meetGreet,
      pet: false,
      waitMinutes: Math.max(0, Number(waitMinutes) || 0),
      stopCount: resolvedStops.length,
      discountCode: paymentMethod === "rate" ? "" : booking.quote.discountCode ?? "",
      waitManual: true,
      passengers: people,
      approachKm: Math.max(0, Number(approachKm.replace(",", ".")) || 0),
      remote,
      includeSlow,
      bologna: serviceInBologna([origin, destination, ...resolvedStops]),
    });
  }, [
    route,
    passengers,
    luggage,
    vehicle,
    roundTrip,
    vehicleStay,
    date,
    time,
    returnDate,
    returnTime,
    meetGreet,
    waitMinutes,
    paymentMethod,
    resolvedStops.length,
    booking.quote.discountCode,
    approachKm,
    remote,
    includeSlow,
  ]);

  useEffect(() => {
    if (!priced || manualTotal) return;
    setTotal(moneyInput(priced.total));
    if (priced.vehicle !== vehicle) setVehicle(priced.vehicle);
  }, [priced, manualTotal, vehicle]);

  async function save(notify: boolean) {
    if (!origin || !destination) {
      setError("Servono partenza e arrivo.");
      return;
    }
    const nextTotal = money(total);
    if (nextTotal <= 0) {
      setError("Il totale deve essere maggiore di zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const people = Math.min(16, Math.max(1, Number(passengers) || 1));
      const bags = Math.max(0, Number(luggage) || 0);
      const fleet = people > 8 ? fleetForPassengers(people, bags) : undefined;
      const chosen = fleet ? "van" : people > VEHICLES.car.passengers || bags > VEHICLES.car.bagsIncluded ? "van" : vehicle;
      const quote = priced
        ? Math.abs(priced.total - nextTotal) < 0.05
          ? priced
          : quoteWithTotal(priced, nextTotal)
        : quoteWithTotal({ ...booking.quote, vehicle: chosen }, nextTotal);
      const saved = await updateStaffBooking({
        data: {
          staffEmail,
          pin,
          id: booking.id,
          notify,
          pageOrigin: window.location.origin,
          paymentMethod,
          paymentLink,
          trip: {
            origin,
            destination,
            stops: resolvedStops,
            roundTrip,
            vehicleStay: roundTrip && vehicleStay,
            date,
            time,
            landingDate: meetGreet ? date : trip.landingDate,
            landingTime: meetGreet ? time : trip.landingTime,
            returnDate,
            returnTime,
            passengers: people,
            luggage: bags,
            oversized: bags > 10 || oversizedNote.trim().length > 0,
            oversizedNote,
            vehicle: chosen,
            fleet,
            childSeats: 0,
            boosters: 0,
            meetGreet,
            pet: false,
            waitMinutes: Math.max(0, Number(waitMinutes) || 0),
            flight,
          },
          customer: { firstName, lastName, phone, email, notes },
          quote,
        },
      });
      onSaved(saved.booking);
      setResult({ mailed: saved.mailed, notice: saved.notice, silent: !notify });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Non riesco a salvare.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const customer = { ...booking.customer, firstName, lastName, phone, email };
    const preview = { ...booking, customer };
    return (
      <div className="mt-4 grid gap-3 rounded-md border border-border bg-bg p-3">
        <p className="text-sm font-medium">
          {result.silent
            ? "Preventivo salvato. Il cliente non è stato avvisato."
            : result.mailed
              ? `Mail inviata a ${email}.`
              : "Modifica salvata. La mail automatica non è partita."}
        </p>
        {!result.silent && !result.mailed ? (
          <p className="text-sm text-muted">Invia tu il riepilogo al cliente. In Gestione → Avvisi serve la password dell'app di info@mttravelservice.com.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!result.silent ? (
            <>
              <a href={whatsappTo(phone, result.notice)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm">
                WhatsApp
              </a>
              <a href={mailHref(preview, result.notice, `Preventivo aggiornato ${booking.code}`)} className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm">
                Email
              </a>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center px-3 text-sm text-muted">
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium">Modifica preventivo {booking.code}</p>
      <PlaceInput label="Partenza" place={origin} onPlace={setOrigin} />
      <PlaceInput label="Arrivo" place={destination} onPlace={setDestination} />
      {stops.map((stop, index) => (
        <div key={`${stop.label}-${index}`} className="grid gap-2">
          <PlaceInput
            label={`Fermata ${index + 1}`}
            place={stop}
            onPlace={(place) =>
              setStops((current) => current.map((item, itemIndex) => (itemIndex === index ? place ?? item : item)))
            }
          />
          <button type="button" className="text-left text-sm text-muted" onClick={() => setStops((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
            Rimuovi fermata
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-left text-sm"
        onClick={() => setStops((current) => [...current, { label: "", lat: 0, lon: 0 }])}
      >
        Aggiungi fermata · + 25 €, più i chilometri
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Ora<input type="time" value={time} onChange={(event) => setTime(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Data ritorno<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Ora ritorno<input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className={field} /></label>
        <label className="flex min-h-12 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={roundTrip}
            onChange={(event) => {
              setRoundTrip(event.target.checked);
              if (!event.target.checked) setVehicleStay(false);
            }}
          />
          Andata e ritorno
        </label>
        {roundTrip ? (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={vehicleStay} onChange={(event) => setVehicleStay(event.target.checked)} />
            <span>
              Veicolo a disposizione in attesa
              <span className="mt-1 block text-muted">Un solo transfer andata e ritorno, più tutte le ore di attesa indicate.</span>
            </span>
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">Passeggeri, max 16<input inputMode="numeric" value={passengers} onChange={(event) => setPassengers(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Bagagli<input inputMode="numeric" value={luggage} onChange={(event) => setLuggage(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Veicolo
          <select value={vehicle} onChange={(event) => setVehicle(event.target.value === "van" ? "van" : "car")} className={field}>
            <option value="car">Auto</option>
            <option value="van">Van</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Attesa, minuti<input inputMode="numeric" value={waitMinutes} onChange={(event) => setWaitMinutes(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Km aggiuntivi dalla sede
          <input inputMode="decimal" value={approachKm} onChange={(event) => setApproachKm(event.target.value)} className={field} placeholder="0" />
          <span className="text-muted">Solo qui, a mano. 0,50 €/km, già nel totale. Il cliente vede il prezzo con un asterisco e non questi chilometri.</span>
        </label>
        {priced?.slow ? (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={includeSlow} onChange={(event) => setIncludeSlow(event.target.checked)} />
            <span>
              Percorrenza lenta rilevata: {priced.slow.label}. {euro(priced.slow.amount)}.
              <span className="mt-1 block text-muted">Non è nel preventivo del cliente finché non la spunti.</span>
            </span>
          </label>
        ) : null}
        <label className="grid gap-1 text-sm">Volo<input value={flight} onChange={(event) => setFlight(event.target.value)} className={field} /></label>
        <label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={meetGreet} onChange={(event) => setMeetGreet(event.target.checked)} />Meet & greet</label>
        <label className="grid gap-1 text-sm sm:col-span-2">Bagagli fuori misura<textarea value={oversizedNote} rows={2} onChange={(event) => setOversizedNote(event.target.value)} className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-3 text-base" /></label>
        <label className="grid gap-1 text-sm">Nome<input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Cognome<input value={lastName} onChange={(event) => setLastName(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Telefono<input value={phone} onChange={(event) => setPhone(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm">Email<input value={email} onChange={(event) => setEmail(event.target.value)} className={field} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Note<textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-3 text-base" /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Totale €
          <input
            inputMode="decimal"
            value={total}
            onChange={(event) => {
              setManualTotal(true);
              setTotal(event.target.value);
            }}
            className={field}
          />
          <span className="text-muted">
            {routing
              ? "Ricalcolo il percorso…"
              : priced?.legs && priced.legs.length > 1
                ? priced.legs.map((leg) => `${leg.label} ${legMeasure(leg.km, leg.minutes, priced.estimated)}`).join(" · ")
                : priced
                  ? `${kmLabel(priced.km)} · ${formatDuration(priced.minutes)}${priced.estimated ? " · stima" : ""}`
                  : "In attesa del percorso"}
          </span>
        </label>
        {priced ? (
          <div className="grid gap-1 text-sm sm:col-span-2">
            {priced.lines.map((line) => (
              <p key={line.label} className="flex justify-between gap-3 text-muted">
                <span>{line.label}</span>
                <span>{euro(line.amount)}</span>
              </p>
            ))}
            <p className="font-medium">
              Prezzo calcolato {euro(priced.total)}
              {priced.fleet ? ` · ${fleetLabel(priced.fleet)}` : ""}
            </p>
            {priced.approachAmount ? (
              <p className="text-muted">Km sede nel totale: {euro(priced.approachAmount)}. Al cliente il prezzo ha un asterisco, senza il dettaglio.</p>
            ) : null}
            {priced.remote ? (
              <p className="text-muted">Partenza e arrivo sono oltre 20 km dalla sede: il cliente vede l'asterisco e l'avviso sul vettore vicino.</p>
            ) : null}
            {manualTotal && Math.abs(priced.total - money(total)) >= 0.05 ? (
              <button type="button" className="text-left text-sm" onClick={() => { setManualTotal(false); setTotal(moneyInput(priced.total)); }}>
                Usa il prezzo calcolato
              </button>
            ) : null}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm">Pagamento
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className={field}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.id} value={method.id}>{method.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">Link di pagamento<input value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} className={field} /></label>
      </div>
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void save(true)} className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50">
          {busy ? "Salvo…" : "Salva e avvisa il cliente"}
        </button>
        <button type="button" disabled={busy} onClick={() => void save(false)} className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50">
          Salva senza avvisare
        </button>
        <button type="button" onClick={onClose} className="inline-flex h-11 items-center px-3 text-sm text-muted">Chiudi</button>
      </div>
    </div>
  );
}
