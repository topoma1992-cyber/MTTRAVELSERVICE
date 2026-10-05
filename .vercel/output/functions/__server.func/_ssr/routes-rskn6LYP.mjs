import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as PawPrint, c as Mail, d as CupSoda, f as Copy, g as Baby, h as BusFront, i as Plane, l as Luggage, m as Car, n as Trash2, o as Minus, p as Check, r as Plus, s as MessageCircle, u as LocateFixed } from "../_libs/lucide-react.mjs";
import { _ as toISODate, a as useBookingStore, b as __exportAll, c as EXTRA_PRICES, d as bagsLabel, f as euro, g as peopleLabel, h as kmLabel, i as makeBookingCode, l as VEHICLES, m as formatWhen, n as bookingMessage, p as formatDuration, r as mailHref, s as whatsappHref, u as buildQuote, v as validEmail, y as validPhone } from "./router-C6w4PL9B.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-rskn6LYP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MAP_CENTER = {
	lat: 44.15,
	lon: 12.28
};
var PRESETS = [
	{
		chip: "Gambettola",
		place: {
			label: "Gambettola",
			lat: 44.1167,
			lon: 12.3336
		}
	},
	{
		chip: "Forlì",
		place: {
			label: "Forlì, centro",
			lat: 44.2227,
			lon: 12.0407
		}
	},
	{
		chip: "Cesena",
		place: {
			label: "Cesena, centro",
			lat: 44.1396,
			lon: 12.2433
		}
	},
	{
		chip: "Cesenatico",
		place: {
			label: "Cesenatico",
			lat: 44.199,
			lon: 12.395
		}
	},
	{
		chip: "Rimini",
		place: {
			label: "Rimini, centro",
			lat: 44.0678,
			lon: 12.5695
		}
	},
	{
		chip: "Aeroporto BLQ",
		place: {
			label: "Aeroporto di Bologna (BLQ)",
			lat: 44.5354,
			lon: 11.2887
		}
	},
	{
		chip: "Aeroporto RMI",
		place: {
			label: "Aeroporto di Rimini (RMI)",
			lat: 44.0203,
			lon: 12.6117
		}
	},
	{
		chip: "Stazione Forlì",
		place: {
			label: "Stazione FS Forlì",
			lat: 44.2242,
			lon: 12.0547
		}
	},
	{
		chip: "Bologna",
		place: {
			label: "Bologna, centro",
			lat: 44.4949,
			lon: 11.3426
		}
	},
	{
		chip: "San Marino",
		place: {
			label: "Città di San Marino",
			lat: 43.9356,
			lon: 12.4473
		}
	}
];
function toPlace(feature) {
	const coords = feature.geometry?.coordinates;
	const props = feature.properties;
	if (!coords || !props) return null;
	const [lon, lat] = coords;
	if (typeof lat !== "number" || typeof lon !== "number") return null;
	const street = [props.street, props.housenumber].filter(Boolean).join(" ");
	const name = props.name && props.name !== props.street ? props.name : "";
	const locality = props.city || props.town || props.village || props.district || "";
	const head = [name, street].filter(Boolean).join(", ") || locality || props.county || "Luogo";
	const tail = [locality, props.state ?? ""].filter((part) => part.length > 0 && !head.includes(part));
	return {
		label: [head, ...[...new Set(tail)]].join(" · "),
		lat,
		lon
	};
}
async function searchPlaces(query, signal) {
	const url = new URL("https://photon.komoot.io/api/");
	url.searchParams.set("q", query);
	url.searchParams.set("limit", "6");
	url.searchParams.set("lat", String(MAP_CENTER.lat));
	url.searchParams.set("lon", String(MAP_CENTER.lon));
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error("geocode");
	const data = await res.json();
	const seen = /* @__PURE__ */ new Set();
	const places = [];
	for (const feature of data.features ?? []) {
		const place = toPlace(feature);
		if (!place) continue;
		const key = `${place.label}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		places.push(place);
	}
	return places;
}
async function reversePlace(lat, lon) {
	const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error("reverse");
		const data = await res.json();
		const place = data.features?.[0] ? toPlace(data.features[0]) : null;
		if (place) return place;
	} catch {}
	return {
		label: "Posizione attuale",
		lat,
		lon
	};
}
function haversineKm(a, b) {
	const R = 6371;
	const dLat = (b.lat - a.lat) * Math.PI / 180;
	const dLon = (b.lon - a.lon) * Math.PI / 180;
	const lat1 = a.lat * Math.PI / 180;
	const lat2 = b.lat * Math.PI / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function estimate(points) {
	let km = 0;
	for (let i = 1; i < points.length; i += 1) km += haversineKm(points[i - 1], points[i]);
	km *= 1.32;
	const minutes = km / 55 * 60;
	return {
		km,
		minutes,
		line: points.map((point) => [point.lat, point.lon]),
		estimated: true
	};
}
async function fetchRoute(points, signal) {
	if (points.length < 2) return {
		km: 0,
		minutes: 0,
		line: [],
		estimated: false
	};
	try {
		const path = points.map((point) => `${point.lon},${point.lat}`).join(";");
		const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`, { signal });
		if (!res.ok) throw new Error("osrm");
		const route = (await res.json()).routes?.[0];
		const coords = route?.geometry?.coordinates;
		if (!route || !coords?.length) throw new Error("empty");
		return {
			km: route.distance / 1e3,
			minutes: route.duration / 60,
			line: coords.map(([lon, lat]) => [lat, lon]),
			estimated: false
		};
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") throw error;
		if (signal.aborted) throw error;
		return estimate(points);
	}
}
async function routeTrip(going, back, signal) {
	const outbound = await fetchRoute(going, signal);
	if (!back) return outbound;
	const inbound = await fetchRoute(back, signal);
	return {
		km: outbound.km + inbound.km,
		minutes: outbound.minutes + inbound.minutes,
		line: [...outbound.line, ...inbound.line],
		estimated: outbound.estimated || inbound.estimated
	};
}
var control$1 = "h-12 w-full rounded-md border bg-bg px-3 text-base text-fg placeholder:text-muted";
function PlaceInput({ label, place, onPlace, onIncomplete, error, presets = false, locate = false, placeholder = "Via, città o luogo" }) {
	const listId = (0, import_react.useId)();
	const wrapRef = (0, import_react.useRef)(null);
	const [query, setQuery] = (0, import_react.useState)(place?.label ?? "");
	const [open, setOpen] = (0, import_react.useState)(false);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [suggestions, setSuggestions] = (0, import_react.useState)([]);
	const [searchError, setSearchError] = (0, import_react.useState)("");
	const [locating, setLocating] = (0, import_react.useState)(false);
	const [locError, setLocError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (place) setQuery(place.label);
	}, [place]);
	const dirty = query.trim().length > 0 && (!place || query !== place.label);
	const dirtyRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (dirtyRef.current === dirty) return;
		dirtyRef.current = dirty;
		onIncomplete?.(dirty);
	}, [dirty, onIncomplete]);
	(0, import_react.useEffect)(() => {
		if (query.trim().length < 3 || place && query === place.label) {
			setSuggestions([]);
			setLoading(false);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setLoading(true);
			setSearchError("");
			searchPlaces(query.trim(), controller.signal).then((found) => {
				setSuggestions(found);
				setOpen(true);
			}).catch((reason) => {
				if (reason instanceof DOMException && reason.name === "AbortError") return;
				setSuggestions([]);
				setSearchError("Ricerca indirizzi non disponibile. Usa una tappa rapida.");
			}).finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		}, 320);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [query, place]);
	(0, import_react.useEffect)(() => {
		function onDoc(event) {
			if (!wrapRef.current?.contains(event.target)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);
	function pick(next) {
		onPlace(next);
		setQuery(next.label);
		setOpen(false);
		setSuggestions([]);
		setLocError("");
	}
	async function locateMe() {
		if (!navigator.geolocation) {
			setLocError("Questo browser non legge la posizione.");
			return;
		}
		setLocating(true);
		setLocError("");
		try {
			const pos = await new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					enableHighAccuracy: true,
					timeout: 8e3,
					maximumAge: 6e4
				});
			});
			pick(await reversePlace(pos.coords.latitude, pos.coords.longitude));
		} catch {
			setLocError("Posizione non disponibile. Scrivi l'indirizzo.");
		} finally {
			setLocating(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: "grid gap-2",
		"data-invalid": error ? "true" : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-sm font-medium",
					htmlFor: listId,
					children: label
				}), locate ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => void locateMe(),
					disabled: locating,
					className: "inline-flex min-h-11 items-center gap-2 text-sm text-primary disabled:opacity-60",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, {
						className: "size-4",
						"aria-hidden": "true"
					}), locating ? "Posizione…" : "Qui"]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: listId,
					value: query,
					placeholder,
					autoComplete: "off",
					role: "combobox",
					"aria-expanded": open,
					"aria-invalid": error ? true : void 0,
					className: `${control$1} ${error ? "border-primary" : "border-border"}`,
					onChange: (event) => {
						const next = event.target.value;
						setQuery(next);
						setOpen(true);
						if (place && next !== place.label) onPlace(null);
					},
					onFocus: () => {
						if (suggestions.length > 0) setOpen(true);
					},
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							if (open && suggestions[0]) pick(suggestions[0]);
						}
						if (event.key === "Escape") setOpen(false);
					}
				}), open && (loading || suggestions.length > 0 || searchError) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg",
					children: [
						loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-3 py-3 text-sm text-muted",
							children: "Cerco…"
						}) : null,
						searchError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-3 py-3 text-sm text-muted",
							children: searchError
						}) : null,
						suggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "w-full px-3 py-3 text-left text-sm hover:bg-surface-2",
							onClick: () => pick(suggestion),
							children: suggestion.label
						}) }, `${suggestion.label}-${suggestion.lat}`))
					]
				}) : null]
			}),
			presets ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex max-w-full gap-2 overflow-x-auto pb-1",
				children: PRESETS.map((preset) => {
					const selected = place?.label === preset.place.label;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => pick(preset.place),
						className: `shrink-0 rounded-full border px-3 py-2 text-sm ${selected ? "border-primary bg-primary text-primary-fg" : "border-border text-fg"}`,
						children: preset.chip
					}, preset.chip);
				})
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium text-primary",
				children: error
			}) : null,
			locError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: locError
			}) : null
		]
	});
}
function MapHost({ data }) {
	const host = (0, import_react.useRef)(null);
	const dataRef = (0, import_react.useRef)(data);
	const apiRef = (0, import_react.useRef)(null);
	const [booted, setBooted] = (0, import_react.useState)(false);
	dataRef.current = data;
	(0, import_react.useEffect)(() => {
		let dead = false;
		let api = null;
		import("./leaflet-map-D9WXUmRW.mjs").then((mod) => {
			if (dead || !host.current) return;
			api = mod.mountMap(host.current);
			apiRef.current = api;
			api.update(dataRef.current);
			setBooted(true);
		});
		return () => {
			dead = true;
			api?.destroy();
			apiRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!booted) return;
		apiRef.current?.update(data);
	}, [booted, data]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: host,
		className: "h-full min-h-64 w-full"
	});
}
function QuoteDetails({ quote, routing }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border bg-surface p-4 sm:p-5",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Preventivo"
				}), routing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm text-muted",
					children: "Aggiorno…"
				}) : null]
			}),
			quote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 font-display text-4xl tabular-nums",
					children: euro(quote.total)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						kmLabel(quote.km),
						" · ",
						formatDuration(quote.minutes),
						quote.estimated ? " · stima" : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
					className: "mt-4 grid gap-2 border-t border-border pt-4",
					children: quote.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-muted",
							children: line.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "tabular-nums",
							children: euro(line.amount)
						})]
					}, line.label))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm text-muted",
					children: quote.estimated ? "Distanza stimata, non sul percorso stradale. Il prezzo può cambiare in conferma." : "Distanza sul percorso stradale. Pedaggi e parcheggi, se dovuti, si concordano in conferma."
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-muted",
				children: "Scegli partenza e arrivo: il prezzo si aggiorna da solo."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Tariffa indicativa. I primi 15 minuti di attesa sono inclusi. Pagamento a bordo, salvo diverso accordo."
			})
		]
	});
}
var control = "h-12 w-full rounded-md border border-border bg-bg px-3 text-base text-fg";
function Qty({ label, value, min, max, onDelta }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": `Diminuisci ${label}`,
				disabled: value <= min,
				onClick: () => onDelta(-1),
				className: "grid size-11 place-items-center rounded-md border border-border bg-bg disabled:opacity-40",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
					className: "size-4",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "w-8 text-center text-lg tabular-nums",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": `Aumenta ${label}`,
				disabled: value >= max,
				onClick: () => onDelta(1),
				className: "grid size-11 place-items-center rounded-md border border-border bg-bg disabled:opacity-40",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
					className: "size-4",
					"aria-hidden": "true"
				})
			})
		]
	});
}
function clampCount(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
function tomorrowDefaults() {
	const now = /* @__PURE__ */ new Date();
	const today = toISODate(now);
	const next = new Date(now);
	next.setDate(next.getDate() + 1);
	return {
		today,
		date: toISODate(next),
		time: "09:00",
		returnTime: "18:00"
	};
}
function BookingPage() {
	const addBooking = useBookingStore((state) => state.addBooking);
	const [formKey, setFormKey] = (0, import_react.useState)(0);
	const [origin, setOrigin] = (0, import_react.useState)(null);
	const [destination, setDestination] = (0, import_react.useState)(null);
	const [originDirty, setOriginDirty] = (0, import_react.useState)(false);
	const [destinationDirty, setDestinationDirty] = (0, import_react.useState)(false);
	const [stops, setStops] = (0, import_react.useState)([]);
	const [roundTrip, setRoundTrip] = (0, import_react.useState)(false);
	const [date, setDate] = (0, import_react.useState)("");
	const [time, setTime] = (0, import_react.useState)("");
	const [returnDate, setReturnDate] = (0, import_react.useState)("");
	const [returnTime, setReturnTime] = (0, import_react.useState)("");
	const [today, setToday] = (0, import_react.useState)("");
	const [passengers, setPassengers] = (0, import_react.useState)(1);
	const [luggage, setLuggage] = (0, import_react.useState)(1);
	const [vehicle, setVehicle] = (0, import_react.useState)("car");
	const [childSeats, setChildSeats] = (0, import_react.useState)(0);
	const [boosters, setBoosters] = (0, import_react.useState)(0);
	const [meetGreet, setMeetGreet] = (0, import_react.useState)(false);
	const [pet, setPet] = (0, import_react.useState)(false);
	const [refreshments, setRefreshments] = (0, import_react.useState)(false);
	const [waitMinutes, setWaitMinutes] = (0, import_react.useState)(0);
	const [flight, setFlight] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [firstName, setFirstName] = (0, import_react.useState)("");
	const [lastName, setLastName] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [errors, setErrors] = (0, import_react.useState)({});
	const [route, setRoute] = (0, import_react.useState)(null);
	const [routing, setRouting] = (0, import_react.useState)(false);
	const [sent, setSent] = (0, import_react.useState)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const onOriginDirty = (0, import_react.useCallback)((dirty) => setOriginDirty(dirty), []);
	const onDestinationDirty = (0, import_react.useCallback)((dirty) => setDestinationDirty(dirty), []);
	(0, import_react.useEffect)(() => {
		const next = tomorrowDefaults();
		setToday(next.today);
		setDate(next.date);
		setTime(next.time);
		setReturnDate(next.date);
		setReturnTime(next.returnTime);
	}, []);
	(0, import_react.useEffect)(() => {
		if (passengers > VEHICLES.car.passengers && vehicle === "car") setVehicle("van");
	}, [passengers, vehicle]);
	(0, import_react.useEffect)(() => {
		const maxBags = VEHICLES[vehicle].bagsMax;
		if (luggage > maxBags) setLuggage(maxBags);
	}, [vehicle, luggage]);
	(0, import_react.useEffect)(() => {
		if (childSeats + boosters <= passengers) return;
		const nextSeats = Math.min(childSeats, passengers);
		const nextBoosters = Math.min(boosters, Math.max(0, passengers - nextSeats));
		if (nextSeats !== childSeats) setChildSeats(nextSeats);
		if (nextBoosters !== boosters) setBoosters(nextBoosters);
	}, [
		passengers,
		childSeats,
		boosters
	]);
	const resolvedStops = (0, import_react.useMemo)(() => stops.map((stop) => stop.place).filter((place) => Boolean(place)), [stops]);
	const routeKey = (0, import_react.useMemo)(() => {
		if (!origin || !destination) return "";
		return `${[
			origin,
			...resolvedStops,
			destination
		].map((place) => `${place.lat},${place.lon}`).join(";")}|${roundTrip ? "r" : "o"}`;
	}, [
		origin,
		destination,
		resolvedStops,
		roundTrip
	]);
	(0, import_react.useEffect)(() => {
		if (!origin || !destination || !routeKey) {
			setRoute(null);
			setRouting(false);
			return;
		}
		const controller = new AbortController();
		setRouting(true);
		routeTrip([
			origin,
			...resolvedStops,
			destination
		], roundTrip ? [destination, origin] : null, controller.signal).then((next) => {
			if (!controller.signal.aborted) setRoute(next);
		}).catch((reason) => {
			if (reason instanceof DOMException && reason.name === "AbortError") return;
			if (!controller.signal.aborted) setRoute(null);
		}).finally(() => {
			if (!controller.signal.aborted) setRouting(false);
		});
		return () => controller.abort();
	}, [
		routeKey,
		origin,
		destination,
		resolvedStops,
		roundTrip
	]);
	const quote = (0, import_react.useMemo)(() => {
		if (!route) return null;
		return buildQuote({
			vehicle,
			km: route.km,
			minutes: route.minutes,
			estimated: route.estimated,
			roundTrip,
			date,
			time,
			returnDate,
			returnTime,
			luggage,
			childSeats,
			boosters,
			meetGreet,
			pet,
			refreshments,
			waitMinutes,
			stopCount: resolvedStops.length
		});
	}, [
		route,
		vehicle,
		roundTrip,
		date,
		time,
		returnDate,
		returnTime,
		luggage,
		childSeats,
		boosters,
		meetGreet,
		pet,
		refreshments,
		waitMinutes,
		resolvedStops.length
	]);
	const mapData = (0, import_react.useMemo)(() => {
		const pins = [];
		if (origin) pins.push({
			...origin,
			kind: "a"
		});
		for (const stop of resolvedStops) pins.push({
			...stop,
			kind: "s"
		});
		if (destination) pins.push({
			...destination,
			kind: "b"
		});
		return {
			pins,
			line: route?.line ?? []
		};
	}, [
		origin,
		destination,
		resolvedStops,
		route
	]);
	function validate() {
		const next = {};
		if (!origin) next.origin = originDirty ? "Seleziona un risultato dall'elenco." : "Indica la partenza.";
		if (!destination) next.destination = destinationDirty ? "Seleziona un risultato dall'elenco." : "Indica l'arrivo.";
		if (origin && destination && origin.lat === destination.lat && origin.lon === destination.lon) next.destination = "L'arrivo coincide con la partenza.";
		if (stops.some((stop) => stop.dirty && !stop.place)) next.stops = "Seleziona ogni fermata dall'elenco, oppure rimuovila.";
		if (!date) next.date = "Indica la data.";
		if (!time) next.time = "Indica l'orario.";
		if (date && time) {
			const when = /* @__PURE__ */ new Date(`${date}T${time}`);
			if (Number.isNaN(when.getTime())) next.date = "Data non valida.";
			else if (when.getTime() < Date.now() - 3e5) next.date = "Scegli un orario da adesso in poi.";
		}
		if (roundTrip) {
			if (!returnDate || !returnTime) next.returnDate = "Indica data e ora del ritorno.";
			else if (date && time) {
				const outbound = (/* @__PURE__ */ new Date(`${date}T${time}`)).getTime();
				if ((/* @__PURE__ */ new Date(`${returnDate}T${returnTime}`)).getTime() <= outbound) next.returnDate = "Il ritorno deve essere dopo l'andata.";
			}
		}
		if (passengers > VEHICLES[vehicle].passengers) next.vehicle = "Troppi passeggeri per questo veicolo.";
		if (firstName.trim().length < 2) next.firstName = "Scrivi il nome.";
		if (lastName.trim().length < 2) next.lastName = "Scrivi il cognome.";
		if (!validPhone(phone)) next.phone = "Inserisci un telefono valido, anche con prefisso.";
		if (!validEmail(email)) next.email = "Inserisci una email valida.";
		if (!route) next.route = "Attendi il calcolo del percorso prima di inviare.";
		return next;
	}
	function onSubmit(event) {
		event.preventDefault();
		if (!origin || !destination || !quote || !route) {
			const next = validate();
			setErrors(next);
			window.requestAnimationFrame(() => {
				document.querySelector("[data-invalid='true']")?.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			});
			return;
		}
		const next = validate();
		setErrors(next);
		if (Object.keys(next).length > 0) {
			window.requestAnimationFrame(() => {
				document.querySelector("[data-invalid='true']")?.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			});
			return;
		}
		const booking = {
			id: crypto.randomUUID(),
			code: makeBookingCode(),
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			trip: {
				origin,
				destination,
				stops: resolvedStops,
				roundTrip,
				date,
				time,
				returnDate: roundTrip ? returnDate : "",
				returnTime: roundTrip ? returnTime : "",
				passengers,
				luggage,
				vehicle,
				childSeats,
				boosters,
				meetGreet,
				pet,
				refreshments,
				waitMinutes,
				flight: flight.trim()
			},
			customer: {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				phone: phone.trim(),
				email: email.trim(),
				notes: notes.trim()
			},
			quote
		};
		addBooking(booking);
		setSent(booking);
		setCopied(false);
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
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
		setVehicle("car");
		setChildSeats(0);
		setBoosters(0);
		setMeetGreet(false);
		setPet(false);
		setRefreshments(false);
		setWaitMinutes(0);
		setFlight("");
		setNotes("");
		setFirstName("");
		setLastName("");
		setPhone("");
		setEmail("");
		setErrors({});
		setRoute(null);
		setFormKey((value) => value + 1);
		setCopied(false);
	}
	async function copyMessage(booking) {
		const text = bookingMessage(booking);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}
	const vehicleSpec = VEHICLES[vehicle];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5 lg:py-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "quote-rail order-1 flex min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:order-2 lg:col-span-2 lg:self-start lg:overflow-y-auto",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative order-1 h-64 overflow-hidden rounded-lg border border-border lg:order-2 lg:h-56",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapHost, { data: mapData }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pointer-events-none absolute bottom-8 left-3 max-w-xs rounded-md bg-surface/95 px-3 py-2 text-sm text-muted",
						children: origin && destination ? routing ? "Calcolo il percorso…" : "A partenza · B arrivo" : "Il percorso compare quando scegli partenza e arrivo."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "order-2 lg:hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Preventivo"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-3xl tabular-nums",
						children: quote ? euro(quote.total) : "—"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "order-3 hidden lg:order-1 lg:block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuoteDetails, {
						quote,
						routing
					}), sent ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						form: "booking-form",
						disabled: routing,
						className: "mt-3 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50",
						children: routing ? "Calcolo percorso…" : "Invia richiesta"
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "order-2 min-w-0 lg:order-1 lg:col-span-3",
			children: sent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Confirmation, {
				booking: sent,
				copied,
				onCopy: () => void copyMessage(sent),
				onReset: reset
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-primary",
					children: "Prenotazione NCC"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 font-display text-4xl",
					children: "Il transfer, con conducente."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-xl text-muted",
					children: "Auto fino a 3 passeggeri o van fino a 8. Distanza, orario ed extra entrano nel preventivo prima di inviare la richiesta."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					id: "booking-form",
					className: "mt-6 grid gap-4",
					onSubmit,
					noValidate: true,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-lg border border-border bg-surface p-4 sm:p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
								className: "mb-4 flex items-baseline justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl",
									children: "Il viaggio"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm text-muted",
									children: "01"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceInput, {
										label: "Partenza",
										place: origin,
										onPlace: setOrigin,
										onIncomplete: onOriginDirty,
										error: errors.origin,
										presets: true,
										locate: true
									}, `${formKey}-origin`),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceInput, {
										label: "Arrivo",
										place: destination,
										onPlace: setDestination,
										onIncomplete: onDestinationDirty,
										error: errors.destination,
										presets: true
									}, `${formKey}-destination`),
									stops.map((stop, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid gap-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "min-w-0 flex-1",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaceInput, {
													label: `Fermata ${index + 1}`,
													place: stop.place,
													onPlace: (place) => setStops((rows) => rows.map((row) => row.id === stop.id ? {
														...row,
														place
													} : row)),
													onIncomplete: (dirty) => setStops((rows) => rows.map((row) => row.id === stop.id ? {
														...row,
														dirty
													} : row)),
													placeholder: "Sosta intermedia"
												})
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												"aria-label": `Rimuovi fermata ${index + 1}`,
												onClick: () => setStops((rows) => rows.filter((row) => row.id !== stop.id)),
												className: "mt-7 grid size-11 shrink-0 place-items-center rounded-md border border-border",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
													className: "size-4",
													"aria-hidden": "true"
												})
											})]
										})
									}, stop.id)),
									errors.stops ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium text-primary",
										"data-invalid": "true",
										children: errors.stops
									}) : null,
									stops.length < 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setStops((rows) => [...rows, {
											id: crypto.randomUUID(),
											place: null,
											dirty: false
										}]),
										className: "inline-flex min-h-11 items-center gap-2 self-start text-sm text-primary",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
												className: "size-4",
												"aria-hidden": "true"
											}),
											"Aggiungi una fermata",
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-muted",
												children: ["+ ", euro(EXTRA_PRICES.stop)]
											})
										]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-medium",
											children: "Andata e ritorno"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: "Il ritorno è calcolato senza le fermate."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											role: "switch",
											"aria-checked": roundTrip,
											onClick: () => setRoundTrip((value) => !value),
											className: `relative h-7 w-12 rounded-full ${roundTrip ? "bg-primary" : "bg-surface-2"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 size-5 rounded-full bg-fg ${roundTrip ? "left-6" : "left-1"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "sr-only",
												children: "Andata e ritorno"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "grid gap-2",
											"data-invalid": errors.date ? "true" : void 0,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm font-medium",
												children: "Data"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "date",
												required: true,
												min: today || void 0,
												value: date,
												onChange: (event) => setDate(event.target.value),
												className: control
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "grid gap-2",
											"data-invalid": errors.time ? "true" : void 0,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm font-medium",
												children: "Ora"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "time",
												required: true,
												value: time,
												onChange: (event) => setTime(event.target.value),
												className: control
											})]
										})]
									}),
									errors.date || errors.time ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium text-primary",
										children: errors.date || errors.time
									}) : null,
									roundTrip ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										"data-invalid": errors.returnDate ? "true" : void 0,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "grid gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-medium",
													children: "Data ritorno"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "date",
													min: date || today || void 0,
													value: returnDate,
													onChange: (event) => setReturnDate(event.target.value),
													className: control
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "grid gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-sm font-medium",
													children: "Ora ritorno"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "time",
													value: returnTime,
													onChange: (event) => setReturnTime(event.target.value),
													className: control
												})]
											}),
											errors.returnDate ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-medium text-primary sm:col-span-2",
												children: errors.returnDate
											}) : null
										]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: "Volo o treno"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: flight,
											maxLength: 40,
											placeholder: "Numero, facoltativo",
											onChange: (event) => setFlight(event.target.value),
											className: control
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: "Attesa prevista"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: waitMinutes,
											onChange: (event) => setWaitMinutes(Number(event.target.value)),
											className: control,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 0,
													children: "Nessuna attesa extra"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 15,
													children: "15 min · inclusi"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 30,
													children: "30 min"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 45,
													children: "45 min"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 60,
													children: "60 min"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 90,
													children: "90 min"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 120,
													children: "120 min"
												})
											]
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-lg border border-border bg-surface p-4 sm:p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
								className: "mb-4 flex items-baseline justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl",
									children: "Veicolo ed extra"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm text-muted",
									children: "02"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-4 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium",
												children: "Passeggeri"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qty, {
												label: "passeggeri",
												value: passengers,
												min: 1,
												max: 8,
												onDelta: (delta) => setPassengers((current) => clampCount(current + delta, 1, 8))
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium",
												children: "Bagagli"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qty, {
												label: "bagagli",
												value: luggage,
												min: 0,
												max: vehicleSpec.bagsMax,
												onDelta: (delta) => setLuggage((current) => clampCount(current + delta, 0, VEHICLES[vehicle].bagsMax))
											})]
										})]
									}),
									passengers > VEHICLES.car.passengers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "Oltre 3 passeggeri si prenota il van."
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										role: "radiogroup",
										"aria-label": "Veicolo",
										"data-invalid": errors.vehicle ? "true" : void 0,
										children: Object.values(VEHICLES).map((option) => {
											const selected = vehicle === option.id;
											const blocked = passengers > option.passengers;
											const Icon = option.id === "car" ? Car : BusFront;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												role: "radio",
												"aria-checked": selected,
												disabled: blocked,
												onClick: () => setVehicle(option.id),
												className: `rounded-lg border p-4 text-left disabled:opacity-40 ${selected ? "border-primary bg-surface-2" : "border-border bg-bg"}`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "flex items-center justify-between gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
															className: "size-5 text-primary",
															"aria-hidden": "true"
														}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
															className: "size-4 text-primary",
															"aria-hidden": "true"
														}) : null]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "mt-3 block font-display text-2xl",
														children: option.name
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "mt-1 block text-sm text-muted",
														children: [
															option.detail,
															" · max ",
															option.passengers,
															" passeggeri"
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "mt-2 block text-sm tabular-nums",
														children: [
															euro(option.perKm),
															" / km · minimo ",
															euro(option.minimum)
														]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "mt-1 block text-sm text-muted",
														children: [option.bagsIncluded, " bagagli inclusi"]
													})
												]
											}, option.id);
										})
									}),
									errors.vehicle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium text-primary",
										children: errors.vehicle
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-2 text-sm",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Baby, {
														className: "size-4 text-primary",
														"aria-hidden": "true"
													}),
													"Seggiolino · ",
													euro(EXTRA_PRICES.childSeat)
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qty, {
												label: "seggiolini",
												value: childSeats,
												min: 0,
												max: Math.max(0, Math.min(3, passengers - boosters)),
												onDelta: (delta) => setChildSeats((current) => clampCount(current + delta, 0, Math.max(0, Math.min(3, passengers - boosters))))
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-2 text-sm",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Luggage, {
														className: "size-4 text-primary",
														"aria-hidden": "true"
													}),
													"Alzatina · ",
													euro(EXTRA_PRICES.booster)
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Qty, {
												label: "alzatine",
												value: boosters,
												min: 0,
												max: Math.max(0, Math.min(3, passengers - childSeats)),
												onDelta: (delta) => setBoosters((current) => clampCount(current + delta, 0, Math.max(0, Math.min(3, passengers - childSeats))))
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
												pressed: meetGreet,
												onClick: () => setMeetGreet((value) => !value),
												icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plane, {
													className: "size-4",
													"aria-hidden": "true"
												}),
												label: "Meet & greet",
												hint: "Cartello in aeroporto o stazione",
												price: euro(EXTRA_PRICES.meetGreet)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
												pressed: pet,
												onClick: () => setPet((value) => !value),
												icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PawPrint, {
													className: "size-4",
													"aria-hidden": "true"
												}),
												label: "Animale in auto",
												hint: "Con trasportino",
												price: euro(EXTRA_PRICES.pet)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
												pressed: refreshments,
												onClick: () => setRefreshments((value) => !value),
												icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CupSoda, {
													className: "size-4",
													"aria-hidden": "true"
												}),
												label: "Acqua e snack",
												hint: "A bordo",
												price: euro(EXTRA_PRICES.refreshments)
											})
										]
									}),
									luggage > vehicleSpec.bagsIncluded ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-sm text-muted",
										children: [
											luggage - vehicleSpec.bagsIncluded,
											" bagagli oltre gli inclusi, a ",
											euro(EXTRA_PRICES.extraBag),
											" ciascuno."
										]
									}) : null
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "rounded-lg border border-border bg-surface p-4 sm:p-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
								className: "mb-4 flex items-baseline justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl",
									children: "Chi viaggia"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm text-muted",
									children: "03"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 sm:grid-cols-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Nome",
										error: errors.firstName,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: firstName,
											autoComplete: "given-name",
											onChange: (event) => setFirstName(event.target.value),
											className: control
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Cognome",
										error: errors.lastName,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: lastName,
											autoComplete: "family-name",
											onChange: (event) => setLastName(event.target.value),
											className: control
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Telefono",
										error: errors.phone,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "tel",
											inputMode: "tel",
											autoComplete: "tel",
											placeholder: "+39",
											value: phone,
											onChange: (event) => setPhone(event.target.value),
											className: control
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Email",
										error: errors.email,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "email",
											inputMode: "email",
											autoComplete: "email",
											value: email,
											onChange: (event) => setEmail(event.target.value),
											className: control
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid gap-2 sm:col-span-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: "Note"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											value: notes,
											maxLength: 500,
											rows: 3,
											placeholder: "Orario volo, seggiolino, indicazioni per il ritiro",
											onChange: (event) => setNotes(event.target.value),
											className: "min-h-28 w-full rounded-md border border-border bg-bg px-3 py-3 text-base text-fg placeholder:text-muted"
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuoteDetails, {
								quote,
								routing
							})
						}),
						errors.route ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium text-primary",
							"data-invalid": "true",
							children: errors.route
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: routing,
							className: "inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg disabled:opacity-50 lg:hidden",
							children: routing ? "Calcolo percorso…" : "Invia richiesta"
						})
					]
				})
			] })
		})]
	});
}
function Field({ label, error, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "grid gap-2",
		"data-invalid": error ? "true" : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			children,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium text-primary",
				children: error
			}) : null
		]
	});
}
function Toggle({ pressed, onClick, icon, label, hint, price }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"aria-pressed": pressed,
		onClick,
		className: `flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-3 text-left ${pressed ? "border-primary bg-surface-2" : "border-border bg-bg"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-primary",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-sm text-muted",
					children: hint
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular-nums text-sm",
				children: price
			})
		]
	});
}
function Confirmation({ booking, copied, onCopy, onReset }) {
	const text = bookingMessage(booking);
	const { trip, customer, quote } = booking;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-lg border border-border bg-surface p-4 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-primary",
				children: "Richiesta pronta"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl",
				children: booking.code
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-muted",
				children: [
					customer.firstName,
					" ",
					customer.lastName,
					" · ",
					formatWhen(trip.date, trip.time)
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid gap-2 border-t border-dashed border-border pt-5 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "Da "
					}), trip.origin.label] }),
					trip.stops.map((stop) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "Fermata "
					}), stop.label] }, `${stop.lat}-${stop.label}`)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted",
						children: "A "
					}), trip.destination.label] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						VEHICLES[trip.vehicle].name,
						" · ",
						peopleLabel(trip.passengers),
						" · ",
						bagsLabel(trip.luggage),
						trip.roundTrip ? " · andata e ritorno" : ""
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-3xl tabular-nums",
						children: euro(quote.total)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-muted",
				children: "La richiesta resta su questo dispositivo, in Richieste. Inviala su WhatsApp o per email: il testo è già compilato."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid gap-2 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: whatsappHref(text),
						target: "_blank",
						rel: "noreferrer",
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, {
							className: "size-4",
							"aria-hidden": "true"
						}), "WhatsApp"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: mailHref(booking, text),
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-4 font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Email"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onCopy,
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border px-4 font-medium",
						children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
							className: "size-4",
							"aria-hidden": "true"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
							className: "size-4",
							"aria-hidden": "true"
						}), copied ? "Copiato" : "Copia testo"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onReset,
						className: "inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-medium",
						children: "Nuova richiesta"
					})
				]
			})
		]
	});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => SplitComponent });
var SplitComponent = BookingPage;
//#endregion
export { MAP_CENTER as n, routes_exports as t };
