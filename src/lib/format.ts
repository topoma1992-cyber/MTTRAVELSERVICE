export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function euro(amount: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function customerPrice(amount: number, marked = false) {
  return `${euro(amount)}${marked ? "*" : ""}`;
}

export function priceMarked(quote: { approachAmount?: number; approachKm?: number; remote?: boolean } | null | undefined) {
  return (quote?.approachAmount ?? 0) > 0 || (quote?.approachKm ?? 0) > 0 || quote?.remote === true;
}

export const REMOTE_NOTICE =
  "Il transfer è distante dalla nostra sede. MT TRAVEL SERVICE si impegna a trovare un vettore NCC vicino a voi per garantirvi la tariffa mostrata.";

export function kmLabel(km: number) {
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(km);
  return `${formatted} km`;
}

export function formatDuration(minutes: number) {
  const total = Math.max(1, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${total} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function legMeasure(km: number, minutes: number, estimated = false) {
  return `${kmLabel(km)} · ${formatDuration(minutes)}${estimated ? " (stima)" : ""}`;
}

export function tripStartMs(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  if (!y || !m || !d) return Number.NaN;
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0));
  const zoned = new Date(utcGuess.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  return utcGuess.getTime() + (utcGuess.getTime() - zoned.getTime());
}

export function customerCanEdit(date: string, time: string, now = Date.now()) {
  const start = tripStartMs(date, time);
  if (!Number.isFinite(start)) return false;
  return now <= start - 48 * 60 * 60 * 1000;
}

export function formatWhen(date: string, time: string) {
  if (!date) return time;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  const label = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dt);
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return time ? `${pretty} · ${time}` : pretty;
}

export function validPhone(value: string) {
  const trimmed = value.trim();
  if (!/^[+0-9\s()./-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function peopleLabel(count: number) {
  return `${count} ${count === 1 ? "passeggero" : "passeggeri"}`;
}

export function bagsLabel(count: number) {
  return `${count} ${count === 1 ? "bagaglio" : "bagagli"}`;
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function addClock(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "00:00").split(":").map(Number);
  const dt = new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, (minute || 0) + minutes);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return { date: toISODate(dt), time: `${hh}:${mm}` };
}

export function paymentDueLine(date: string, time: string, now = new Date()) {
  if (!date || !time) return "Il pagamento va effettuato almeno 48 ore prima del viaggio.";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  if (start.getTime() - now.getTime() < 48 * 60 * 60 * 1000) {
    return "Il pagamento va effettuato subito, insieme a questa conferma.";
  }
  const due = new Date(start.getTime() - 48 * 60 * 60 * 1000);
  const hh = String(due.getHours()).padStart(2, "0");
  const mm = String(due.getMinutes()).padStart(2, "0");
  return `Il pagamento va effettuato entro ${formatWhen(toISODate(due), `${hh}:${mm}`)}.`;
}

export function paymentNotice(date: string, time: string, now = new Date()) {
  const line =
    "Paghi con link, bonifico istantaneo, Satispay o 4 rate Scalapay almeno 48 ore prima del viaggio, oppure subito alla conferma se mancano meno di 48 ore.";
  if (!date || !time) return line;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  if (Number.isNaN(start.getTime())) return line;
  if (start.getTime() - now.getTime() < 48 * 60 * 60 * 1000) {
    return "Mancano meno di 48 ore: paghi subito alla conferma, con link, bonifico istantaneo, Satispay o 4 rate Scalapay.";
  }
  return line;
}
