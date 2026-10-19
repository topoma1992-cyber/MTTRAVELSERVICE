import type { VehicleId } from "@/lib/types";

export const INCLUDED_WAIT_MIN = 15;

export const VEHICLES: Record<
  VehicleId,
  {
    id: VehicleId;
    name: string;
    detail: string;
    passengers: number;
    bagsIncluded: number;
    bagsMax: number;
    perKm: number;
    minimum: number;
    waitPerMin: number;
  }
> = {
  car: {
    id: "car",
    name: "Auto",
    detail: "Omoda 9",
    passengers: 4,
    bagsIncluded: 4,
    bagsMax: 4,
    perKm: 2.2,
    minimum: 45,
    waitPerMin: 50 / 60,
  },
  van: {
    id: "van",
    name: "Van",
    detail: "Mercedes Classe V",
    passengers: 8,
    bagsIncluded: 8,
    bagsMax: 30,
    perKm: 2.4,
    minimum: 50,
    waitPerMin: 1,
  },
};

export const EXTRA_PRICES = {
  meetGreet: 15,
  stop: 25,
} as const;

/** Fuori sede: non è una voce in preventivo, entra nel totale. */
export const APPROACH_PER_KM = 0.5;

export type FleetCount = { cars: number; vans: number };

/** 1–4 auto, 5–8 van, 9–11 auto+van, 12–16 due van. */
export function fleetForPassengers(passengers: number, luggage = 0): FleetCount {
  const people = Math.min(16, Math.max(1, Math.round(passengers) || 1));
  if (people <= VEHICLES.car.passengers && luggage <= VEHICLES.car.bagsIncluded) return { cars: 1, vans: 0 };
  if (people <= 8) return { cars: 0, vans: 1 };
  if (people <= 11) return { cars: 1, vans: 1 };
  return { cars: 0, vans: 2 };
}

export function fleetLabel(fleet: FleetCount) {
  if (fleet.cars > 0 && fleet.vans > 0) return fleet.vans > 1 ? `${fleet.cars} auto + ${fleet.vans} van` : "Auto + Van";
  if (fleet.vans > 1) return `${fleet.vans} van`;
  if (fleet.vans === 1) return "Van";
  return "Auto";
}

export function tripFleet(trip: {
  passengers: number;
  vehicle: VehicleId;
  luggage: number;
  fleet?: FleetCount | null;
}): FleetCount {
  if (trip.fleet && trip.fleet.cars + trip.fleet.vans > 0) return trip.fleet;
  if (trip.passengers > 8) return fleetForPassengers(trip.passengers, trip.luggage);
  if (trip.vehicle === "van" || trip.passengers > VEHICLES.car.passengers || trip.luggage > VEHICLES.car.bagsIncluded) {
    return { cars: 0, vans: 1 };
  }
  return { cars: 1, vans: 0 };
}

export function fleetText(trip: {
  passengers: number;
  vehicle: VehicleId;
  luggage: number;
  fleet?: FleetCount | null;
}) {
  const fleet = tripFleet(trip);
  if (fleet.cars + fleet.vans > 1) return fleetLabel(fleet);
  if (fleet.vans === 1) return `${VEHICLES.van.name} · ${VEHICLES.van.detail}`;
  return `${VEHICLES.car.name} · ${VEHICLES.car.detail}`;
}

const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "Capodanno",
  "2026-01-06": "Epifania",
  "2026-04-05": "Pasqua",
  "2026-04-06": "Lunedì dell'Angelo",
  "2026-04-25": "Liberazione",
  "2026-05-01": "Festa del Lavoro",
  "2026-06-02": "Festa della Repubblica",
  "2026-08-15": "Ferragosto",
  "2026-11-01": "Ognissanti",
  "2026-12-08": "Immacolata",
  "2026-12-25": "Natale",
  "2026-12-26": "Santo Stefano",
  "2027-01-01": "Capodanno",
  "2027-01-06": "Epifania",
  "2027-03-28": "Pasqua",
  "2027-03-29": "Lunedì dell'Angelo",
  "2027-04-25": "Liberazione",
  "2027-05-01": "Festa del Lavoro",
  "2027-06-02": "Festa della Repubblica",
  "2027-08-15": "Ferragosto",
  "2027-11-01": "Ognissanti",
  "2027-12-08": "Immacolata",
  "2027-12-25": "Natale",
  "2027-12-26": "Santo Stefano",
};

