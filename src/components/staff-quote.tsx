import { useEffect, useState } from "react";
import { PlaceInput } from "@/components/place-input";
import { MapHost } from "@/components/map-host";
import { createStaffQuote } from "@/lib/bookings.functions";
import { makeBookingCode, PAYMENT_METHODS, type Booking, type PaymentMethod } from "@/lib/bookings";
import { euro, formatDuration, kmLabel } from "@/lib/format";
import { reversePlace, routeTrip } from "@/lib/geo";
import { downloadBookingPdf } from "@/lib/pdf";
import { buildQuote, VEHICLES, type Quote } from "@/lib/tariff";
import type { Place, RouteResult, VehicleId } from "@/lib/types";

const field = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base";

function chosenVehicle(values: FormState): VehicleId {
  if (values.vehicle === "van" || values.vehicle === "car") return values.vehicle;
  const people = Number(values.passengers) || 1;
  const bags = Number(values.luggage) || 0;
  return people > 3 || bags > 4 ? "van" : "car";
}

function moneyInput(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

function parseMoney(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function draftBooking(values: FormState, origin: Place | null, destination: Place | null, priced: Quote | null): Booking {
  const vehicle = chosenVehicle(values);
  const total = parseMoney(values.total);
  const method: PaymentMethod = values.paymentMethod || "bonifico";
  const same = priced && Math.abs(priced.total - total) < 0.05;
  return {
    id: "bozza",
    code: values.code || makeBookingCode(),
    createdAt: new Date().toISOString(),
    status: "pending",
    paymentMethod: method,
    paymentLink: "",
    trip: {
      origin: origin ?? { label: "—", lat: 0, lon: 0 },
      destination: destination ?? { label: "—", lat: 0, lon: 0 },
      stops: [],
      roundTrip: values.roundTrip,
      date: values.date,
      time: values.time,
      landingDate: "",
      landingTime: "",
      returnDate: values.returnDate,
      returnTime: values.returnTime,
      passengers: Math.max(1, Number(values.passengers) || 1),
      luggage: Math.max(0, Number(values.luggage) || 0),
      oversized: Number(values.luggage) > 10 || values.oversizedNote.trim().length > 0,
      oversizedNote: values.oversizedNote.trim(),
      vehicle,
      childSeats: 0,
      boosters: 0,
      meetGreet: false,
      pet: false,
      waitMinutes: 0,
      flight: values.flight.trim(),
    },
    customer: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      notes: values.notes.trim(),
    },
    quote: same
      ? priced
      : {
          lines: total > 0 ? [{ label: "Totale", amount: total }] : [],
          total,
          km: priced?.km ?? 0,
          minutes: priced?.minutes ?? 0,
          estimated: priced?.estimated ?? true,
          night: false,
          holiday: null,
          vehicle,
          sameDayChoice: null,
          discountCode: null,
        },
  };
}

type FormState = {
  code: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  returnDate: string;
  returnTime: string;
  roundTrip: boolean;
  passengers: string;
  luggage: string;
  oversizedNote: string;
  vehicle: string;
  flight: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  total: string;
  paymentMethod: PaymentMethod | "";
};

const empty: FormState = {
  code: "",
  origin: "",
  destination: "",
  date: "",
  time: "",
  returnDate: "",
  returnTime: "",
  roundTrip: false,
  passengers: "",
  luggage: "",
  oversizedNote: "",
  vehicle: "",
  flight: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
  total: "",
  paymentMethod: "",
};

export function StaffQuote({
  pin,
  onSaved,
}: {
  pin: string;
  onSaved: (booking: Booking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormState>(empty);
  const [originPlace, setOriginPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [priced, setPriced] = useState<Quote | null>(null);
  const [routing, setRouting] = useState(false);
  const [manual, setManual] = useState(false);
  const [mapTarget, setMapTarget] = useState<"origin" | "destination" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const luggage = Number(values.luggage) || 0;
  const vehicle = chosenVehicle(values);

  useEffect(() => {
    if (!originPlace || !destinationPlace) {
      setRoute(null);
      setRouting(false);
      return;
    }
    const controller = new AbortController();
    setRouting(true);
    const back = values.roundTrip ? [destinationPlace, originPlace] : null;
    void routeTrip([originPlace, destinationPlace], back, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRoute(next);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setRoute(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });
    return () => controller.abort();
  }, [originPlace, destinationPlace, values.roundTrip]);

  useEffect(() => {
    setManual(false);
  }, [
    originPlace,
    destinationPlace,
    values.roundTrip,
    values.date,
    values.time,
    values.returnDate,
    values.returnTime,
    values.luggage,
    values.passengers,
    values.vehicle,
  ]);

  useEffect(() => {
    if (!route) {
      setPriced(null);
      return;
    }
    const next = buildQuote({
      vehicle,
      km: route.km,
      minutes: route.minutes,
      outboundKm: route.outboundKm,
      outboundMinutes: route.outboundMinutes,
      estimated: route.estimated,
      roundTrip: values.roundTrip,
      date: values.date,
      time: values.time,
      returnDate: values.returnDate,
      returnTime: values.returnTime,
      luggage,
      childSeats: 0,
      boosters: 0,
      meetGreet: false,
      pet: false,
      waitMinutes: 0,
      stopCount: 0,
      discountCode: "",
    });
    setPriced(next);
    if (!manual) {
      setValues((current) => ({ ...current, total: moneyInput(next.total) }));
    }
  }, [
    route,
    vehicle,
    luggage,
    manual,
    values.roundTrip,
    values.date,
    values.time,
    values.returnDate,
    values.returnTime,
  ]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      const booking = await createStaffQuote({
        data: {
          pin,
          origin: originPlace?.label ?? "",
          destination: destinationPlace?.label ?? "",
          originLat: originPlace?.lat ?? 0,
          originLon: originPlace?.lon ?? 0,
          destinationLat: destinationPlace?.lat ?? 0,
          destinationLon: destinationPlace?.lon ?? 0,
          date: values.date,
          time: values.time,
          returnDate: values.returnDate,
          returnTime: values.returnTime,
          roundTrip: values.roundTrip,
          passengers: Number(values.passengers) || 0,
          luggage,
          oversizedNote: values.oversizedNote,
          vehicle,
          flight: values.flight,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          email: values.email,
          notes: values.notes,
          total: parseMoney(values.total),
          km: priced?.km ?? 0,
          minutes: priced?.minutes ?? 0,
          estimated: priced?.estimated ?? false,
          lines:
            priced && Math.abs(priced.total - parseMoney(values.total)) < 0.05
              ? priced.lines
              : parseMoney(values.total) > 0
                ? [{ label: "Totale", amount: parseMoney(values.total) }]
                : [],
          paymentMethod: values.paymentMethod,
        },
      });
      onSaved(booking);
      setValues(empty);
      setOriginPlace(null);
      setDestinationPlace(null);
      setPriced(null);
      setManual(false);
      setFormKey((current) => current + 1);
      setMapTarget(null);
      setOpen(false);
    } catch {
      setError("Non riesco a salvare il preventivo. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Nuovo preventivo</h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          {open ? "Chiudi" : "Crea"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Partenza e arrivo calcolano il prezzo. La cifra resta modificabile, nessun campo è obbligatorio.
      </p>
      {open ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative h-56 overflow-hidden rounded-lg border border-border sm:col-span-2">
              <MapHost
                data={{
                  pins: [
                    ...(originPlace ? [{ ...originPlace, kind: "a" as const }] : []),
                    ...(destinationPlace ? [{ ...destinationPlace, kind: "b" as const }] : []),
                  ],
                  line: route?.line ?? [],
                }}
                picking={Boolean(mapTarget)}
                onPick={
                  mapTarget
                    ? (lat, lon) => {
                        const target = mapTarget;
                        setMapTarget(null);
                        void reversePlace(lat, lon).then((found) => {
                          if (target === "origin") setOriginPlace(found);
                          else setDestinationPlace(found);
                        });
                      }
                    : undefined
                }
              />
              <p className="pointer-events-none absolute bottom-8 left-3 max-w-xs rounded-md bg-surface/95 px-3 py-2 text-sm text-muted">
                {mapTarget ? "Tocca la mappa per fissare il punto." : "Puoi cercare l'indirizzo o toccare Sulla mappa."}
              </p>
            </div>
            <PlaceInput
              key={`${formKey}-from`}
              label="Partenza"
              place={originPlace}
              onPlace={setOriginPlace}
              presets
              mapActive={mapTarget === "origin"}
              onMapRequest={() => setMapTarget((current) => (current === "origin" ? null : "origin"))}
            />
            <PlaceInput
              key={`${formKey}-to`}
              label="Arrivo"
              place={destinationPlace}
              onPlace={setDestinationPlace}
              presets
              mapActive={mapTarget === "destination"}
              onMapRequest={() => setMapTarget((current) => (current === "destination" ? null : "destination"))}
            />
            <label className="grid gap-1 text-sm">
              Data
              <input type="date" value={values.date} onChange={(event) => set("date", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm">
              Ora
              <input type="time" value={values.time} onChange={(event) => set("time", event.target.value)} className={field} />
            </label>
            <label className="flex min-h-12 items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={values.roundTrip}
                onChange={(event) => set("roundTrip", event.target.checked)}
              />
              Andata e ritorno
            </label>
            {values.roundTrip ? (
              <>
                <label className="grid gap-1 text-sm">
                  Data ritorno
                  <input
                    type="date"
                    value={values.returnDate}
                    onChange={(event) => set("returnDate", event.target.value)}
                    className={field}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Ora ritorno
                  <input
                    type="time"
                    value={values.returnTime}
                    onChange={(event) => set("returnTime", event.target.value)}
                    className={field}
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-1 text-sm">
              Passeggeri
              <input
                inputMode="numeric"
                value={values.passengers}
                onChange={(event) => set("passengers", event.target.value)}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Bagagli standard
              <input
                inputMode="numeric"
                value={values.luggage}
                onChange={(event) => set("luggage", event.target.value)}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Veicolo
              <select value={values.vehicle} onChange={(event) => set("vehicle", event.target.value)} className={field}>
                <option value="">Non indicato</option>
                <option value="car">{VEHICLES.car.name}</option>
                <option value="van">{VEHICLES.van.name}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Volo
              <input value={values.flight} onChange={(event) => set("flight", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Bagagli fuori misura / altro
              <textarea
                value={values.oversizedNote}
                rows={2}
                onChange={(event) => set("oversizedNote", event.target.value)}
                className="min-h-20 w-full rounded-md border border-border bg-bg px-3 py-3 text-base"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Nome
              <input value={values.firstName} onChange={(event) => set("firstName", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm">
              Cognome
              <input value={values.lastName} onChange={(event) => set("lastName", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm">
              Telefono
              <input value={values.phone} onChange={(event) => set("phone", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm">
              Email
              <input value={values.email} onChange={(event) => set("email", event.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Prezzo</span>
              <input
                inputMode="decimal"
                value={values.total}
                placeholder={routing ? "Calcolo…" : "Si compila dal percorso"}
                onChange={(event) => {
                  setManual(true);
                  set("total", event.target.value);
                }}
                className={`${field} font-display text-2xl`}
              />
              <span className="text-sm text-muted">
                {routing
                  ? "Calcolo il percorso…"
                  : priced
                    ? `${kmLabel(priced.km)} · ${formatDuration(priced.minutes)}${priced.estimated ? " · stima" : ""} · ${VEHICLES[vehicle].name}. Puoi cambiare la cifra.`
                    : "Scegli partenza e arrivo: il prezzo compare qui e puoi modificarlo."}
              </span>
              {priced ? (
                <span className="grid gap-1">
                  {priced.lines.map((line) => (
                    <span key={line.label} className="flex justify-between gap-3 text-sm text-muted">
                      <span>{line.label}</span>
                      <span className="tabular-nums">{euro(line.amount)}</span>
                    </span>
                  ))}
                  {manual ? (
                    <button
                      type="button"
                      onClick={() => {
                        setManual(false);
                        set("total", moneyInput(priced.total));
                      }}
                      className="mt-1 self-start text-sm text-primary"
                    >
                      Rimetti {euro(priced.total)}
                    </button>
                  ) : null}
                </span>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              Pagamento
              <select
                value={values.paymentMethod}
                onChange={(event) => set("paymentMethod", event.target.value as PaymentMethod | "")}
                className={field}
              >
                <option value="">Non indicato</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Note
              <textarea
                value={values.notes}
                rows={2}
                onChange={(event) => set("notes", event.target.value)}
                className="min-h-20 w-full rounded-md border border-border bg-bg px-3 py-3 text-base"
              />
            </label>
          </div>
          {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50"
            >
              {busy ? "Salvo…" : "Salva in richieste"}
            </button>
            <button
              type="button"
              onClick={() => {
                void downloadBookingPdf(draftBooking(values, originPlace, destinationPlace, priced)).catch(() =>
                  setError("Non riesco a creare il PDF."),
                );
              }}
              className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium"
            >
              Scarica PDF
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
