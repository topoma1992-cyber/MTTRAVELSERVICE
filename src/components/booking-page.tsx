import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BusFront,
  Car,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Minus,
  Plane,
  Plus,
  Trash2,
} from "lucide-react";
import { PlaceInput } from "@/components/place-input";
import { MapHost } from "@/components/map-host";
import { QuoteDetails, PriceSummary } from "@/components/quote-details";
import { RequestActions } from "@/components/request-actions";
import {
  bookingMessage,
  mailHref,
  whatsappHref,
  type Booking,
  type PaymentMethod,
} from "@/lib/bookings";
import { addClock, bagsLabel, customerCanEdit, customerPrice, euro, formatWhen, peopleLabel, priceMarked, toISODate, validEmail, validPhone } from "@/lib/format";
import { farFromBase, reversePlace, routeTrip } from "@/lib/geo";
import { submitBooking } from "@/lib/bookings.functions";
import { useI18n } from "@/lib/i18n";
import { listPublicDiscounts, lookupDiscount } from "@/lib/bookings.functions";
import { EXTRA_PRICES, VEHICLES, billedWaitMinutes, buildQuote, discountFits, discountSummary, findDiscount, fleetForPassengers, fleetLabel, gapWaitMinutes, normalizeDiscount, priceSplit, serviceInBologna, tripFleet, waitBlockLabel, DEFAULT_DISCOUNTS, type DiscountRule } from "@/lib/tariff";
import type { MapData, Place, RouteResult, VehicleId } from "@/lib/types";