export type QuoteLineKind = "ride" | "night" | "holiday" | "wait" | "slow" | "meet" | "extra" | "discount";

export type QuoteLine = { label: string; amount: number; kind?: QuoteLineKind };

export type QuoteLeg = {
  label: string;
  km: number;
  minutes: number;
  amount: number;
};

export type Quote = {
  lines: QuoteLine[];
  total: number;
  km: number;
  minutes: number;
  estimated: boolean;
  night: boolean;
  holiday: string | null;
  vehicle: VehicleId;
  sameDayChoice: "wait" | "round" | null;
  appliedWait: number;
  discountCode: string | null;
  approachAmount?: number;
  /** Km dalla sede inseriti a mano in gestione. Non vanno mostrati al cliente. */
  approachKm?: number;
  /** Partenza e arrivo sono entrambi a più di 20 km dalla sede. */
  remote?: boolean;
  /** Percorrenza lenta proposta in gestione. Il cliente non la vede finché non viene inclusa. */
  slow?: { minutes: number; amount: number; label: string };
  includeSlow?: boolean;
  fleet?: FleetCount;
  /** Presente solo se andata e ritorno sono due transfer, senza attesa in mezzo. */
  legs?: QuoteLeg[];
};

export type QuoteInput = {
  vehicle: VehicleId;
  km: number;
  minutes: number;
  outboundKm: number;
  outboundMinutes: number;
  estimated: boolean;
  roundTrip: boolean;
  date: string;
  time: string;
  returnDate: string;
  returnTime: string;
  luggage: number;
  childSeats: number;
  boosters: number;
  meetGreet: boolean;
  pet: boolean;
  waitMinutes: number;
  stopCount: number;
  discountCode: string;
  /** Regole caricate dal server. Se manca, si usano i codici di base. */
  discountRules?: DiscountRule[];
  /** Il cliente ha scelto l'attesa a mano. Se è 0, non applicare l'attesa automatica. */
  waitManual?: boolean;
  /** Passeggeri. Oltre 8 il prezzo è la somma dei mezzi necessari. */
  passengers?: number;
  /** Km a vuoto da aggiungere, per ogni mezzo, senza voce separata. */
  approachKm?: number;
  remote?: boolean;
  /** Solo gestione: aggiunge la percorrenza lenta se c'è. */
  includeSlow?: boolean;
  /** Servizio interamente nel comune di Bologna: tariffa fissa, senza voce in più. */
  bologna?: boolean;
  /** Andata e ritorno con il veicolo che resta in attesa: un solo transfer, più tutte le ore scelte. */
  vehicleStay?: boolean;
  fleetPart?: boolean;
};

export type DiscountRule = {
  code: string;
  active: boolean;
  totalPercent: number;
  ridePercent: number;
  minFare: number;
  nightPercent: number;
  holidayPercent: number;
  waitPercent: number;
  meetGreetFree: boolean;
  /** Tetto dello sconto in euro. 0 = nessun tetto. */
  maxAmount: number;
  /** all = auto e van, car = solo auto, van = solo van. */
  vehicle: "all" | "car" | "van";
};

export const DEFAULT_DISCOUNTS: DiscountRule[] = [
  { code: "RICCIO5", active: true, totalPercent: 5, ridePercent: 0, minFare: 0, nightPercent: 0, holidayPercent: 0, waitPercent: 0, meetGreetFree: false, maxAmount: 0, vehicle: "all" },
  { code: "RICCIO10", active: true, totalPercent: 10, ridePercent: 0, minFare: 0, nightPercent: 0, holidayPercent: 0, waitPercent: 0, meetGreetFree: false, maxAmount: 0, vehicle: "all" },
  { code: "RICCIO15", active: true, totalPercent: 15, ridePercent: 0, minFare: 0, nightPercent: 0, holidayPercent: 0, waitPercent: 0, meetGreetFree: false, maxAmount: 0, vehicle: "all" },
  { code: "RICCIO20", active: true, totalPercent: 20, ridePercent: 0, minFare: 0, nightPercent: 0, holidayPercent: 0, waitPercent: 0, meetGreetFree: false, maxAmount: 0, vehicle: "all" },
  {
    code: "CONVENZIONE20",
    active: true,
    totalPercent: 0,
    ridePercent: 20,
    minFare: 60,
    nightPercent: 5,
    holidayPercent: 5,
    waitPercent: 5,
    meetGreetFree: true,
    maxAmount: 0,
    vehicle: "all",
  },
];

