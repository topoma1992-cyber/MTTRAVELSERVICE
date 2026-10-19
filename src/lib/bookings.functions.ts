import { createServerFn } from "@tanstack/react-start";
import { makeBookingCode, type Booking, type PaymentMethod } from "@/lib/bookings";
import { fleetForPassengers } from "@/lib/tariff";

const METHODS = new Set<PaymentMethod>(["bonifico", "link", "satispay", "rate"]);

type PinInput = { staffEmail?: string; pin?: string };

const OWNER_EMAIL = "info@mttravelservice.com";

function cleanPin(value: unknown) {
  const pin = typeof value === "string" ? value.trim() : "";
  if (pin.length < 4 || pin.length > 40) throw new Error("Il codice deve avere almeno 4 caratteri.");
  return pin;
}

function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new Error("Mail non valida.");
  return email;
}

function cleanAuth(input: PinInput | null | undefined) {
  return { staffEmail: cleanEmail(input?.staffEmail), pin: cleanPin(input?.pin) };
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

async function requirePin(email: string, pin: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ pin_hash: string }>`select pin_hash from staff_logins where email = ${email}`;
  const stored = rows[0]?.pin_hash;
  if (!stored) throw new Error("Mail o codice non validi.");
  const tools = await pinTools();
  if (!tools.matches(pin, stored)) throw new Error("Mail o codice non validi.");
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
  const quoteCode = text(quoteRaw.discountCode, 40).toUpperCase();
  const convenzione = quoteCode === "CONVENZIONE20";
  if (!convenzione && !METHODS.has(paymentMethod)) throw new Error("Scegli un metodo di pagamento.");
  if (paymentMethod && !METHODS.has(paymentMethod)) throw new Error("Scegli un metodo di pagamento.");
  const firstName = text(customerRaw.firstName, 80);
  const lastName = text(customerRaw.lastName, 80);
  const phone = text(customerRaw.phone, 30);
  const email = text(customerRaw.email, 120);
  if (!convenzione && (firstName.length < 2 || lastName.length < 2)) throw new Error("Nome non valido.");
  if (!convenzione && (phone.replace(/\D/g, "").length < 8 || !email.includes("@"))) {
    throw new Error("Contatti non validi.");
  }
  const vehicle: "car" | "van" = tripRaw.vehicle === "van" ? "van" : "car";
  if (tripRaw.vehicle !== "van" && tripRaw.vehicle !== "car") throw new Error("Veicolo non valido.");
  const stops = Array.isArray(tripRaw.stops) ? tripRaw.stops.slice(0, 6).map(place) : [];
  const total = Number(quoteRaw.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Preventivo non valido.");
  const passengers = Math.min(16, Math.max(1, Number(tripRaw.passengers) || 1));
  const luggage = Math.min(60, Math.max(0, Number(tripRaw.luggage) || 0));
  const fleet = passengers > 8 ? fleetForPassengers(passengers, luggage) : undefined;
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
    passengers,
    luggage,
    oversized: Boolean(tripRaw.oversized) || luggage > 10,
    oversizedNote: text(tripRaw.oversizedNote, 400),
    vehicle: fleet && fleet.vans > 0 ? "van" : vehicle,
    fleet,
    childSeats: 0,
    boosters: 0,
    meetGreet: Boolean(tripRaw.meetGreet),
    pet: false,
    waitMinutes: Math.min(720, Math.max(0, Number(tripRaw.waitMinutes) || 0)),
    vehicleStay: Boolean(tripRaw.roundTrip) && Boolean(tripRaw.vehicleStay),
    flight: text(tripRaw.flight, 40),
  };
  if (!convenzione && (trip.oversized || trip.luggage > 10) && trip.oversizedNote.length < 3) {
    throw new Error("Descrivi i bagagli fuori misura.");
  }
  if (!convenzione && (!trip.date || !trip.time)) throw new Error("Data non valida.");
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
    : ("" as PaymentMethod);
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
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from staff_logins where owner = true limit 1`;
  return { claimed: Boolean(rows[0]) };
});

export const claimStaff = createServerFn({ method: "POST" })
  .validator((input: PinInput) => ({ pin: cleanPin(input?.pin) }))
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ email: string }>`select email from staff_logins where owner = true limit 1`;
    if (rows[0]) throw new Error("L'accesso esiste già.");
    const tools = await pinTools();
    await sql`
      insert into staff_logins (email, pin_hash, owner)
      values (${OWNER_EMAIL}, ${tools.hash(data.pin)}, true)
    `;
    return { ok: true as const };
  });

export const listStaffLogins = createServerFn({ method: "POST" })
  .validator((input: PinInput) => cleanAuth(input))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    const rows = await sql<{ email: string; owner: boolean | string }>`
      select email, owner from staff_logins order by owner desc, email
    `;
    return rows.map((row) => ({
      email: row.email,
      owner: row.owner === true || row.owner === "t" || row.owner === "true",
    }));
  });

export const saveStaffLogin = createServerFn({ method: "POST" })
  .validator((input: PinInput & { loginEmail?: string; loginPin?: string }) => ({
    ...cleanAuth(input),
    loginEmail: cleanEmail(input?.loginEmail),
    loginPin: cleanPin(input?.loginPin),
  }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    if (data.loginEmail === OWNER_EMAIL) {
      throw new Error("Il codice di info@mttravelservice.com resta quello già impostato.");
    }
    const count = await sql<{ n: number | string }>`select count(*)::int as n from staff_logins`;
    const existing = await sql<{ email: string }>`select email from staff_logins where email = ${data.loginEmail}`;
    if (!existing[0] && Number(count[0]?.n) >= 20) throw new Error("Puoi autorizzare al massimo 20 mail.");
    const tools = await pinTools();
    await sql`
      insert into staff_logins (email, pin_hash, owner)
      values (${data.loginEmail}, ${tools.hash(data.loginPin)}, false)
      on conflict (email) do update set pin_hash = excluded.pin_hash
    `;
    return { ok: true as const };
  });

export const removeStaffLogin = createServerFn({ method: "POST" })
  .validator((input: PinInput & { loginEmail?: string }) => ({
    ...cleanAuth(input),
    loginEmail: cleanEmail(input?.loginEmail),
  }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    if (data.loginEmail === OWNER_EMAIL) throw new Error("Questa mail non si può togliere.");
    await sql`delete from staff_logins where email = ${data.loginEmail} and owner = false`;
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
    const staffEmail = cleanEmail(body.staffEmail);
    const vehicle: "car" | "van" = body.vehicle === "van" ? "van" : "car";
    const passengers = Math.min(16, Math.max(0, Number(body.passengers) || 0));
    const luggage = Math.min(60, Math.max(0, Number(body.luggage) || 0));
    const fleet = passengers > 8 ? fleetForPassengers(passengers, luggage) : undefined;
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
      staffEmail,
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
        vehicle: fleet && fleet.vans > 0 ? "van" : vehicle,
        fleet,
        childSeats: 0,
        boosters: 0,
        meetGreet: false,
        pet: false,
        waitMinutes: Math.min(720, Math.max(0, Number(body.waitMinutes) || 0)),
        vehicleStay: Boolean(body.roundTrip) && Boolean(body.vehicleStay),
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
        appliedWait: Math.min(720, Math.max(0, Number(body.waitMinutes) || 0)),
        discountCode: null,
        approachKm: Math.max(0, Number(body.approachKm) || 0) || undefined,
        approachAmount: Math.max(0, Number(body.approachAmount) || 0) || undefined,
        remote: body.remote === true || undefined,
      },
    };
  })
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
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
  .validator((input: PinInput) => cleanAuth(input))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
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
    (input: { staffEmail?: string; pin?: string; id: string; paymentMethod: PaymentMethod; paymentLink: string }) => {
      const auth = cleanAuth(input);
      const id = text(input?.id, 80);
      const paymentMethod = input?.paymentMethod;
      if (!id || !METHODS.has(paymentMethod)) throw new Error("Richiesta non valida.");
      const paymentLink = text(input?.paymentLink, 500);
      if (paymentMethod !== "bonifico" && !/^https?:\/\/\S+$/i.test(paymentLink)) {
        throw new Error("Incolla il link di pagamento, completo di https://");
      }
      return { ...auth, id, paymentMethod, paymentLink: paymentMethod === "bonifico" ? "" : paymentLink };
    },
  )
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    const rows = await sql<{ id: string }>`
      update bookings
      set status = 'confirmed', payment_method = ${data.paymentMethod}, payment_link = ${data.paymentLink}, revised = false
      where id = ${data.id}
      returning id
    `;
    if (!rows[0]) throw new Error("Richiesta non trovata.");
    return { ok: true as const };
  });

export const updateStaffBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asRecord(input, "Richiesta");
    const id = text(body.id, 80);
    if (!id) throw new Error("Richiesta non valida.");
    return {
      ...cleanAuth({ staffEmail: typeof body.staffEmail === "string" ? body.staffEmail : "", pin: typeof body.pin === "string" ? body.pin : "" }),
      id,
      pageOrigin: text(body.pageOrigin, 300),
      paymentLink: text(body.paymentLink, 500),
      notify: body.notify !== false,
      ...incomingBooking(body),
    };
  })
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    const rows = await sql<{
      edit_token: string;
      status: string;
      code: string;
      created_at: string;
      revised: boolean | null;
    }>`
      select edit_token, status, code, created_at::text, revised
      from bookings
      where id = ${data.id}
    `;
    const current = rows[0];
    if (!current?.edit_token) throw new Error("Richiesta non trovata.");
    const quote = data.quote as Booking["quote"];
    await sql`
      update bookings
      set payment_method = ${data.paymentMethod},
          payment_link = ${data.paymentLink},
          trip = ${JSON.stringify(data.trip)}::jsonb,
          customer = ${JSON.stringify(data.customer)}::jsonb,
          quote = ${JSON.stringify(quote)}::jsonb
      where id = ${data.id}
    `;
    const booking: Booking = {
      id: data.id,
      code: current.code,
      createdAt: String(current.created_at),
      status: current.status === "confirmed" ? "confirmed" : "pending",
      paymentMethod: data.paymentMethod,
      paymentLink: data.paymentLink,
      trip: data.trip as Booking["trip"],
      customer: data.customer,
      quote,
      revised: Boolean(current.revised),
    };
    const links = await bookingLinks(current.edit_token, data.pageOrigin);
    if (!data.notify) return { booking, mailed: false, notice: "" };
    const { deliverMail, staffChangeMail } = await import("@/lib/mail.server");
    const message = staffChangeMail(booking, links.viewUrl);
    let mailed = false;
    try {
      mailed = await deliverMail({ sql, to: booking.customer.email, ...message });
    } catch {
      mailed = false;
    }
    return { booking, mailed, notice: message.text };
  });

export const removeStaffBooking = createServerFn({ method: "POST" })
  .validator((input: { staffEmail?: string; pin?: string; id: string }) => ({ ...cleanAuth(input), id: text(input?.id, 80) }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
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
  .validator((input: PinInput) => cleanAuth(input))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    const { loadAlerts } = await import("@/lib/mail.server");
    const alerts = await loadAlerts(sql);
    return { notifyEmail: alerts.notify_email, mailReady: alerts.smtp_pass.trim().length > 8 };
  });

export const saveAlertSettings = createServerFn({ method: "POST" })
  .validator((input: { staffEmail?: string; pin?: string; notifyEmail?: string; smtpPass?: string }) => {
    const auth = cleanAuth(input);
    const notifyEmail = text(input?.notifyEmail, 120);
    if (!notifyEmail.includes("@")) throw new Error("Email non valida.");
    return { ...auth, notifyEmail, smtpPass: text(input?.smtpPass, 80) };
  })
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
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

type DiscountRow = {
  code: string;
  active: boolean | string;
  total_percent: number | string;
  ride_percent: number | string;
  min_fare: number | string;
  night_percent: number | string;
  holiday_percent: number | string;
  wait_percent: number | string;
  meet_greet_free: boolean | string;
  max_discount?: number | string;
  vehicle?: string;
};

function discountVehicle(value: unknown): "all" | "car" | "van" {
  return value === "car" || value === "van" ? value : "all";
}

function flag(value: boolean | string) {
  return value === true || value === "t" || value === "true" || value === "1";
}

function amount(value: number | string) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.min(100, Math.max(0, Math.round(next * 100) / 100));
}

function fare(value: number | string) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.round(next * 100) / 100;
}

function toDiscount(row: DiscountRow) {
  return {
    code: String(row.code).trim().toUpperCase(),
    active: flag(row.active),
    totalPercent: amount(row.total_percent),
    ridePercent: amount(row.ride_percent),
    minFare: fare(row.min_fare),
    nightPercent: amount(row.night_percent),
    holidayPercent: amount(row.holiday_percent),
    waitPercent: amount(row.wait_percent),
    meetGreetFree: flag(row.meet_greet_free),
    maxAmount: fare(row.max_discount ?? 0),
    vehicle: discountVehicle(row.vehicle),
  };
}

function cleanCode(value: unknown) {
  const code = text(value, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3) throw new Error("Il codice deve avere almeno 3 lettere o numeri.");
  return code;
}

type DiscountInput = {
  staffEmail?: string;
  pin?: string;
  previousCode?: string;
  code?: string;
  active?: boolean;
  totalPercent?: number;
  ridePercent?: number;
  minFare?: number;
  nightPercent?: number;
  holidayPercent?: number;
  waitPercent?: number;
  meetGreetFree?: boolean;
  maxAmount?: number;
  vehicle?: string;
};

function cleanDiscount(input: DiscountInput) {
  return {
    staffEmail: cleanEmail(input.staffEmail),
    pin: cleanPin(input.pin),
    previousCode: text(input.previousCode, 20).toUpperCase(),
    code: cleanCode(input.code),
    active: input.active !== false,
    totalPercent: amount(input.totalPercent ?? 0),
    ridePercent: amount(input.ridePercent ?? 0),
    minFare: fare(input.minFare ?? 0),
    nightPercent: amount(input.nightPercent ?? 0),
    holidayPercent: amount(input.holidayPercent ?? 0),
    waitPercent: amount(input.waitPercent ?? 0),
    meetGreetFree: input.meetGreetFree === true,
    maxAmount: fare(input.maxAmount ?? 0),
    vehicle: discountVehicle(input.vehicle),
  };
}

export const listDiscountCodes = createServerFn({ method: "POST" })
  .validator((input: PinInput) => cleanAuth(input))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    const rows = await sql<DiscountRow>`select * from discount_codes order by code`;
    return rows.map(toDiscount);
  });

export const listPublicDiscounts = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<DiscountRow>`
    select code, active,
      total_percent::float8 as total_percent,
      ride_percent::float8 as ride_percent,
      min_fare::float8 as min_fare,
      night_percent::float8 as night_percent,
      holiday_percent::float8 as holiday_percent,
      wait_percent::float8 as wait_percent,
      max_discount::float8 as max_discount,
      vehicle,
      meet_greet_free
    from discount_codes
    where active = true
    order by code
  `;
  return rows.map(toDiscount);
});

export const lookupDiscount = createServerFn({ method: "POST" })
  .validator((input: { code?: string }) => text(input?.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .handler(async ({ data }) => {
    if (data.length < 3) return null;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<DiscountRow>`select * from discount_codes where code = ${data} and active = true`;
    return rows[0] ? toDiscount(rows[0]) : null;
  });

export const saveDiscountCode = createServerFn({ method: "POST" })
  .validator((input: DiscountInput) => cleanDiscount(input ?? {}))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    if (data.previousCode && data.previousCode !== data.code) {
      await sql`delete from discount_codes where code = ${data.previousCode}`;
    }
    await sql`
      insert into discount_codes (
        code, active, total_percent, ride_percent, min_fare, night_percent, holiday_percent, wait_percent, meet_greet_free, max_discount, vehicle
      ) values (
        ${data.code}, ${data.active}, ${data.totalPercent}, ${data.ridePercent}, ${data.minFare},
        ${data.nightPercent}, ${data.holidayPercent}, ${data.waitPercent}, ${data.meetGreetFree}, ${data.maxAmount}, ${data.vehicle}
      )
      on conflict (code) do update set
        active = excluded.active,
        total_percent = excluded.total_percent,
        ride_percent = excluded.ride_percent,
        min_fare = excluded.min_fare,
        night_percent = excluded.night_percent,
        holiday_percent = excluded.holiday_percent,
        wait_percent = excluded.wait_percent,
        meet_greet_free = excluded.meet_greet_free,
        max_discount = excluded.max_discount,
        vehicle = excluded.vehicle
    `;
    return { ok: true as const, code: data.code };
  });

export const removeDiscountCode = createServerFn({ method: "POST" })
  .validator((input: { staffEmail?: string; pin?: string; code?: string }) => ({ ...cleanAuth(input), code: cleanCode(input?.code) }))
  .handler(async ({ data }) => {
    const sql = await requirePin(data.staffEmail, data.pin);
    await sql`delete from discount_codes where code = ${data.code}`;
    return { ok: true as const };
  });

