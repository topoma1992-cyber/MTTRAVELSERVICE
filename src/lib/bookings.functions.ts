import { createServerFn } from "@tanstack/react-start";
import { makeBookingCode, type Booking, type PaymentMethod } from "@/lib/bookings";

const METHODS = new Set<PaymentMethod>(["bonifico", "link", "satispay", "rate"]);

type PinInput = { pin: string };

function cleanPin(value: unknown) {
  const pin = typeof value === "string" ? value.trim() : "";
  if (pin.length < 4 || pin.length > 40) throw new Error("Il codice deve avere almeno 4 caratteri.");
  return pin;
}

async function pinTools() {
  const { scryptSync, randomBytes, timingSafeEqual } = await import("node:crypto");
  return {
    hash(pin: string) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(pin, salt, 32).toString("hex");
      return `${salt}:${hash}`;
    },
    matches(pin: string, stored: string) {
      const [salt, hash] = stored.split(":");
      if (!salt || !hash) return false;
      const next = scryptSync(pin, salt, 32);
      const prev = Buffer.from(hash, "hex");
      if (next.length !== prev.length) return false;
      return timingSafeEqual(next, prev);
    },
  };
}

async function lockHash() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ pin_hash: string }>`select pin_hash from staff_lock where id = 1`;
  return { sql, hash: rows[0]?.pin_hash ?? null };
}

async function requirePin(pin: string) {
  const { sql, hash } = await lockHash();
  if (!hash) throw new Error("Prima crea il codice di gestione.");
  const tools = await pinTools();
  if (!tools.matches(pin, hash)) throw new Error("Codice non valido.");
  return sql;
}