export function normalizeDiscount(value: unknown): DiscountRule | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const code = String(row.code ?? "").trim().toUpperCase();
  if (!code) return null;
  const num = (key: string, alt: string) => {
    const next = Number(row[key] ?? row[alt]);
    return Number.isFinite(next) ? next : 0;
  };
  const activeRaw = row.active;
  const active = activeRaw !== false && activeRaw !== "f" && activeRaw !== "false" && activeRaw !== 0 && activeRaw !== "0";
  if (!active) return null;
  const meet = row.meetGreetFree ?? row.meet_greet_free;
  return {
    code,
    active: true,
    totalPercent: num("totalPercent", "total_percent"),
    ridePercent: num("ridePercent", "ride_percent"),
    minFare: num("minFare", "min_fare"),
    nightPercent: num("nightPercent", "night_percent"),
    holidayPercent: num("holidayPercent", "holiday_percent"),
    waitPercent: num("waitPercent", "wait_percent"),
    meetGreetFree: meet === true || meet === "t" || meet === "true",
    maxAmount: Math.max(0, num("maxAmount", "max_discount")),
    vehicle: row.vehicle === "car" || row.vehicle === "van" ? row.vehicle : "all",
  };
}

export function findDiscount(code: string, rules: DiscountRule[] = DEFAULT_DISCOUNTS) {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  for (const rule of rules) {
    const normalized = normalizeDiscount(rule);
    if (normalized?.code === key) return normalized;
  }
  return null;
}

export function discountSummary(rule: DiscountRule) {
  const structured =
    rule.ridePercent > 0 || rule.nightPercent > 0 || rule.holidayPercent > 0 || rule.waitPercent > 0 || rule.meetGreetFree;
  if (!structured && rule.totalPercent > 0) {
    const cap = rule.maxAmount > 0 ? `, massimo ${euroLabel(rule.maxAmount)}` : "";
    const where = rule.vehicle === "car" ? " Solo auto." : rule.vehicle === "van" ? " Solo van." : "";
    return `Sconto ${rule.totalPercent}% sul totale${cap}.${where}`;
  }
  const parts: string[] = [];
  if (rule.ridePercent > 0) {
    parts.push(
      rule.minFare > 0
        ? `${rule.ridePercent}% sulla tratta oltre ${euroLabel(rule.minFare)}`
        : `${rule.ridePercent}% sulla tratta`,
    );
  }
  if (rule.nightPercent > 0) parts.push(`notturno -${rule.nightPercent}%`);
  if (rule.holidayPercent > 0) parts.push(`festivo -${rule.holidayPercent}%`);
  if (rule.meetGreetFree) parts.push("meet & greet gratuito");
  if (rule.waitPercent > 0) parts.push(`attesa -${rule.waitPercent}%`);
  if (rule.maxAmount > 0) parts.push(`massimo ${euroLabel(rule.maxAmount)}`);
  if (rule.vehicle === "car") parts.push("solo auto");
  if (rule.vehicle === "van") parts.push("solo van");
  return parts.join(" · ");
}

export function discountFits(rule: DiscountRule, fleet: FleetCount) {
  if (rule.vehicle === "car") return fleet.cars > 0;
  if (rule.vehicle === "van") return fleet.vans > 0;
  return true;
}

function euroLabel(amount: number) {
  return `${amount} €`;
}