function focusInvalid() {
  window.requestAnimationFrame(() => {
    const visible = [...document.querySelectorAll("[data-invalid='true']")].find(
      (node) => node instanceof HTMLElement && node.getClientRects().length > 0,
    );
    visible?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

const control = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base text-fg";

type StopRow = { id: string; place: Place | null; dirty: boolean };

type Errors = Partial<Record<string, string>>;

function Qty({
  label,
  value,
  min,
  max,
  onDelta,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onDelta: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Diminuisci ${label}`}
        disabled={value <= min}
        onClick={() => onDelta(-1)}
        className="grid size-11 place-items-center rounded-md border border-border bg-bg disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="w-8 text-center text-lg tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`Aumenta ${label}`}
        disabled={value >= max}
        onClick={() => onDelta(1)}
        className="grid size-11 place-items-center rounded-md border border-border bg-bg disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function clampCount(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tomorrowDefaults() {
  const now = new Date();
  const today = toISODate(now);
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return { today, date: toISODate(next), time: "09:00", returnTime: "18:00" };
}

export function BookingPage() {
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [mapTarget, setMapTarget] = useState<string | null>(null);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [originDirty, setOriginDirty] = useState(false);
  const [destinationDirty, setDestinationDirty] = useState(false);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [roundTrip, setRoundTrip] = useState(false);
  const [vehicleStay, setVehicleStay] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [today, setToday] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(1);
  const [oversized, setOversized] = useState(false);
  const [oversizedNote, setOversizedNote] = useState("");
  const [vehicle, setVehicle] = useState<VehicleId>("car");
  const [meetGreet, setMeetGreet] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [waitManual, setWaitManual] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountCatalog, setDiscountCatalog] = useState<DiscountRule[]>(DEFAULT_DISCOUNTS);
  const [flight, setFlight] = useState("");
  const [notes, setNotes] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const scalapay = paymentMethod === "rate";
  const discountRule = scalapay ? null : findDiscount(discountCode, discountCatalog);
  const [privacy, setPrivacy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [remote, setRemote] = useState(false);
  const [sent, setSent] = useState<(Booking & { viewUrl?: string; editUrl?: string; mailed?: boolean }) | null>(null);
  const [copied, setCopied] = useState(false);

  const onOriginDirty = useCallback((dirty: boolean) => setOriginDirty(dirty), []);
  const onDestinationDirty = useCallback((dirty: boolean) => setDestinationDirty(dirty), []);

  useEffect(() => {
    const next = tomorrowDefaults();
    setToday(next.today);
    setDate(next.date);
    setTime(next.time);
    setReturnDate(next.date);
    setReturnTime(next.returnTime);
  }, []);

  useEffect(() => {
    if (passengers > VEHICLES.car.passengers && vehicle === "car") setVehicle("van");
  }, [passengers, vehicle]);

  useEffect(() => {
    if (luggage > VEHICLES.van.bagsMax) setLuggage(VEHICLES.van.bagsMax);
  }, [luggage]);

  useEffect(() => {
    const car = VEHICLES.car;
    if ((luggage > car.bagsIncluded || passengers > car.passengers) && vehicle === "car") {
      setVehicle("van");
    }
  }, [luggage, passengers, vehicle]);

  const resolvedStops = useMemo(
    () => stops.map((stop) => stop.place).filter((place): place is Place => Boolean(place)),
    [stops],
  );

  const routeKey = useMemo(() => {
    if (!origin || !destination) return "";
    const going = [origin, ...resolvedStops, destination].map((place) => `${place.lat},${place.lon}`).join(";");
    return `${going}|${roundTrip ? "r" : "o"}`;
  }, [origin, destination, resolvedStops, roundTrip]);

  useEffect(() => {
    if (!origin || !destination || !routeKey) {
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
        if (!controller.signal.aborted) setRoute(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });
    return () => controller.abort();
  }, [routeKey, origin, destination, resolvedStops, roundTrip]);

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
        if (!controller.signal.aborted) setRemote(false);
      });
    return () => controller.abort();
  }, [origin, destination]);

  const serviceDate = date;
  const serviceTime = time;

  const quote = useMemo(() => {
    if (!route) return null;
    return buildQuote({
      vehicle,
      km: roundTrip ? route.km : route.outboundKm || route.km,
      minutes: roundTrip ? route.minutes : route.outboundMinutes || route.minutes,
      outboundKm: route.outboundKm || route.km,
      outboundMinutes: route.outboundMinutes || route.minutes,
      estimated: route.estimated,
      roundTrip,
      date: serviceDate,
      time: serviceTime,
      returnDate,
      returnTime,
      luggage,
      childSeats: 0,
      boosters: 0,
      meetGreet,
      pet: false,
      waitMinutes,
      waitManual,
      vehicleStay: roundTrip && vehicleStay,
      stopCount: resolvedStops.length,
      discountCode: scalapay ? "" : discountCode,
      discountRules: discountCatalog,
      passengers,
      remote,
      bologna: serviceInBologna([origin, destination, ...resolvedStops]),
    });
  }, [
    route,
    vehicle,
    roundTrip,
    serviceDate,
    serviceTime,
    returnDate,
    returnTime,
    luggage,
    meetGreet,
    waitMinutes,
    waitManual,
    vehicleStay,
    discountCode,
    discountCatalog,
    scalapay,
    resolvedStops.length,
    passengers,
    remote,
  ]);

  const selectedWait = vehicleStay
    ? waitMinutes
    : !roundTrip || waitManual
      ? waitMinutes
      : quote?.sameDayChoice === "wait"
        ? quote.appliedWait
        : 0;

  useEffect(() => {
    let alive = true;
    void listPublicDiscounts()
      .then((rows) => {
        if (!alive || rows.length === 0) return;
        const next = rows.map((row) => normalizeDiscount(row)).filter((row): row is DiscountRule => Boolean(row));
        if (next.length > 0) setDiscountCatalog(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const code = discountCode.trim().toUpperCase();
    if (code.length < 3) return;
    let alive = true;
    void lookupDiscount({ data: { code } })
      .then((found) => {
        const rule = normalizeDiscount(found);
        if (!alive || !rule) return;
        setDiscountCatalog((current) => {
          const rest = current.filter((item) => item.code !== rule.code);
          return [...rest, rule];
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [discountCode]);

  useEffect(() => {
    if (!waitManual || quote?.sameDayChoice !== "wait" || !roundTrip || !route) return;
    if (!serviceDate || !serviceTime || !returnDate || !returnTime || serviceDate !== returnDate) return;
    const gap = gapWaitMinutes(serviceDate, serviceTime, route.outboundMinutes, returnDate, returnTime);
    if (waitMinutes <= gap + 1) return;
    const next = addClock(serviceDate, serviceTime, Math.round(route.outboundMinutes) + waitMinutes);
    if (next.date === returnDate && next.time === returnTime) return;
    setReturnDate(next.date);
    setReturnTime(next.time);
  }, [waitManual, waitMinutes, quote, roundTrip, route, serviceDate, serviceTime, returnDate, returnTime]);

  const mapData = useMemo<MapData>(() => {
    const pins: MapData["pins"] = [];
    if (origin) pins.push({ ...origin, kind: "a" });
    for (const stop of resolvedStops) pins.push({ ...stop, kind: "s" });
    if (destination) pins.push({ ...destination, kind: "b" });
    return { pins, line: route?.line ?? [] };
  }, [origin, destination, resolvedStops, route]);

  function validate(): Errors {
    const next: Errors = {};
    const convenzione = discountRule?.code === "CONVENZIONE20";
    if (!origin) next.origin = originDirty ? "Seleziona un risultato dall'elenco." : "Indica la partenza.";
    if (!destination) {
      next.destination = destinationDirty ? "Seleziona un risultato dall'elenco." : "Indica l'arrivo.";
    }
    if (
      origin &&
      destination &&
      origin.lat === destination.lat &&
      origin.lon === destination.lon
    ) {
      next.destination = "L'arrivo coincide con la partenza.";
    }
    if (stops.some((stop) => stop.dirty && !stop.place)) {
      next.stops = "Seleziona ogni fermata dall'elenco, oppure rimuovila.";
    }
    if (!route) next.route = "Attendi il calcolo del percorso prima di inviare.";
    if (convenzione) {
      if (discountCode.trim() && !scalapay && !discountRule) next.discount = "Codice sconto non valido.";
      return next;
    }
    if (!date) next.date = "Indica la data.";
    if (!time) next.time = "Indica l'orario.";
    if (date && time) {
      const when = new Date(`${date}T${time}`);
      if (Number.isNaN(when.getTime())) next.date = "Data non valida.";
      else if (when.getTime() < Date.now() - 5 * 60 * 1000) next.date = "Scegli un orario da adesso in poi.";
    }
    if (meetGreet && flight.trim().length < 2) next.flight = "Indica il numero del volo.";
    if (roundTrip) {
      if (!returnDate || !returnTime) next.returnDate = "Indica data e ora del ritorno.";
      else if (date && time) {
        const outbound = new Date(`${serviceDate}T${serviceTime}`).getTime();
        const inbound = new Date(`${returnDate}T${returnTime}`).getTime();
        if (inbound <= outbound) next.returnDate = "Il ritorno deve essere dopo l'andata.";
      }
    }
    if (passengers > 16) next.vehicle = "Massimo 16 passeggeri.";
    else if (passengers <= 8 && (passengers > VEHICLES[vehicle].passengers || luggage > VEHICLES[vehicle].bagsMax)) {
      next.vehicle = "Questo veicolo non basta per passeggeri o bagagli.";
    }
    if ((luggage > 10 || oversized) && oversizedNote.trim().length < 3) {
      next.oversized = "Descrivi i bagagli fuori misura.";
    }
    if (firstName.trim().length < 2) next.firstName = "Scrivi il nome.";
    if (lastName.trim().length < 2) next.lastName = "Scrivi il cognome.";
    if (discountCode.trim() && !scalapay && !discountRule) next.discount = "Codice sconto non valido.";
    if (!validPhone(phone)) next.phone = "Inserisci un telefono valido, anche con prefisso.";
    if (!validEmail(email)) next.email = "Inserisci una email valida.";
    if (!paymentMethod) next.payment = "Scegli come vuoi pagare.";
    if (!privacy && discountRule?.code !== "CONVENZIONE20") next.privacy = t("privacyNeed");
    if (!terms && discountRule?.code !== "CONVENZIONE20") next.terms = t("termsNeed");
    return next;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!origin || !destination || !quote || !route) {
      const next = validate();
      setErrors(next);
      focusInvalid();
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusInvalid();
      return;
    }
    if (!paymentMethod && discountRule?.code !== "CONVENZIONE20") return;
    setSending(true);
    setSendError("");
    try {
      const booking = await submitBooking({
        data: {
          trip: {
            origin,
            destination,
            stops: resolvedStops,
            roundTrip,
            vehicleStay: roundTrip && vehicleStay,
            date,
            time,
            landingDate: meetGreet ? date : "",
            landingTime: meetGreet ? time : "",
            returnDate: roundTrip ? returnDate : "",
            returnTime: roundTrip ? returnTime : "",
            passengers,
            luggage,
            oversized: luggage > 10 || oversized,
            oversizedNote: luggage > 10 || oversized ? oversizedNote.trim() : "",
            vehicle: passengers > 8 ? "van" : vehicle,
            fleet: passengers > 8 ? fleetForPassengers(passengers, luggage) : undefined,
            childSeats: 0,
            boosters: 0,
            meetGreet,
            pet: false,
            waitMinutes: selectedWait,
            flight: flight.trim(),
          },
          customer: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            notes: notes.trim(),
          },
          paymentMethod: paymentMethod || ("" as PaymentMethod),
          quote,
          pageOrigin: window.location.origin,
        },
      });
      setSent(booking);
      setCopied(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Invio non riuscito. Riprova.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    const next = tomorrowDefaults();
    setSent(null);
    setOrigin(null);
    setDestination(null);
    setStops([]);
    setRoundTrip(false);
    setDate(next.date);
    setTime(next.time);
    setReturnDate(next.date);
    setReturnTime(next.returnTime);
    setToday(next.today);
    setPassengers(1);
    setLuggage(1);
    setOversized(false);
    setOversizedNote("");
    setVehicle("car");
    setMeetGreet(false);
    setWaitMinutes(0);
    setFlight("");
    setDiscountCode("");
    setNotes("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setPaymentMethod("");
    setPrivacy(false);
    setErrors({});
    setRoute(null);
    setFormKey((value) => value + 1);
    setCopied(false);
  }

  async function pickFromMap(lat: number, lon: number) {
    const target =
      mapTarget ?? (!origin ? "origin" : !destination ? "destination" : "destination");
    const rough = { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
    setMapTarget(null);
    if (target === "origin") setOrigin(rough);
    else if (target === "destination") setDestination(rough);
    else if (target.startsWith("stop:")) {
      const id = target.slice(5);
      setStops((rows) => rows.map((row) => (row.id === id ? { ...row, place: rough, dirty: false } : row)));
    }
    const found = await reversePlace(lat, lon);
    if (target === "origin") setOrigin(found);
    else if (target === "destination") setDestination(found);
    else if (target.startsWith("stop:")) {
      const id = target.slice(5);
      setStops((rows) => rows.map((row) => (row.id === id ? { ...row, place: found, dirty: false } : row)));
    }
  }

  async function copyMessage(booking: Booking) {
    const text = bookingMessage(booking);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const vehicleSpec = VEHICLES[vehicle];

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5 lg:py-10">
      <div className="quote-rail order-1 flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:order-2 lg:col-span-2 lg:self-start lg:overflow-y-auto">
        <div className="relative order-1 h-64 shrink-0 overflow-hidden rounded-lg border border-border lg:h-72">
          <MapHost
            data={mapData}
            picking={Boolean(mapTarget)}
            scrollSignal={mapTarget ?? ""}
            onPick={(lat, lon) => void pickFromMap(lat, lon)}
          />
        </div>
        <div className="order-2 price-hero lg:hidden">
          <p className="text-center text-sm text-muted">A passeggero</p>
          <p className="text-center text-2xl font-semibold tabular-nums">
            {quote ? customerPrice(priceSplit(quote.total, passengers).perPassenger, priceMarked(quote)) : "—"}
          </p>
          {quote ? <p className="text-center text-sm text-muted">Totale {customerPrice(quote.total, priceMarked(quote))}</p> : null}
          {quote?.remote ? <p className="mt-1 text-center text-sm text-muted">{t("remoteNotice")}</p> : null}
        </div>
        <div className="order-3 hidden lg:order-2 lg:block">
          <QuoteDetails
            quote={quote}
            passengers={passengers}
            routing={routing}
            paymentMethod={paymentMethod}
            onPayment={setPaymentMethod}
            paymentError={errors.payment}
            paymentName="payment-desk"
          />
          {sent ? null : (
            <button
              type="submit"
              form="booking-form"
              disabled={routing || sending}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50"
            >
              {sending ? t("sending") : routing ? t("routing") : t("send")}
            </button>
          )}
        </div>
      </div>

      <div className="order-2 min-w-0 lg:order-1 lg:col-span-3">
        {sent ? (
          <Confirmation booking={sent} copied={copied} onCopy={() => void copyMessage(sent)} onReset={reset} />
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-primary">{t("kicker")}</p>
              <h1 className="mx-auto mt-1 max-w-md text-2xl">{t("title")}</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{t("lead")}</p>
            </div>
            <form id="booking-form" className="mt-6 grid gap-4" onSubmit={onSubmit} noValidate>
              <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 className="mb-4 text-center text-lg">{t("trip")}</h2>
                <div className="grid gap-4">
                  <PlaceInput
                    key={`${formKey}-origin`}
                    label={t("from")}
                    place={origin}
                    onPlace={setOrigin}
                    onIncomplete={onOriginDirty}
                    error={errors.origin}
                    presets
                    locate
                    mapActive={mapTarget === "origin"}
                    onMapRequest={() => setMapTarget((current) => (current === "origin" ? null : "origin"))}
                  />
                  <PlaceInput
                    key={`${formKey}-destination`}
                    label={t("to")}
                    place={destination}
                    onPlace={setDestination}
                    onIncomplete={onDestinationDirty}
                    error={errors.destination}
                    presets
                    mapActive={mapTarget === "destination"}
                    onMapRequest={() => setMapTarget((current) => (current === "destination" ? null : "destination"))}
                  />
                  {stops.map((stop, index) => (
                    <div key={stop.id} className="grid gap-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <PlaceInput
                            label={`Fermata ${index + 1}`}
                            place={stop.place}
                            onPlace={(place) =>
                              setStops((rows) => rows.map((row) => (row.id === stop.id ? { ...row, place } : row)))
                            }
                            onIncomplete={(dirty) =>
                              setStops((rows) => rows.map((row) => (row.id === stop.id ? { ...row, dirty } : row)))
                            }
                            placeholder="Sosta intermedia"
                            mapActive={mapTarget === `stop:${stop.id}`}
                            onMapRequest={() =>
                              setMapTarget((current) => (current === `stop:${stop.id}` ? null : `stop:${stop.id}`))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={`Rimuovi fermata ${index + 1}`}
                          onClick={() => setStops((rows) => rows.filter((row) => row.id !== stop.id))}
                          className="mt-7 grid size-11 shrink-0 place-items-center rounded-md border border-border"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {errors.stops ? (
                    <p className="text-sm font-medium text-primary" data-invalid="true">
                      {errors.stops}
                    </p>
                  ) : null}
                  {stops.length < 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setStops((rows) => [...rows, { id: crypto.randomUUID(), place: null, dirty: false }])
                      }
                      className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-primary"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Aggiungi una fermata
                      <span className="text-muted">+ {euro(EXTRA_PRICES.stop)}, più i chilometri</span>
                    </button>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2">
                    <div>
                      <p className="font-medium">{t("round")}</p>
                      <p className="text-sm text-muted">{t("roundHint")}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={roundTrip}
                      onClick={() =>
                        setRoundTrip((value) => {
                          if (value) {
                            setVehicleStay(false);
                            if (!waitManual) setWaitMinutes(0);
                          }
                          if (!value) setWaitManual(false);
                          return !value;
                        })
                      }
                      className={`relative h-7 w-12 rounded-full ${roundTrip ? "bg-primary" : "bg-surface-2"}`}
                    >
                      <span
                        className={`absolute top-1 size-5 rounded-full bg-fg ${roundTrip ? "left-6" : "left-1"}`}
                      />
                      <span className="sr-only">Andata e ritorno</span>
                    </button>
                  </div>
                  {roundTrip ? (
                    <label className="flex items-start gap-3 rounded-md border border-border bg-bg px-3 py-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={vehicleStay}
                        onChange={(event) => setVehicleStay(event.target.checked)}
                      />
                      <span>
                        <span className="block font-medium">{t("stay")}</span>
                        <span className="mt-1 block text-sm text-muted">{t("stayHint")}</span>
                      </span>
                    </label>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2" data-invalid={errors.date ? "true" : undefined}>
                      <span className="text-sm font-medium">{t("date")}</span>
                      <input
                        type="date"
                        required
                        min={today || undefined}
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className={control}
                      />
                    </label>
                    <label className="grid gap-2" data-invalid={errors.time ? "true" : undefined}>
                      <span className="text-sm font-medium">{meetGreet ? t("landing") : t("time")}</span>
                      <input
                        type="time"
                        required
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        className={control}
                      />
                    </label>
                  </div>
                  {errors.date || errors.time ? (
                    <p className="text-sm font-medium text-primary">{errors.date || errors.time}</p>
                  ) : null}
                  {roundTrip ? (
                    <div className="grid gap-3 sm:grid-cols-2" data-invalid={errors.returnDate ? "true" : undefined}>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">{t("returnDate")}</span>
                        <input
                          type="date"
                          min={date || today || undefined}
                          value={returnDate}
                          onChange={(event) => setReturnDate(event.target.value)}
                          className={control}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">{t("returnTime")}</span>
                        <input
                          type="time"
                          value={returnTime}
                          onChange={(event) => setReturnTime(event.target.value)}
                          className={control}
                        />
                      </label>
                      {errors.returnDate ? (
                        <p className="text-sm font-medium text-primary sm:col-span-2">{errors.returnDate}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="grid gap-2" data-invalid={errors.flight ? "true" : undefined}>
                    <span className="text-sm font-medium">{meetGreet ? t("flight") : t("flightOptional")}</span>
                    <input
                      value={flight}
                      maxLength={40}
                      placeholder={meetGreet ? t("flightPh") : t("flightOptPh")}
                      onChange={(event) => setFlight(event.target.value)}
                      className={control}
                    />
                    {errors.flight ? <p className="text-sm font-medium text-primary">{errors.flight}</p> : null}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">{t("wait")}</span>
                    <select
                      value={String(selectedWait)}
                      onChange={(event) => {
                        setWaitManual(true);
                        setWaitMinutes(Number(event.target.value));
                      }}
                      className={control}
                    >
                      <option value="0">{t("waitNone")}</option>
                      {selectedWait > 0 ? (
                        <option value={String(selectedWait)}>
                          Attesa prevista · {waitBlockLabel(billedWaitMinutes(selectedWait) || selectedWait)}
                        </option>
                      ) : null}
                      {[30, 60, 90, 120, 180, 240, 300, 360, 480]
                        .filter((minutes) => minutes !== selectedWait)
                        .map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes < 60
                              ? `${minutes} min · a pagamento`
                              : minutes % 60 === 0
                                ? `${minutes / 60 === 1 ? "1 ora" : `${minutes / 60} ore`} · a pagamento`
                                : `${Math.floor(minutes / 60) === 1 ? "1 ora" : `${Math.floor(minutes / 60)} ore`} e ${minutes % 60} min · a pagamento`}
                          </option>
                        ))}
                    </select>
                    <span className="text-sm text-muted">{meetGreet ? t("waitMeet") : t("waitNormal")}</span>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 className="mb-4 text-center text-lg">{t("vehicle")}</h2>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{t("passengers")}</span>
                      <Qty
                        label="passeggeri"
                        value={passengers}
                        min={1}
                        max={16}
                        onDelta={(delta) => setPassengers((current) => clampCount(current + delta, 1, 16))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{t("bags")}</span>
                        <Qty
                          label={t("bags")}
                          value={luggage}
                          min={0}
                          max={VEHICLES.van.bagsMax}
                          onDelta={(delta) =>
                            setLuggage((current) => clampCount(current + delta, 0, VEHICLES.van.bagsMax))
                          }
                        />
                      </div>
                      <p className="text-sm text-muted">{t("bagsVan")}</p>
                    </div>
                  </div>
                  {passengers > 8 ? (
                    <p className="text-sm text-muted">{t("over8")}</p>
                  ) : passengers > VEHICLES.car.passengers ? (
                    <p className="text-sm text-muted">{t("over3")}</p>
                  ) : null}
                  {luggage > VEHICLES.car.bagsIncluded ? <p className="text-sm text-muted">{t("over4")}</p> : null}
                  <div className="grid gap-2" data-invalid={errors.oversized ? "true" : undefined}>
                    <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={luggage > 10 || oversized}
                        disabled={luggage > 10}
                        onChange={(event) => setOversized(event.target.checked)}
                      />
                      {t("oversized")}
                    </label>
                    {luggage > 10 || oversized ? (
                      <textarea
                        value={oversizedNote}
                        required={luggage > 10}
                        maxLength={400}
                        rows={3}
                        placeholder={t("oversizedPh")}
                        onChange={(event) => setOversizedNote(event.target.value)}
                        className="min-h-24 w-full rounded-md border border-border bg-bg px-3 py-3 text-base text-fg placeholder:text-muted"
                      />
                    ) : null}
                    {luggage > 10 ? <p className="text-sm text-muted">{t("oversizedNeed")}</p> : null}
                    {errors.oversized ? <p className="text-sm font-medium text-primary">{errors.oversized}</p> : null}
                  </div>
                  {passengers > 8 ? (
                    <p className="rounded-md border border-border bg-bg px-3 py-3 text-sm">
                      {fleetLabel(fleetForPassengers(passengers, luggage))}. Il prezzo è la somma dei mezzi, calcolati uno per uno.
                    </p>
                  ) : (
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Veicolo" data-invalid={errors.vehicle ? "true" : undefined}>
                    {(Object.values(VEHICLES) as (typeof VEHICLES)[VehicleId][]).map((option) => {
                      const selected = vehicle === option.id;
                      const blocked = passengers > option.passengers || luggage > option.bagsMax;
                      const Icon = option.id === "car" ? Car : BusFront;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={blocked}
                          onClick={() => setVehicle(option.id)}
                          className={`rounded-xl border p-4 text-left transition disabled:opacity-40 ${
                            selected ? "border-primary bg-surface-2" : "border-border bg-bg"
                          }`}
                        >
                          <img
                            src={option.id === "car" ? "/brand/auto.png" : "/brand/van.png"}
                            alt=""
                            className="fleet-shot"
                          />
                          <span className="mt-3 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-2">
                              <Icon className="size-5 text-primary" aria-hidden="true" />
                              <span className="text-lg font-semibold">{option.name}</span>
                            </span>
                            {selected ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
                          </span>
                          <span className="mt-1 block text-sm text-muted">
                            {option.detail} · max {option.passengers} passeggeri
                          </span>
                          <span className="mt-2 block text-sm tabular-nums">
                            {euro(option.perKm)} / km · minimo {euro(option.minimum)} · attesa {euro(option.waitPerMin * 60)}/h
                          </span>
                          <span className="mt-1 block text-sm text-muted">
                            {option.bagsIncluded} {t("bags").toLowerCase()} {t("included")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  )}
                  {errors.vehicle ? <p className="text-sm font-medium text-primary">{errors.vehicle}</p> : null}

                  <Toggle
                    pressed={meetGreet}
                    onClick={() => setMeetGreet((value) => !value)}
                    icon={<Plane className="size-4" aria-hidden="true" />}
                    label="Meet & greet"
                    hint={t("meetHint")}
                    price={euro(EXTRA_PRICES.meetGreet)}
                  />
                  <p className="text-sm text-muted">{t("rules")}</p>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
                <h2 className="mb-4 text-center text-lg">{t("who")}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("name")} error={errors.firstName}>
                    <input
                      value={firstName}
                      autoComplete="given-name"
                      onChange={(event) => setFirstName(event.target.value)}
                      className={control}
                    />
                  </Field>
                  <Field label={t("surname")} error={errors.lastName}>
                    <input
                      value={lastName}
                      autoComplete="family-name"
                      onChange={(event) => setLastName(event.target.value)}
                      className={control}
                    />
                  </Field>
                  <Field label="Telefono" error={errors.phone}>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+39"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={control}
                    />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={control}
                    />
                  </Field>
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-sm font-medium">{t("notes")}</span>
                    <textarea
                      value={notes}
                      maxLength={500}
                      rows={3}
                      placeholder={t("notesPh")}
                      onChange={(event) => setNotes(event.target.value)}
                      className="min-h-28 w-full rounded-md border border-border bg-bg px-3 py-3 text-base text-fg placeholder:text-muted"
                    />
                  </label>
                  <label className="grid gap-2 sm:col-span-2" data-invalid={errors.discount ? "true" : undefined}>
                    <span className="text-sm font-medium">{t("discount")}</span>
                    <input
                      value={discountCode}
                      maxLength={20}
                      autoCapitalize="characters"
                      placeholder={t("discountPh")}
                      disabled={scalapay}
                      onChange={(event) => setDiscountCode(event.target.value)}
                      className={control}
                    />
                    {scalapay ? (
                      <span className="text-sm text-muted">Con Scalapay i codici sconto non si applicano.</span>
                    ) : null}
                    {errors.discount ? <p className="text-sm font-medium text-primary">{errors.discount}</p> : null}
                    {discountRule ? (
                      <span className="text-sm text-muted">
                        {discountSummary(discountRule)}
                        {discountFits(
                          discountRule,
                          passengers > 8
                            ? fleetForPassengers(passengers, luggage)
                            : { cars: vehicle === "car" ? 1 : 0, vans: vehicle === "van" ? 1 : 0 },
                        )
                          ? ""
                          : " Non si applica a questo veicolo."}
                      </span>
                    ) : null}
                  </label>
                </div>
              </section>

              <div className="lg:hidden">
                <QuoteDetails
                  quote={quote}
                  passengers={passengers}
                  routing={routing}
                  paymentMethod={paymentMethod}
                  onPayment={setPaymentMethod}
                  paymentError={errors.payment}
                  paymentName="payment-mobile"
                />
              </div>
              <label className="flex items-start gap-3 text-sm" data-invalid={errors.privacy ? "true" : undefined}>
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={privacy}
                  onChange={(event) => setPrivacy(event.target.checked)}
                />
                <span>
                  {t("privacyConsent")}{" "}
                  <Link to="/privacy" className="underline underline-offset-2">
                    {t("privacy")}
                  </Link>
                </span>
              </label>
              {errors.privacy ? <p className="text-sm font-medium text-primary">{errors.privacy}</p> : null}
              <label className="flex items-start gap-3 text-sm" data-invalid={errors.terms ? "true" : undefined}>
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={terms}
                  onChange={(event) => setTerms(event.target.checked)}
                />
                <span>
                  {t("termsConsent")}{" "}
                  <a
                    href="https://www.mttravelservice.com/termini-e-condizioni"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {t("terms")}
                  </a>
                </span>
              </label>
              {errors.terms ? <p className="text-sm font-medium text-primary">{errors.terms}</p> : null}
              {errors.route ? (
                <p className="text-sm font-medium text-primary" data-invalid="true">
                  {errors.route}
                </p>
              ) : null}
              {sendError ? <p className="text-sm font-medium text-primary">{sendError}</p> : null}
              <button
                type="submit"
                disabled={routing || sending}
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50 lg:hidden"
              >
                {sending ? t("sending") : routing ? t("routing") : t("send")}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2" data-invalid={error ? "true" : undefined}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-sm font-medium text-primary">{error}</span> : null}
    </label>
  );
}

function Toggle({
  pressed,
  onClick,
  icon,
  label,
  hint,
  price,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
  price: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-3 text-left ${
        pressed ? "border-primary bg-surface-2" : "border-border bg-bg"
      }`}
    >
      <span className="text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <span className="tabular-nums text-sm">{price}</span>
    </button>
  );
}

function appLink(url: string) {
  if (typeof window === "undefined") return url;
  try {
    const next = new URL(url, window.location.origin);
    const host = next.hostname.toLowerCase();
    if (host === "vercel.app" || host.endsWith(".vercel.app") || host.endsWith(".vercel.com")) {
      return `${window.location.origin}${next.pathname}${next.search}`;
    }
    return next.toString();
  } catch {
    return url;
  }
}

function Confirmation({
  booking,
  copied,
  onCopy,
  onReset,
}: {
  booking: Booking & { viewUrl?: string; editUrl?: string; mailed?: boolean };
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const text = bookingMessage(booking);
  const { trip, customer, quote } = booking;
  return (
    <article className="rounded-lg border border-border bg-surface p-4 sm:p-6">
      <p className="text-sm text-primary">{t("ready")}</p>
      <h1 className="mt-1 text-center text-2xl">{booking.code}</h1>
      <p className="mt-2 text-muted">
        {customer.firstName} {customer.lastName} · {formatWhen(trip.date, trip.time)}
      </p>
      <div className="mt-5 grid gap-2 border-t border-dashed border-border pt-5 text-sm">
        <p>
          <span className="text-muted">Da </span>
          {trip.origin.label}
        </p>
        {trip.stops.map((stop) => (
          <p key={`${stop.lat}-${stop.label}`}>
            <span className="text-muted">Fermata </span>
            {stop.label}
          </p>
        ))}
        <p>
          <span className="text-muted">A </span>
          {trip.destination.label}
        </p>
        <p>
          {fleetLabel(tripFleet(trip))} · {peopleLabel(trip.passengers)} · {bagsLabel(trip.luggage)} standard
          {trip.roundTrip ? " · A/R" : ""}
        </p>
        {trip.oversizedNote?.trim() ? (
          <p>
            <span className="text-muted">Fuori misura </span>
            {trip.oversizedNote}
          </p>
        ) : null}
        {trip.landingTime ? (
          <p>
            <span className="text-muted">Atterraggio </span>
            {formatWhen(trip.landingDate || trip.date, trip.landingTime)}
          </p>
        ) : null}
        <div className="pt-2">
          <PriceSummary total={quote.total} passengers={trip.passengers} marked={priceMarked(quote)} />
        </div>
        {quote.remote ? <p className="text-sm text-muted">{t("remoteNotice")}</p> : null}
      </div>
      <p className="mt-4 text-sm text-muted">
        {booking.mailed
          ? `Conferma inviata a ${customer.email}. Dal link puoi rivedere la richiesta o modificarla.`
          : `Richiesta registrata. Conserva il link: da lì la rivedi o la modifichi. La mail automatica parte quando in Gestione è attiva la posta.`}
      </p>
      {booking.viewUrl ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={appLink(booking.viewUrl)} className="inline-flex h-12 items-center rounded-md border border-border px-4 font-medium">
            Vedi la richiesta
          </a>
          {customerCanEdit(trip.date, trip.time) ? (
            <a href={appLink(booking.editUrl || booking.viewUrl)} className="inline-flex h-12 items-center rounded-md bg-primary px-4 font-medium text-primary-fg">
              Modifica
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={whatsappHref(text)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-fg"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </a>
        <a
          href={mailHref(booking, text)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-4 font-medium"
        >
          <Mail className="size-4" aria-hidden="true" />
          Email
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-4 font-medium"
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copiato" : "Copia testo"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-medium"
        >
          Nuova richiesta
        </button>
        <RequestActions booking={booking} />
      </div>
    </article>
  );
}
