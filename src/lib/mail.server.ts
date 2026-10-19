import type { Sql } from "@/lib/db";
import { BANK, paymentLabel, type Booking } from "@/lib/bookings";
import { customerPrice, formatWhen, priceMarked, REMOTE_NOTICE } from "@/lib/format";
import { fleetLabel, tripFleet } from "@/lib/tariff";

const FROM_NAME = "MT TRAVEL SERVICE";

function publicHost(value: string | null | undefined) {
  const host = String(value ?? "")
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  if (!host || !host.includes(".") || !/^[a-z0-9.-]+$/.test(host)) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (host === "vercel.app" || host.endsWith(".vercel.app") || host === "vercel.com" || host.endsWith(".vercel.com")) {
    return "";
  }
  return host;
}

function originFrom(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    const host = publicHost(url.hostname);
    if (!host) return "";
    const proto = url.protocol === "http:" ? "http" : "https";
    const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
    return `${proto}://${url.hostname}${port}`;
  } catch {
    const host = publicHost(raw);
    return host ? `https://${host}` : "";
  }
}

export async function requestOrigin(preferred?: string) {
  const baked = (import.meta as { env?: { VITE_PUBLIC_HOSTNAME?: string } }).env?.VITE_PUBLIC_HOSTNAME;
  const published = originFrom(baked) || originFrom(process.env.VITE_PUBLIC_HOSTNAME);
  if (published) return published;
  const fromClient = originFrom(preferred);
  if (fromClient) return fromClient;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const forwarded = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const host = publicHost(forwarded);
    if (!host) return "";
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (host === "localhost" || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

function tripLines(booking: Booking) {
  const { trip, customer, quote } = booking;
  return [
    `${customer.firstName} ${customer.lastName}`.trim(),
    `${trip.origin.label} → ${trip.destination.label}`,
    formatWhen(trip.date, trip.time),
    quote.legs && quote.legs.length > 1
      ? quote.legs.map((leg) => `${leg.label} ${leg.km.toFixed(1)} km`).join(" · ")
      : "",
    `${fleetLabel(tripFleet(trip))} · ${trip.passengers} passeggeri`,
    `Totale ${customerPrice(quote.total, priceMarked(quote))} · ${paymentLabel(booking.paymentMethod)}`,
    trip.flight ? `Volo ${trip.flight}` : "",
  ].filter(Boolean);
}

export function customerMail(booking: Booking, viewUrl: string, editUrl: string) {
  const lines = tripLines(booking);
  const text = [
    `Ciao ${booking.customer.firstName},`,
    "",
    `abbiamo ricevuto la richiesta ${booking.code}.`,
    ...lines,
    "",
    `Vedi la richiesta: ${viewUrl}`,
    `Modifica: ${editUrl}`,
    "",
    "Non paghi ora. MT TRAVEL SERVICE ti risponde con la conferma e le istruzioni di pagamento.",
    booking.quote.remote ? REMOTE_NOTICE : "",
    "Puoi modificare la richiesta dal link solo fino a 48 ore prima del viaggio.",
    "Se modifichi una richiesta già confermata, torna da confermare.",
    "",
    FROM_NAME,
  ].join("\n");
  const html = `
    <div style="font-family:sans-serif;color:#101412;line-height:1.45">
      <p>Ciao ${escapeHtml(booking.customer.firstName)},</p>
      <p>abbiamo ricevuto la richiesta <strong>${escapeHtml(booking.code)}</strong>.</p>
      <p>${lines.map(escapeHtml).join("<br>")}</p>
      <p>
        <a href="${escapeHtml(viewUrl)}" style="display:inline-block;margin-right:8px;padding:12px 16px;background:#101412;color:#f4f0e6;text-decoration:none">Vedi la richiesta</a>
        <a href="${escapeHtml(editUrl)}" style="display:inline-block;padding:12px 16px;background:#d4b483;color:#101412;text-decoration:none">Modifica</a>
      </p>
      <p>Non paghi ora. Ti rispondiamo con la conferma e le istruzioni per pagare con il metodo scelto.</p>
      ${booking.quote.remote ? `<p>${escapeHtml(REMOTE_NOTICE)}</p>` : ""}
      <p>Puoi modificare la richiesta dal pulsante solo fino a 48 ore prima del viaggio.</p>
      <p>Se modifichi una richiesta già confermata, torna da confermare.</p>
      <p>${FROM_NAME}<br>${BANK.holder}</p>
    </div>`;
  return { subject: `Richiesta ricevuta ${booking.code}`, text, html };
}

export function staffChangeMail(booking: Booking, viewUrl: string) {
  const lines = tripLines(booking);
  const text = [
    `Ciao ${booking.customer.firstName},`,
    "",
    `MT TRAVEL SERVICE ha aggiornato il preventivo ${booking.code}.`,
    ...lines,
    "",
    `Vedi la richiesta aggiornata: ${viewUrl}`,
    booking.quote.remote ? REMOTE_NOTICE : "",
    "",
    FROM_NAME,
  ].join("\n");
  const html = `
    <div style="font-family:sans-serif;color:#101412;line-height:1.45">
      <p>Ciao ${escapeHtml(booking.customer.firstName)},</p>
      <p>MT TRAVEL SERVICE ha aggiornato il preventivo <strong>${escapeHtml(booking.code)}</strong>.</p>
      <p>${lines.map(escapeHtml).join("<br>")}</p>
      <p><a href="${escapeHtml(viewUrl)}" style="display:inline-block;padding:12px 16px;background:#101412;color:#f4f0e6;text-decoration:none">Vedi la richiesta</a></p>
      ${booking.quote.remote ? `<p>${escapeHtml(REMOTE_NOTICE)}</p>` : ""}
      <p>${FROM_NAME}</p>
    </div>`;
  return { subject: `Preventivo aggiornato ${booking.code}`, text, html };
}

export function ownerMail(booking: Booking, viewUrl: string, kind: "nuova" | "modificata") {
  const lines = tripLines(booking);
  const title = kind === "modificata" ? `Richiesta modificata ${booking.code}` : `Nuova richiesta ${booking.code}`;
  const text = [
    title,
    ...lines,
    `Telefono ${booking.customer.phone}`,
    `Email ${booking.customer.email}`,
    `Stato: da confermare`,
    `Link cliente: ${viewUrl}`,
  ].join("\n");
  return { subject: title, text, html: `<pre style="font-family:sans-serif">${escapeHtml(text)}</pre>` };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

type AlertRow = { notify_email: string; smtp_user: string; smtp_pass: string };

export async function loadAlerts(sql: Sql) {
  const rows = await sql<AlertRow>`select notify_email, smtp_user, smtp_pass from staff_alerts where id = 1`;
  return (
    rows[0] ?? {
      notify_email: "info@mttravelservice.com",
      smtp_user: "info@mttravelservice.com",
      smtp_pass: "",
    }
  );
}

export async function deliverMail(options: {
  sql: Sql;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const alerts = await loadAlerts(options.sql);
  const pass = alerts.smtp_pass.trim();
  if (pass && options.to.includes("@")) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: alerts.smtp_user || "info@mttravelservice.com", pass },
    });
    await transport.sendMail({
      from: `"${FROM_NAME}" <${alerts.smtp_user || "info@mttravelservice.com"}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  }
  return false;
}

export async function notifyOwnerFallback(email: string, subject: string, text: string) {
  if (!email.includes("@")) return false;
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      _subject: subject,
      _template: "box",
      message: text,
    }),
  });
  return res.ok;
}