function applyDiscount(lines: QuoteLine[], rule: DiscountRule) {
  const code = rule.code.toUpperCase();
  const start = lines.length;
  const totalPercent = Number(rule.totalPercent) || 0;
  const ridePercent = Number(rule.ridePercent) || 0;
  const nightPercent = Number(rule.nightPercent) || 0;
  const holidayPercent = Number(rule.holidayPercent) || 0;
  const waitPercent = Number(rule.waitPercent) || 0;
  const minFare = Number(rule.minFare) || 0;
  const base = lines.slice();
  if (totalPercent > 0) {
    const before = money(base.reduce((sum, line) => sum + line.amount, 0));
    const off = money((before * totalPercent) / 100);
    if (off > 0) lines.push({ label: `Sconto ${code} · ${totalPercent}%`, amount: -off, kind: "discount" });
  } else {
    const ride = money(base.filter((line) => line.kind === "ride").reduce((sum, line) => sum + line.amount, 0));
    if (ridePercent > 0 && ride > minFare) {
      const off = money((ride * ridePercent) / 100);
      if (off > 0) lines.push({ label: `Sconto ${code} · tratta ${ridePercent}%`, amount: -off, kind: "discount" });
    }
    for (const line of base) {
      if (line.kind === "night" && nightPercent > 0) {
        const off = money((line.amount * nightPercent) / 100);
        if (off > 0) lines.push({ label: `Sconto ${code} · notturno ${nightPercent}%`, amount: -off, kind: "discount" });
      }
      if (line.kind === "holiday" && holidayPercent > 0) {
        const off = money((line.amount * holidayPercent) / 100);
        if (off > 0) lines.push({ label: `Sconto ${code} · festivo ${holidayPercent}%`, amount: -off, kind: "discount" });
      }
      if ((line.kind === "wait" || line.kind === "slow") && waitPercent > 0) {
        const off = money((line.amount * waitPercent) / 100);
        if (off > 0) lines.push({ label: `Sconto ${code} · attesa ${waitPercent}%`, amount: -off, kind: "discount" });
      }
      if (line.kind === "meet" && rule.meetGreetFree && line.amount > 0) {
        lines.push({ label: `Sconto ${code} · meet & greet gratuito`, amount: -line.amount, kind: "discount" });
      }
    }
  }
  const max = Number(rule.maxAmount) || 0;
  if (max <= 0 || lines.length === start) return;
  const off = money(lines.slice(start).reduce((sum, line) => sum + Math.abs(line.amount), 0));
  if (off <= max) return;
  lines.splice(start);
  lines.push({ label: `Sconto ${code} · massimo ${euroLabel(max)}`, amount: -max, kind: "discount" });
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export const INSTALLMENT_COUNT = 4;
export const INSTALLMENT_EXTRA = 0;

export function priceSplit(total: number, passengers: number) {
  const people = Math.max(1, passengers || 1);
  const perPassenger = money(total / people);
  const installmentTotal = money(total * (1 + INSTALLMENT_EXTRA));
  const installment = money(installmentTotal / INSTALLMENT_COUNT);
  return { perPassenger, installment, installmentTotal };
}

/** 100 km in condizioni normali stanno tra 1 ora e 1 ora e mezza. Oltre, il tempo in più è attesa. */
export function slowExtraMinutes(km: number, minutes: number) {
  if (km <= 0 || minutes <= 0) return 0;
  const standard = (km / 100) * 90;
  return Math.max(0, Math.round(minutes - standard));
}

function at(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0).getTime();
}

export function gapWaitMinutes(departDate: string, departTime: string, travelMinutes: number, returnDate: string, returnTime: string) {
  if (!departDate || !departTime || !returnDate || !returnTime) return 0;
  const back = at(returnDate, returnTime);
  const arrival = at(departDate, departTime) + travelMinutes * 60 * 1000;
  if (back <= arrival) return 0;
  return Math.round((back - arrival) / 60000);
}

export function billedWaitMinutes(minutes: number) {
  if (minutes <= INCLUDED_WAIT_MIN) return 0;
  return Math.ceil(minutes / 30) * 30;
}

/** Il tempo oltre lo standard non ha i 15 minuti gratuiti: si paga dal primo scatto di 30. */
export function billedSlowMinutes(minutes: number) {
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / 30) * 30;
}