function jsonValue(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function asRecord(value: unknown, label: string) {
  const parsed = jsonValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} non valido.`);
  return parsed as Record<string, unknown>;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function place(value: unknown) {
  const row = asRecord(value, "Luogo");
  const label = text(row.label, 240);
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (label.length < 2 || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Indirizzo non valido.");
  return { label, lat, lon };
}

function incomingBooking(input: unknown) {
  const body = asRecord(input, "Richiesta");
  const tripRaw = asRecord(body.trip, "Viaggio");
  const customerRaw = asRecord(body.customer, "Cliente");
  const quoteRaw = asRecord(body.quote, "Preventivo");
  const paymentMethod = text(body.paymentMethod, 20) as PaymentMethod;
  if (!METHODS.has(paymentMethod)) throw new Error("Scegli un metodo di pagamento.");
  const firstName = text(customerRaw.firstName, 80);
  const lastName = text(customerRaw.lastName, 80);
  const phone = text(customerRaw.phone, 30);
  const email = text(customerRaw.email, 120);
  if (firstName.length < 2 || lastName.length < 2) throw new Error("Nome non valido.");
  if (phone.replace(/\D/g, "").length < 8 || !email.includes("@")) throw new Error("Contatti non validi.");
  const vehicle: "car" | "van" = tripRaw.vehicle === "van" ? "van" : "car";
  if (tripRaw.vehicle !== "van" && tripRaw.vehicle !== "car") throw new Error("Veicolo non valido.");
  const stops = Array.isArray(tripRaw.stops) ? tripRaw.stops.slice(0, 6).map(place) : [];
  const total = Number(quoteRaw.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Preventivo non valido.");
  const trip = {
    origin: place(tripRaw.origin),
    destination: place(tripRaw.destination),
    stops,
    roundTrip: Boolean(tripRaw.roundTrip),
    date: text(tripRaw.date, 10),
    time: text(tripRaw.time, 5),
    landingDate: text(tripRaw.landingDate, 10),
    landingTime: text(tripRaw.landingTime, 5),
    returnDate: text(tripRaw.returnDate, 10),
    returnTime: text(tripRaw.returnTime, 5),
    passengers: Math.min(8, Math.max(1, Number(tripRaw.passengers) || 1)),
    luggage: Math.min(30, Math.max(0, Number(tripRaw.luggage) || 0)),
    oversized: Boolean(tripRaw.oversized) || Number(tripRaw.luggage) > 10,
    oversizedNote: text(tripRaw.oversizedNote, 400),
    vehicle,
    childSeats: Math.min(4, Math.max(0, Number(tripRaw.childSeats) || 0)),
    boosters: Math.min(4, Math.max(0, Number(tripRaw.boosters) || 0)),
    meetGreet: Boolean(tripRaw.meetGreet),
    pet: Boolean(tripRaw.pet),
    waitMinutes: Math.min(240, Math.max(0, Number(tripRaw.waitMinutes) || 0)),
    flight: text(tripRaw.flight, 40),
  };
  if ((trip.oversized || trip.luggage > 10) && trip.oversizedNote.length < 3) {
    throw new Error("Descrivi i bagagli fuori misura.");
  }
  if (!trip.date || !trip.time) throw new Error("Data non valida.");
  return {
    trip,
    customer: { firstName, lastName, phone, email, notes: text(customerRaw.notes, 500) },
    quote: quoteRaw,
    paymentMethod,
  };
}

function rowToBooking(row: {
  id: string;
  code: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_link: string;
  trip: unknown;
  customer: unknown;
  quote: unknown;
  revised?: boolean | null;
}): Booking {
  const method = METHODS.has(row.payment_method as PaymentMethod)
    ? (row.payment_method as PaymentMethod)
    : "bonifico";
  return {
    id: row.id,
    code: row.code,
    createdAt: String(row.created_at),
    status: row.status === "confirmed" ? "confirmed" : "pending",
    paymentMethod: method,
    paymentLink: row.payment_link ?? "",
    trip: jsonValue(row.trip) as Booking["trip"],
    customer: jsonValue(row.customer) as Booking["customer"],
    quote: jsonValue(row.quote) as Booking["quote"],
    revised: Boolean(row.revised),
  };
}

export const staffStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { hash } = await lockHash();
  return { claimed: Boolean(hash) };
});

export const claimStaff = createServerFn({ method: "POST" })
  .validator((input: PinInput) => ({ pin: cleanPin(input?.pin) }))
  .handler(async ({ data }) => {
    const { sql, hash } = await lockHash();
    if (hash) throw new Error("Il codice esiste già.");
    const tools = await pinTools();
    await sql`insert into staff_lock (id, pin_hash) values (1, ${tools.hash(data.pin)})`;
    return { ok: true as const };
  });

export const submitBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asRecord(input, "Richiesta");
    return { ...incomingBooking(body), pageOrigin: text(body.pageOrigin, 300) };
  })
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = crypto.randomUUID();
    const code = makeBookingCode();
    const created = new Date().toISOString();
    const editToken = crypto.randomUUID().replace(/-/g, "");
    await sql`
      insert into bookings (id, code, created_at, status, payment_method, payment_link, trip, customer, quote, edit_token, revised)
      values (
        ${id},
        ${code},
        ${created},
        'pending',
        ${data.paymentMethod},
        '',
        ${JSON.stringify(data.trip)}::jsonb,
        ${JSON.stringify(data.customer)}::jsonb,
        ${JSON.stringify(data.quote)}::jsonb,
        ${editToken},
        false
      )
    `;
    const booking: Booking = {
      id,
      code,
      createdAt: created,
      status: "pending",
      paymentMethod: data.paymentMethod,
      paymentLink: "",
      trip: data.trip,
      customer: data.customer,
      quote: data.quote as Booking["quote"],
      revised: false,
    };
    const links = await bookingLinks(editToken, data.pageOrigin);
    const mailed = await sendRequestMails(sql, booking, links, "nuova");
    return { ...booking, ...links, mailed };
  });

export const createStaffQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asRecord(input, "Preventivo");
    const pin = cleanPin(body.pin);
    const vehicle: "car" | "van" = body.vehicle === "van" ? "van" : "car";
    const passengers = Math.min(8, Math.max(0, Number(body.passengers) || 0));
    const luggage = Math.min(30, Math.max(0, Number(body.luggage) || 0));
    const total = Number(body.total);
    const amount = Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : 0;
    const paymentRaw = text(body.paymentMethod, 20);
    const paymentMethod: PaymentMethod = METHODS.has(paymentRaw as PaymentMethod)
      ? (paymentRaw as PaymentMethod)
      : "bonifico";
    const oversizedNote = text(body.oversizedNote, 400);
    const originLat = Number(body.originLat);
    const originLon = Number(body.originLon);
    const destinationLat = Number(body.destinationLat);
    const destinationLon = Number(body.destinationLon);
    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    const lines = rawLines
      .slice(0, 24)
      .map((line) => {
        if (!line || typeof line !== "object") return null;
        const row = line as Record<string, unknown>;
        const label = text(row.label, 80);
        const lineAmount = Number(row.amount);
        if (!label || !Number.isFinite(lineAmount)) return null;
        return { label, amount: Math.round(lineAmount * 100) / 100 };
      })
      .filter((line): line is { label: string; amount: number } => Boolean(line));
    const lineSum = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
    const quoteLines =
      lines.length > 0 && Math.abs(lineSum - amount) < 0.05
        ? lines
        : amount > 0
          ? [{ label: "Totale", amount }]
          : [];
    return {
      pin,
      paymentMethod,
      trip: {
        origin: {
          label: text(body.origin, 240) || "—",
          lat: Number.isFinite(originLat) ? originLat : 0,
          lon: Number.isFinite(originLon) ? originLon : 0,
        },
        destination: {
          label: text(body.destination, 240) || "—",
          lat: Number.isFinite(destinationLat) ? destinationLat : 0,
          lon: Number.isFinite(destinationLon) ? destinationLon : 0,
        },
        stops: [],
        roundTrip: Boolean(body.roundTrip),
        date: text(body.date, 10),
        time: text(body.time, 5),
        landingDate: "",
        landingTime: "",
        returnDate: text(body.returnDate, 10),
        returnTime: text(body.returnTime, 5),
        passengers: passengers || 1,
        luggage,
        oversized: luggage > 10 || Boolean(body.oversized),
        oversizedNote,
        vehicle,
        childSeats: 0,
        boosters: 0,
        meetGreet: false,
        pet: false,
        waitMinutes: 0,
        flight: text(body.flight, 40),
      },
      customer: {
        firstName: text(body.firstName, 80),
        lastName: text(body.lastName, 80),
        phone: text(body.phone, 30),
        email: text(body.email, 120),
        notes: text(body.notes, 500),
      },
      quote: {
        lines: quoteLines,
        total: amount,
        km: Number(body.km) || 0,
        minutes: Number(body.minutes) || 0,
        estimated: Boolean(body.estimated),
        night: false,
        holiday: null,
        vehicle,
        sameDayChoice: null,
        discountCode: null,
      },
    };
  })
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    const id = crypto.randomUUID();
    const code = makeBookingCode();
    const created = new Date().toISOString();
    const editToken = crypto.randomUUID().replace(/-/g, "");
    await sql`
      insert into bookings (id, code, created_at, status, payment_method, payment_link, trip, customer, quote, edit_token, revised)
      values (
        ${id},
        ${code},
        ${created},
        'pending',
        ${data.paymentMethod},
        '',
        ${JSON.stringify(data.trip)}::jsonb,
        ${JSON.stringify(data.customer)}::jsonb,
        ${JSON.stringify(data.quote)}::jsonb,
        ${editToken},
        false
      )
    `;
    const booking: Booking = {
      id,
      code,
      createdAt: created,
      status: "pending",
      paymentMethod: data.paymentMethod,
      paymentLink: "",
      trip: data.trip,
      customer: data.customer,
      quote: data.quote,
    };
    return booking;
  });

export const listStaffBookings = createServerFn({ method: "POST" })
  .validator((input: PinInput) => ({ pin: cleanPin(input?.pin) }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    const rows = await sql<{
      id: string;
      code: string;
      created_at: string;
      status: string;
      payment_method: string;
      payment_link: string;
      trip: unknown;
      customer: unknown;
      quote: unknown;
      revised: boolean | null;
    }>`
      select id, code, created_at::text, status, payment_method, payment_link, trip, customer, quote, revised
      from bookings
      order by created_at desc
    `;
    return rows.map(rowToBooking);
  });

export const confirmStaffBooking = createServerFn({ method: "POST" })
  .validator(
    (input: { pin: string; id: string; paymentMethod: PaymentMethod; paymentLink: string }) => {
      const pin = cleanPin(input?.pin);
      const id = text(input?.id, 80);
      const paymentMethod = input?.paymentMethod;
      if (!id || !METHODS.has(paymentMethod)) throw new Error("Richiesta non valida.");
      const paymentLink = text(input?.paymentLink, 500);
      if (paymentMethod !== "bonifico" && !/^https?:\/\/\S+$/i.test(paymentLink)) {
        throw new Error("Incolla il link di pagamento, completo di https://");
      }
      return { pin, id, paymentMethod, paymentLink: paymentMethod === "bonifico" ? "" : paymentLink };
    },
  )
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    const rows = await sql<{ id: string }>`
      update bookings
      set status = 'confirmed', payment_method = ${data.paymentMethod}, payment_link = ${data.paymentLink}, revised = false
      where id = ${data.id}
      returning id
    `;
    if (!rows[0]) throw new Error("Richiesta non trovata.");
    return { ok: true as const };
  });

export const removeStaffBooking = createServerFn({ method: "POST" })
  .validator((input: { pin: string; id: string }) => ({ pin: cleanPin(input?.pin), id: text(input?.id, 80) }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    await sql`delete from bookings where id = ${data.id}`;
    return { ok: true as const };
  });

function cleanToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!/^[a-z0-9]{20,80}$/i.test(token)) throw new Error("Link non valido.");
  return token;
}

async function bookingLinks(token: string, preferred?: string) {
  const { requestOrigin } = await import("@/lib/mail.server");
  const origin = await requestOrigin(preferred);
  const path = `/r/${token}`;
  const viewUrl = origin ? `${origin}${path}` : path;
  return { viewUrl, editUrl: `${viewUrl}?modifica=1` };
}

async function sendRequestMails(
  sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>,
  booking: Booking,
  links: { viewUrl: string; editUrl: string },
  kind: "nuova" | "modificata",
) {
  const { customerMail, deliverMail, loadAlerts, notifyOwnerFallback, ownerMail } = await import("@/lib/mail.server");
  let mailed = false;
  try {
    const message = customerMail(booking, links.viewUrl, links.editUrl);
    mailed = await deliverMail({ sql, to: booking.customer.email, ...message });
  } catch {
    mailed = false;
  }
  try {
    const alerts = await loadAlerts(sql);
    const message = ownerMail(booking, links.viewUrl, kind);
    const sent = await deliverMail({ sql, to: alerts.notify_email, ...message });
    if (!sent) await notifyOwnerFallback(alerts.notify_email, message.subject, message.text);
  } catch {
    /* l'avviso non blocca la richiesta */
  }
  return mailed;
}

async function bookingByToken(token: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    code: string;
    created_at: string;
    status: string;
    payment_method: string;
    payment_link: string;
    trip: unknown;
    customer: unknown;
    quote: unknown;
    revised: boolean | null;
  }>`
    select id, code, created_at::text, status, payment_method, payment_link, trip, customer, quote, revised
    from bookings
    where edit_token = ${token}
  `;
  const row = rows[0];
  if (!row) throw new Error("Richiesta non trovata.");
  return { sql, booking: rowToBooking(row) };
}

export const getPublicBooking = createServerFn({ method: "GET" })
  .validator((input: { token?: string }) => ({ token: cleanToken(input?.token) }))
  .handler(async ({ data }) => {
    const { booking } = await bookingByToken(data.token);
    return booking;
  });

export const updatePublicBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asRecord(input, "Richiesta");
    const token = cleanToken(body.token);
    return { token, ...incomingBooking(body), pageOrigin: text(body.pageOrigin, 300) };
  })
  .handler(async ({ data }) => {
    const { sql, booking: current } = await bookingByToken(data.token);
    const { customerCanEdit } = await import("@/lib/format");
    if (!customerCanEdit(current.trip.date, current.trip.time)) {
      throw new Error("La modifica è possibile solo fino a 48 ore prima del viaggio.");
    }
    await sql`
      update bookings
      set status = 'pending',
          revised = true,
          payment_method = ${data.paymentMethod},
          trip = ${JSON.stringify(data.trip)}::jsonb,
          customer = ${JSON.stringify(data.customer)}::jsonb,
          quote = ${JSON.stringify(data.quote)}::jsonb
      where edit_token = ${data.token}
    `;
    const booking: Booking = {
      ...current,
      status: "pending",
      revised: true,
      paymentMethod: data.paymentMethod,
      trip: data.trip,
      customer: data.customer,
      quote: data.quote as Booking["quote"],
    };
    const links = await bookingLinks(data.token, data.pageOrigin);
    await sendRequestMails(sql, booking, links, "modificata");
    return booking;
  });

export const alertSettings = createServerFn({ method: "POST" })
  .validator((input: PinInput) => ({ pin: cleanPin(input?.pin) }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    const { loadAlerts } = await import("@/lib/mail.server");
    const alerts = await loadAlerts(sql);
    return { notifyEmail: alerts.notify_email, mailReady: alerts.smtp_pass.trim().length > 8 };
  });

export const saveAlertSettings = createServerFn({ method: "POST" })
  .validator((input: { pin?: string; notifyEmail?: string; smtpPass?: string }) => {
    const pin = cleanPin(input?.pin);
    const notifyEmail = text(input?.notifyEmail, 120);
    if (!notifyEmail.includes("@")) throw new Error("Email non valida.");
    return { pin, notifyEmail, smtpPass: text(input?.smtpPass, 80) };
  })
  .handler(async ({ data }) => {
    const sql = await requirePin(data.pin);
    if (data.smtpPass) {
      await sql`
        update staff_alerts
        set notify_email = ${data.notifyEmail}, smtp_user = ${data.notifyEmail}, smtp_pass = ${data.smtpPass}
        where id = 1
      `;
    } else {
      await sql`update staff_alerts set notify_email = ${data.notifyEmail} where id = 1`;
    }
    const { loadAlerts } = await import("@/lib/mail.server");
    const alerts = await loadAlerts(sql);
    return { ok: true as const, mailReady: alerts.smtp_pass.trim().length > 8 };
  });

