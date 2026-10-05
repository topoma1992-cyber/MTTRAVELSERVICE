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
    passengers: 3,
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
  childSeat: 10,
  booster: 8,
  meetGreet: 15,
  pet: 12,
  extraBag: 5,
  stop: 12,
} as const;

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

export type QuoteLine = { label: string; amount: number };

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
  discountCode: string | null;
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
};

function money(n: number) {
  return Math.round(n * 100) / 100;
}

export const INSTALLMENT_COUNT = 4;
export const INSTALLMENT_EXTRA = 0.05;

export function priceSplit(total: number, passengers: number) {
  const people = Math.max(1, passengers || 1);
  const perPassenger = money(total / people);
  const installmentTotal = money(total * (1 + INSTALLMENT_EXTRA));
  const installment = money(installmentTotal / INSTALLMENT_COUNT);
  return { perPassenger, installment, installmentTotal };
}

export const DISCOUNT_CODES: Record<string, number> = {
  RICCIO5: 0.05,
  RICCIO10: 0.1,
  RICCIO15: 0.15,
  RICCIO20: 0.2,
};

export function discountRate(code: string) {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  return DISCOUNT_CODES[key] ?? null;
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

export function holidayOn(date: string) {
  if (!date) return null;
  return HOLIDAYS[date] ?? null;
}

export function buildQuote(input: QuoteInput): Quote {
  const vehicle = VEHICLES[input.vehicle];
  const floor = vehicle.minimum;
  const lines: QuoteLine[] = [];
  const outboundKm = input.outboundKm > 0 ? input.outboundKm : input.km;
  const outboundMinutes = input.outboundMinutes > 0 ? input.outboundMinutes : input.minutes;
  const backKm = Math.max(0, input.km - outboundKm);
  const backMinutes = Math.max(0, input.minutes - outboundMinutes);
  const slowMinutes =
    slowExtraMinutes(outboundKm, outboundMinutes) + (input.roundTrip ? slowExtraMinutes(backKm, backMinutes) : 0);
  const billedSlow = billedWaitMinutes(slowMinutes);
  const sameDay =
    input.roundTrip &&
    Boolean(input.date) &&
    input.date === input.returnDate &&
    Boolean(input.returnTime) &&
    Boolean(input.time);

  let billedKm = input.km;
  let ride = money(billedKm * vehicle.perKm);
  let rideLabel = input.roundTrip ? "Percorrenza andata e ritorno" : "Percorrenza";
  let waitSource = input.waitMinutes;
  let sameDayChoice: Quote["sameDayChoice"] = null;

  if (sameDay) {
    const gap = gapWaitMinutes(input.date, input.time, outboundMinutes, input.returnDate, input.returnTime);
    const oneWayKm = outboundKm;
    const oneWayRide = money(oneWayKm * vehicle.perKm);
    const roundRide = money(input.km * vehicle.perKm);
    const oneWayWait = billedWaitMinutes(gap + input.waitMinutes);
    const roundWait = billedWaitMinutes(input.waitMinutes);
    const charged = (amount: number) => (amount < floor ? floor : amount);
    const oneWayCost = charged(oneWayRide) + money(oneWayWait * vehicle.waitPerMin);
    const roundCost = charged(roundRide) + money(roundWait * vehicle.waitPerMin);
    if (oneWayCost <= roundCost) {
      billedKm = oneWayKm;
      ride = oneWayRide;
      rideLabel = "Percorrenza andata";
      waitSource = gap + input.waitMinutes;
      sameDayChoice = "wait";
    } else {
      sameDayChoice = "round";
    }
  }

  if (ride < floor) {
    ride = floor;
    lines.push({ label: "Tariffa minima", amount: floor });
  } else {
    lines.push({ label: rideLabel, amount: ride });
  }

  const outboundNight = isNightTime(input.time);
  const returnNight = input.roundTrip && isNightTime(input.returnTime);
  const night = outboundNight || returnNight;
  const holiday = holidayOn(input.date) ?? (input.roundTrip ? holidayOn(input.returnDate) : null);

  if (night || holiday) {
    const pct = night ? 0.2 : 0.15;
    const label = night ? "Supplemento notturno 22–06" : `Supplemento festivo · ${holiday}`;
    lines.push({ label, amount: money(ride * pct) });
  }

  if (billedSlow > 0) {
    lines.push({
      label: `Percorrenza lenta · ${waitBlockLabel(billedSlow)}`,
      amount: money(billedSlow * vehicle.waitPerMin),
    });
  }

  const billedWait = billedWaitMinutes(waitSource);
  if (billedWait > 0) {
    lines.push({
      label: sameDayChoice === "wait" ? `Attesa tra andata e ritorno · ${waitBlockLabel(billedWait)}` : `Attesa · ${waitBlockLabel(billedWait)}`,
      amount: money(billedWait * vehicle.waitPerMin),
    });
  }

  if (input.stopCount > 0) {
    lines.push({
      label: input.stopCount === 1 ? "Sosta intermedia" : `Soste intermedie · ${input.stopCount}`,
      amount: input.stopCount * EXTRA_PRICES.stop,
    });
  }

  const extraBags = Math.max(0, input.luggage - vehicle.bagsIncluded);
  if (extraBags > 0) {
    lines.push({
      label: extraBags === 1 ? "Bagaglio extra" : `Bagagli extra · ${extraBags}`,
      amount: extraBags * EXTRA_PRICES.extraBag,
    });
  }

  if (input.childSeats > 0) {
    lines.push({
      label: input.childSeats === 1 ? "Seggiolino" : `Seggiolini · ${input.childSeats}`,
      amount: input.childSeats * EXTRA_PRICES.childSeat,
    });
  }

  if (input.boosters > 0) {
    lines.push({
      label: input.boosters === 1 ? "Alzatina" : `Alzatine · ${input.boosters}`,
      amount: input.boosters * EXTRA_PRICES.booster,
    });
  }

  if (input.meetGreet) lines.push({ label: "Meet & greet", amount: EXTRA_PRICES.meetGreet });
  if (input.pet) lines.push({ label: "Animale in auto", amount: EXTRA_PRICES.pet });

  const code = input.discountCode.trim().toUpperCase();
  const rate = code ? discountRate(code) : null;
  let discountCode: string | null = null;
  if (rate) {
    const before = money(lines.reduce((sum, line) => sum + line.amount, 0));
    const off = money(before * rate);
    if (off > 0) {
      lines.push({ label: `Sconto ${code} · ${Math.round(rate * 100)}%`, amount: -off });
      discountCode = code;
    }
  }

  const total = money(Math.max(0, lines.reduce((sum, line) => sum + line.amount, 0)));

  return {
    lines,
    total,
    km: sameDayChoice === "wait" ? billedKm : input.km,
    minutes: input.minutes,
    estimated: input.estimated,
    night,
    holiday,
    vehicle: input.vehicle,
    sameDayChoice,
    discountCode,
  };
}