export function waitBlockLabel(minutes: number) {
  if (minutes <= 0) return "nessuna";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 ora" : `${hours} ore`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${rest} min`;
}

export function isNightTime(time: string) {
  if (!time || !time.includes(":")) return false;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return false;
  const mins = h * 60 + (m || 0);
  return mins >= 22 * 60 || mins < 6 * 60;
}

/** Comune di Bologna, contorno stretto: i comuni vicini restano fuori. */
const BOLOGNA_RING: ReadonlyArray<readonly [number, number]> = [
  [44.56, 11.3],
  [44.552, 11.365],
  [44.538, 11.41],
  [44.518, 11.432],
  [44.49, 11.415],
  [44.468, 11.398],
  [44.45, 11.378],
  [44.428, 11.345],
  [44.436, 11.3],
  [44.458, 11.282],
  [44.488, 11.276],
  [44.518, 11.246],
  [44.546, 11.268],
];

export function inBologna(lat: number, lon: number) {
  let inside = false;
  for (let i = 0, j = BOLOGNA_RING.length - 1; i < BOLOGNA_RING.length; j = i++) {
    const [yi, xi] = BOLOGNA_RING[i];
    const [yj, xj] = BOLOGNA_RING[j];
    if (xi === xj) continue;
    if ((xi > lon) !== (xj > lon) && lat < ((yj - yi) * (lon - xi)) / (xj - xi) + yi) inside = !inside;
  }
  return inside;
}

/** Vero solo se partenza, arrivo e soste sono tutti nel comune. */
export function serviceInBologna(points: Array<{ lat: number; lon: number } | null | undefined>) {
  const places = points.filter((point): point is { lat: number; lon: number } =>
    Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lon)),
  );
  return places.length >= 2 && places.every((point) => inBologna(point.lat, point.lon));
}

export function holidayOn(date: string) {
  if (!date) return null;
  if (HOLIDAYS[date]) return HOLIDAYS[date];
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  const weekday = new Date(year, month - 1, day).getDay();
  if (weekday === 0) return "Domenica";
  return null;
}

