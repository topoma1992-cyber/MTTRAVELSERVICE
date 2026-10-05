import { i as __toESM } from "../_runtime.mjs";
import { _ as createFileRoute, b as useRouter, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, q as require_react, v as createRootRoute, x as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-C6w4PL9B.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
function toISODate(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function euro(amount) {
	return new Intl.NumberFormat("it-IT", {
		style: "currency",
		currency: "EUR"
	}).format(amount);
}
function kmLabel(km) {
	return `${new Intl.NumberFormat("it-IT", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	}).format(km)} km`;
}
function formatDuration(minutes) {
	const total = Math.max(1, Math.round(minutes));
	const hours = Math.floor(total / 60);
	const rest = total % 60;
	if (hours === 0) return `${total} min`;
	if (rest === 0) return `${hours} h`;
	return `${hours} h ${rest} min`;
}
function formatWhen(date, time) {
	if (!date) return time;
	const [y, m, d] = date.split("-").map(Number);
	const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
	const label = new Intl.DateTimeFormat("it-IT", {
		weekday: "long",
		day: "numeric",
		month: "long"
	}).format(dt);
	const pretty = label.charAt(0).toUpperCase() + label.slice(1);
	return time ? `${pretty} · ${time}` : pretty;
}
function validPhone(value) {
	const trimmed = value.trim();
	if (!/^[+0-9\s()./-]+$/.test(trimmed)) return false;
	const digits = trimmed.replace(/\D/g, "");
	return digits.length >= 8 && digits.length <= 15;
}
function peopleLabel(count) {
	return `${count} ${count === 1 ? "passeggero" : "passeggeri"}`;
}
function bagsLabel(count) {
	return `${count} ${count === 1 ? "bagaglio" : "bagagli"}`;
}
function validEmail(value) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
var VEHICLES = {
	car: {
		id: "car",
		name: "Auto",
		detail: "Berlina business",
		passengers: 3,
		bagsIncluded: 2,
		bagsMax: 6,
		base: 16,
		perKm: 1.5,
		minimum: 42,
		minimumRound: 75,
		waitPerMin: .55
	},
	van: {
		id: "van",
		name: "Van",
		detail: "Veicolo privato",
		passengers: 8,
		bagsIncluded: 4,
		bagsMax: 12,
		base: 28,
		perKm: 2.05,
		minimum: 68,
		minimumRound: 120,
		waitPerMin: .7
	}
};
var EXTRA_PRICES = {
	childSeat: 10,
	booster: 8,
	meetGreet: 15,
	pet: 12,
	refreshments: 6,
	extraBag: 5,
	stop: 12
};
var HOLIDAYS = {
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
	"2027-12-26": "Santo Stefano"
};
function money(n) {
	return Math.round(n * 100) / 100;
}
function isNightTime(time) {
	if (!time || !time.includes(":")) return false;
	const [h, m] = time.split(":").map(Number);
	if (Number.isNaN(h)) return false;
	const mins = h * 60 + (m || 0);
	return mins >= 1320 || mins < 360;
}
function holidayOn(date) {
	if (!date) return null;
	return HOLIDAYS[date] ?? null;
}
function buildQuote(input) {
	const vehicle = VEHICLES[input.vehicle];
	const perKmAmount = money(input.km * vehicle.perKm);
	const raw = money(vehicle.base + perKmAmount);
	const floor = input.roundTrip ? vehicle.minimumRound : vehicle.minimum;
	const lines = [];
	let ride = raw;
	if (raw < floor) {
		ride = floor;
		lines.push({
			label: input.roundTrip ? "Tariffa minima andata e ritorno" : "Tariffa minima",
			amount: floor
		});
	} else {
		lines.push({
			label: "Partenza",
			amount: vehicle.base
		});
		lines.push({
			label: input.roundTrip ? "Percorrenza andata e ritorno" : "Percorrenza",
			amount: perKmAmount
		});
	}
	const outboundNight = isNightTime(input.time);
	const returnNight = input.roundTrip && isNightTime(input.returnTime);
	const night = outboundNight || returnNight;
	const holiday = holidayOn(input.date) ?? (input.roundTrip ? holidayOn(input.returnDate) : null);
	if (night || holiday) {
		const pct = night ? .2 : .15;
		const label = night ? "Supplemento notturno 22–06" : `Supplemento festivo · ${holiday}`;
		lines.push({
			label,
			amount: money(ride * pct)
		});
	}
	const billedWait = Math.max(0, input.waitMinutes - 15);
	if (billedWait > 0) lines.push({
		label: `Attesa oltre 15 min · ${billedWait} min`,
		amount: money(billedWait * vehicle.waitPerMin)
	});
	if (input.stopCount > 0) lines.push({
		label: input.stopCount === 1 ? "Sosta intermedia" : `Soste intermedie · ${input.stopCount}`,
		amount: input.stopCount * EXTRA_PRICES.stop
	});
	const extraBags = Math.max(0, input.luggage - vehicle.bagsIncluded);
	if (extraBags > 0) lines.push({
		label: extraBags === 1 ? "Bagaglio extra" : `Bagagli extra · ${extraBags}`,
		amount: extraBags * EXTRA_PRICES.extraBag
	});
	if (input.childSeats > 0) lines.push({
		label: input.childSeats === 1 ? "Seggiolino" : `Seggiolini · ${input.childSeats}`,
		amount: input.childSeats * EXTRA_PRICES.childSeat
	});
	if (input.boosters > 0) lines.push({
		label: input.boosters === 1 ? "Alzatina" : `Alzatine · ${input.boosters}`,
		amount: input.boosters * EXTRA_PRICES.booster
	});
	if (input.meetGreet) lines.push({
		label: "Meet & greet",
		amount: EXTRA_PRICES.meetGreet
	});
	if (input.pet) lines.push({
		label: "Animale in auto",
		amount: EXTRA_PRICES.pet
	});
	if (input.refreshments) lines.push({
		label: "Acqua e snack",
		amount: EXTRA_PRICES.refreshments
	});
	return {
		lines,
		total: money(lines.reduce((sum, line) => sum + line.amount, 0)),
		km: input.km,
		minutes: input.minutes,
		estimated: input.estimated,
		night,
		holiday,
		vehicle: input.vehicle
	};
}
var useBookingStore = create()(persist((set) => ({
	bookings: [],
	addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
	removeBooking: (id) => set((state) => ({ bookings: state.bookings.filter((booking) => booking.id !== id) }))
}), {
	name: "mt-travel-bookings-v1",
	skipHydration: true
}));
function useStoreReady() {
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const unsub = useBookingStore.persist.onFinishHydration(() => setReady(true));
		useBookingStore.persist.rehydrate();
		if (useBookingStore.persist.hasHydrated()) setReady(true);
		return unsub;
	}, []);
	return ready;
}
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeBookingCode() {
	const bytes = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(4));
	let code = "";
	for (const byte of bytes) code += CODE_ALPHABET[byte % 32];
	return `MT-${code}`;
}
function bookingMessage(booking) {
	const { trip, customer, quote } = booking;
	const vehicle = VEHICLES[trip.vehicle];
	const lines = [
		"Richiesta NCC · MT Travel Service",
		`Codice: ${booking.code}`,
		"",
		`Cliente: ${customer.firstName} ${customer.lastName}`,
		`Telefono: ${customer.phone}`,
		`Email: ${customer.email}`,
		"",
		`${vehicle.name} · ${peopleLabel(trip.passengers)} · ${bagsLabel(trip.luggage)}`,
		`Partenza: ${trip.origin.label}`,
		...trip.stops.map((stop, index) => `Fermata ${index + 1}: ${stop.label}`),
		`Arrivo: ${trip.destination.label}`,
		`Data: ${formatWhen(trip.date, trip.time)}`,
		trip.roundTrip ? `Ritorno: ${formatWhen(trip.returnDate, trip.returnTime)}` : "Solo andata"
	];
	if (trip.flight.trim()) lines.push(`Volo o treno: ${trip.flight.trim()}`);
	if (trip.waitMinutes > 0) lines.push(`Attesa prevista: ${trip.waitMinutes} min`);
	lines.push("", `Distanza: ${kmLabel(quote.km)}${quote.estimated ? " (stima)" : ""}`, `Durata: ${formatDuration(quote.minutes)}`, `Preventivo: ${euro(quote.total)}`, ...quote.lines.map((line) => `· ${line.label}: ${euro(line.amount)}`));
	if (customer.notes.trim()) lines.push("", `Note: ${customer.notes.trim()}`);
	lines.push("", "Preventivo indicativo, da confermare da MT Travel.");
	return lines.join("\n");
}
function whatsappHref(text) {
	return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
function mailHref(booking, text) {
	const subject = `Richiesta NCC ${booking.code}`;
	return `mailto:${encodeURIComponent(booking.customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
var navClass = "inline-flex min-h-11 items-center rounded-md px-3 text-sm";
function Shell({ children }) {
	const ready = useStoreReady();
	const count = useBookingStore((state) => state.bookings.length);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "grid size-10 place-items-center rounded-md bg-primary font-display text-lg text-primary-fg",
							children: "MT"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "leading-tight",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block font-display text-lg",
								children: "Travel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs text-muted",
								children: "NCC · Gambettola"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "flex items-center gap-1",
						"aria-label": "Principale",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							activeOptions: { exact: true },
							inactiveProps: { className: `${navClass} text-muted` },
							activeProps: { className: `${navClass} bg-surface-2 text-fg` },
							children: "Prenota"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/richieste",
							inactiveProps: { className: `${navClass} text-muted` },
							activeProps: { className: `${navClass} bg-surface-2 text-fg` },
							children: ["Richieste", ready && count > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-2 tabular-nums text-primary",
								children: count
							}) : null]
						})]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1",
				children
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted",
				children: "MT Travel Service · Noleggio con conducente · Gambettola (FC)"
			})
		]
	});
}
var styles_default = "/assets/styles-DmJToQJQ.css";
var APP_NAME = "MT Travel";
var Route$2 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Prenotazione transfer NCC. Auto fino a 3 passeggeri, van fino a 8. Preventivo sul percorso."
			},
			{
				name: "theme-color",
				content: "#101412"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Outfit:wght@400;500;600&display=swap"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "it",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$1 = () => import("./routes-rskn6LYP.mjs").then((n) => n.t);
var Route$1 = createFileRoute("/")({
	head: () => ({ meta: [{ title: "Prenota · MT Travel" }] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./richieste-BSkHwohe.mjs");
var Route = createFileRoute("/richieste")({
	head: () => ({ meta: [{ title: "Richieste · MT Travel" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var rootRouteChildren = {
	IndexRoute: Route$1.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$2
	}),
	RichiesteRoute: Route.update({
		id: "/richieste",
		path: "/richieste",
		getParentRoute: () => Route$2
	})
};
var routeTree = Route$2._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { toISODate as _, useBookingStore as a, __exportAll as b, EXTRA_PRICES as c, bagsLabel as d, euro as f, peopleLabel as g, kmLabel as h, makeBookingCode as i, VEHICLES as l, formatWhen as m, bookingMessage as n, useStoreReady as o, formatDuration as p, mailHref as r, whatsappHref as s, router_exports as t, buildQuote as u, validEmail as v, validPhone as y };