export function buildQuote(input: QuoteInput): Quote {
  if (!input.fleetPart && (input.passengers ?? 0) > 8) return combineFleet(input);
  const vehicle = VEHICLES[input.vehicle];
  const floor = vehicle.minimum;
  const cityFare = input.bologna ? (input.vehicle === "van" ? 65 : 60) : 0;
  const lines: QuoteLine[] = [];
  const outboundKm = input.outboundKm > 0 ? input.outboundKm : input.km;
  const outboundMinutes = input.outboundMinutes > 0 ? input.outboundMinutes : input.minutes;
  const backKm = Math.max(0, input.km - outboundKm);
  const backMinutes = Math.max(0, input.minutes - outboundMinutes);
  const returnKm = input.roundTrip ? (backKm > 0.5 ? backKm : outboundKm) : 0;
  const returnMinutes = input.roundTrip ? (backMinutes > 0.5 ? backMinutes : outboundMinutes) : 0;
  const differentDay =
    input.roundTrip &&
    Boolean(input.date) &&
    Boolean(input.returnDate) &&
    input.date !== input.returnDate;
  const sameDay =
    input.roundTrip &&
    !differentDay &&
    Boolean(input.date) &&
    Boolean(input.returnTime) &&
    Boolean(input.time);

  const priceLeg = (km: number) => {
    if (cityFare) return cityFare;
    const raw = money(km * vehicle.perKm);
    return raw < floor ? floor : raw;
  };
  const slowBilled = (km: number, minutes: number) => billedSlowMinutes(slowExtraMinutes(km, minutes));

  let billedKm = input.roundTrip ? outboundKm + returnKm : outboundKm;
  let ride = input.roundTrip ? money(priceLeg(outboundKm) + priceLeg(returnKm)) : cityFare || money(billedKm * vehicle.perKm);
  let rideLabel = input.roundTrip ? "Percorrenza andata e ritorno" : "Percorrenza";
  let waitSource = input.waitMinutes;
  let sameDayChoice: Quote["sameDayChoice"] = null;
  let goRide = input.roundTrip ? priceLeg(outboundKm) : ride;
  let backRide = input.roundTrip ? priceLeg(returnKm) : 0;
  let separateLegs = input.roundTrip;
  const disposal = Boolean(input.roundTrip && input.vehicleStay);

  if (disposal) {
    const roundKm = outboundKm + returnKm;
    billedKm = roundKm;
    ride = priceLeg(roundKm);
    goRide = ride;
    backRide = 0;
    rideLabel = "Transfer andata e ritorno";
    waitSource = Math.max(0, input.waitMinutes);
    sameDayChoice = null;
    separateLegs = false;
  } else if (sameDay) {
    const gap = gapWaitMinutes(input.date, input.time, outboundMinutes, input.returnDate, input.returnTime);
    const declined = input.waitManual && input.waitMinutes <= 0;
    const stay = declined ? 0 : input.waitManual && input.waitMinutes > gap ? input.waitMinutes : gap;
    if (!declined && stay > 0) {
      const oneWayRide = cityFare || money(outboundKm * vehicle.perKm);
      const oneWayWait = billedWaitMinutes(stay);
      const oneWayCost = (oneWayRide < floor ? floor : oneWayRide) + money(oneWayWait * vehicle.waitPerMin);
      const twoTransfers = priceLeg(outboundKm) + priceLeg(returnKm);
      if (oneWayCost <= twoTransfers) {
        billedKm = outboundKm;
        ride = oneWayRide;
        goRide = oneWayRide;
        backRide = 0;
        rideLabel = "Percorrenza andata";
        waitSource = stay;
        sameDayChoice = "wait";
        separateLegs = false;
      } else {
        sameDayChoice = "round";
        waitSource = 0;
      }
    } else {
      sameDayChoice = "round";
      waitSource = 0;
    }
  }

  const outboundSlowBilled = slowBilled(outboundKm, outboundMinutes);
  const returnSlowBilled = separateLegs || disposal ? slowBilled(returnKm, returnMinutes) : 0;
  const billedSlow = outboundSlowBilled + returnSlowBilled;

  if (separateLegs) {
    lines.push({ label: "Transfer andata", amount: goRide, kind: "ride" });
    lines.push({ label: "Transfer ritorno", amount: backRide, kind: "ride" });
  } else if (ride < floor) {
    ride = floor;
    lines.push({ label: "Tariffa minima", amount: floor, kind: "ride" });
  } else {
    lines.push({ label: rideLabel, amount: ride, kind: "ride" });
  }

  const outboundNight = isNightTime(input.time);
  const returnNight = input.roundTrip && isNightTime(input.returnTime);
  const night = outboundNight || returnNight;
  const holiday = holidayOn(input.date) ?? (input.roundTrip ? holidayOn(input.returnDate) : null);

  if (separateLegs) {
    let nightAmount = 0;
    let holidayAmount = 0;
    let holidayName: string | null = null;
    let nightHoliday: string | null = null;
    const addLeg = (amount: number, time: string, date: string) => {
      const day = holidayOn(date);
      if (isNightTime(time)) {
        nightAmount += amount * 0.2;
        if (day) nightHoliday = nightHoliday ?? day;
      } else if (day) {
        holidayAmount += amount * 0.2;
        holidayName = holidayName ?? day;
      }
    };
    addLeg(goRide, input.time, input.date);
    addLeg(backRide, input.returnTime, input.returnDate);
    if (nightAmount > 0) {
      lines.push({
        label: nightHoliday ? `Supplemento notturno 22–06 · ${nightHoliday}` : "Supplemento notturno 22–06",
        amount: money(nightAmount),
        kind: "night",
      });
    }
    if (holidayAmount > 0) {
      lines.push({ label: `Supplemento festivo 20% · ${holidayName}`, amount: money(holidayAmount), kind: "holiday" });
    }
  } else if (night || holiday) {
    const pct = 0.2;
    const label = night
      ? holiday
        ? `Supplemento notturno 22–06 · ${holiday}`
        : "Supplemento notturno 22–06"
      : `Supplemento festivo 20% · ${holiday}`;
    lines.push({ label, amount: money(ride * pct), kind: night ? "night" : "holiday" });
  }

  const slowText = (minutes: number) => `Tempo oltre lo standard · ${waitBlockLabel(minutes)}`;
  const slowParts: string[] = [];
  if (separateLegs) {
    if (outboundSlowBilled > 0) slowParts.push(`andata ${waitBlockLabel(outboundSlowBilled)}`);
    if (returnSlowBilled > 0) slowParts.push(`ritorno ${waitBlockLabel(returnSlowBilled)}`);
  }
  const slowAmount = money(
    (separateLegs || disposal ? outboundSlowBilled + returnSlowBilled : billedSlow) * vehicle.waitPerMin,
  );
  const slow =
    slowAmount > 0
      ? {
          minutes: separateLegs || disposal ? outboundSlowBilled + returnSlowBilled : billedSlow,
          amount: slowAmount,
          label: slowParts.length > 0 ? `Percorrenza lenta · ${slowParts.join(", ")}` : slowText(billedSlow),
        }
      : undefined;
  if (input.includeSlow && slow) {
    const addRide = (label: string | undefined, amount: number) => {
      const line = label
        ? lines.find((item) => item.kind === "ride" && item.label === label)
        : lines.find((item) => item.kind === "ride");
      if (line && amount > 0) line.amount = money(line.amount + amount);
    };
    if (separateLegs) {
      addRide("Transfer andata", money(outboundSlowBilled * vehicle.waitPerMin));
      addRide("Transfer ritorno", money(returnSlowBilled * vehicle.waitPerMin));
    } else {
      addRide(undefined, slow.amount);
    }
  }

  const billedWait = billedWaitMinutes(waitSource);
  if (billedWait > 0) {
    lines.push({
      label: disposal
        ? `Attesa a disposizione · ${waitBlockLabel(billedWait)}`
        : sameDayChoice === "wait"
          ? `Attesa tra andata e ritorno · ${waitBlockLabel(billedWait)}`
          : `Attesa · ${waitBlockLabel(billedWait)}`,
      amount: money(billedWait * vehicle.waitPerMin),
      kind: "wait",
    });
  }

  if (input.stopCount > 0) {
    lines.push({
      label: input.stopCount === 1 ? "Sosta intermedia" : `Soste intermedie · ${input.stopCount}`,
      amount: input.stopCount * EXTRA_PRICES.stop,
      kind: "extra",
    });
  }

  if (input.meetGreet) lines.push({ label: "Meet & greet", amount: EXTRA_PRICES.meetGreet, kind: "meet" });

  const code = input.discountCode.trim().toUpperCase();
  const rule = code ? findDiscount(code, input.discountRules ?? DEFAULT_DISCOUNTS) : null;
  let discountCode: string | null = null;
  const quotedFleet = { cars: input.vehicle === "car" ? 1 : 0, vans: input.vehicle === "van" ? 1 : 0 };
  if (rule && discountFits(rule, quotedFleet)) {
    applyDiscount(lines, rule);
    discountCode = code;
  }

  let approachAmount = 0;
  if (!input.fleetPart && (input.approachKm ?? 0) > 0) {
    approachAmount = money((input.approachKm ?? 0) * APPROACH_PER_KM);
    const rideLine = lines.find((line) => line.kind === "ride");
    if (rideLine && approachAmount > 0) rideLine.amount = money(rideLine.amount + approachAmount);
  }

  const total = money(Math.max(0, lines.reduce((sum, line) => sum + line.amount, 0)));
  const legs = separateLegs
    ? [
        {
          label: "Transfer andata",
          km: outboundKm,
          minutes: outboundMinutes,
          amount: lines.find((line) => line.label === "Transfer andata")?.amount ?? goRide,
        },
        {
          label: "Transfer ritorno",
          km: returnKm,
          minutes: returnMinutes,
          amount: lines.find((line) => line.label === "Transfer ritorno")?.amount ?? backRide,
        },
      ]
    : undefined;

  return {
    lines,
    total,
    km: sameDayChoice === "wait" ? billedKm : input.roundTrip ? outboundKm + returnKm : outboundKm,
    minutes: sameDayChoice === "wait" ? outboundMinutes : input.roundTrip ? outboundMinutes + returnMinutes : outboundMinutes,
    estimated: input.estimated,
    night,
    holiday: separateLegs ? holidayOn(input.date) ?? holidayOn(input.returnDate) : holiday,
    vehicle: input.vehicle,
    sameDayChoice,
    appliedWait: disposal || sameDayChoice === "wait" ? waitSource : 0,
    discountCode,
    approachAmount,
    approachKm: (input.approachKm ?? 0) > 0 ? input.approachKm : undefined,
    remote: input.remote || undefined,
    slow,
    includeSlow: input.includeSlow && slow ? true : undefined,
    legs,
  };
}

function combineFleet(input: QuoteInput): Quote {
  const fleet = fleetForPassengers(input.passengers ?? 9, input.luggage);
  const units: VehicleId[] = [
    ...Array.from({ length: fleet.cars }, () => "car" as const),
    ...Array.from({ length: fleet.vans }, () => "van" as const),
  ];
  const parts = units.map((vehicle, index) =>
    buildQuote({
      ...input,
      vehicle,
      passengers: 0,
      fleetPart: true,
      approachKm: 0,
      discountCode: "",
      luggage: 0,
      stopCount: index === 0 ? input.stopCount : 0,
      childSeats: index === 0 ? input.childSeats : 0,
      boosters: index === 0 ? input.boosters : 0,
      meetGreet: index === 0 ? input.meetGreet : false,
      pet: index === 0 ? input.pet : false,
    }),
  );
  const lines: QuoteLine[] = [];
  for (const part of parts) {
    for (const line of part.lines) {
      const found = lines.find((item) => item.label === line.label && item.kind === line.kind);
      if (found) found.amount = money(found.amount + line.amount);
      else lines.push({ ...line });
    }
  }
  const code = input.discountCode.trim().toUpperCase();
  const rule = code ? findDiscount(code, input.discountRules ?? DEFAULT_DISCOUNTS) : null;
  let discountCode: string | null = null;
  if (rule && (rule.vehicle === "car" || rule.vehicle === "van")) {
    if (discountFits(rule, fleet)) {
      const scoped: QuoteLine[] = [];
      parts.forEach((part, index) => {
        if (units[index] !== rule.vehicle) return;
        for (const line of part.lines) {
          const found = scoped.find((item) => item.label === line.label && item.kind === line.kind);
          if (found) found.amount = money(found.amount + line.amount);
          else scoped.push({ ...line });
        }
      });
      const before = scoped.length;
      applyDiscount(scoped, rule);
      for (const line of scoped.slice(before)) lines.push({ ...line });
      discountCode = code;
    }
  } else if (rule) {
    applyDiscount(lines, rule);
    discountCode = code;
  }
  const approachAmount = money((input.approachKm ?? 0) * APPROACH_PER_KM * (fleet.cars + fleet.vans));
  if (approachAmount > 0) {
    const rideLine = lines.find((line) => line.kind === "ride");
    if (rideLine) rideLine.amount = money(rideLine.amount + approachAmount);
  }
  const base = parts[0];
  const slowAmount = money(parts.reduce((sum, part) => sum + (part.slow?.amount ?? 0), 0));
  const slow =
    slowAmount > 0
      ? {
          minutes: base.slow?.minutes ?? 0,
          amount: slowAmount,
          label: base.slow?.label ?? "Percorrenza lenta",
        }
      : undefined;
  const legs = base.legs?.map((leg) => {
    const line = lines.find((item) => item.label === leg.label);
    return line ? { ...leg, amount: line.amount } : leg;
  });
  return {
    ...base,
    lines,
    total: money(Math.max(0, lines.reduce((sum, line) => sum + line.amount, 0))),
    vehicle: fleet.vans > 0 ? "van" : "car",
    night: parts.some((part) => part.night),
    holiday: parts.find((part) => part.holiday)?.holiday ?? null,
    discountCode,
    approachAmount,
    approachKm: (input.approachKm ?? 0) > 0 ? input.approachKm : undefined,
    remote: input.remote || undefined,
    slow,
    includeSlow: input.includeSlow && slow ? true : undefined,
    fleet,
    legs,
  };
}
