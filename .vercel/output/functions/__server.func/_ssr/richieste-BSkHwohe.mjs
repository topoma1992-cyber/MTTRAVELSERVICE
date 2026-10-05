import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as useBookingStore, f as euro, g as peopleLabel, l as VEHICLES, m as formatWhen, n as bookingMessage, o as useStoreReady, s as whatsappHref } from "./router-C6w4PL9B.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/richieste-BSkHwohe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RichiestePage() {
	const ready = useStoreReady();
	const bookings = useBookingStore((state) => state.bookings);
	const removeBooking = useBookingStore((state) => state.removeBooking);
	const [pendingId, setPendingId] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto w-full max-w-3xl px-4 py-6 lg:py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-primary",
				children: "Archivio locale"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl",
				children: "Richieste"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-muted",
				children: "Restano su questo telefono o computer. Dal dettaglio puoi riaprire il messaggio su WhatsApp."
			}),
			!ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-8 text-muted",
				children: "Carico le richieste…"
			}) : null,
			ready && bookings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 rounded-lg border border-border bg-surface p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Nessuna richiesta su questo dispositivo." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-4 inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 font-medium text-primary-fg",
					children: "Prenota un transfer"
				})]
			}) : null,
			ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-6 grid gap-3",
				children: bookings.map((booking) => {
					const text = bookingMessage(booking);
					const removing = pendingId === booking.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-lg border border-border bg-surface p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-2xl",
									children: booking.code
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-primary",
									children: "Da confermare"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: formatWhen(booking.trip.date, booking.trip.time)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3",
								children: [
									booking.trip.origin.label,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: " → "
									}),
									booking.trip.destination.label
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm text-muted",
								children: [
									VEHICLES[booking.trip.vehicle].name,
									" · ",
									peopleLabel(booking.trip.passengers),
									booking.trip.roundTrip ? " · A/R" : ""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 font-display text-3xl tabular-nums",
								children: euro(booking.quote.total)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3",
								children: [
									booking.customer.firstName,
									" ",
									booking.customer.lastName
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "text-primary",
										href: `tel:${booking.customer.phone.replace(/\s/g, "")}`,
										children: booking.customer.phone
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: " · "
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "text-primary",
										href: `mailto:${booking.customer.email}`,
										children: booking.customer.email
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: whatsappHref(text),
									target: "_blank",
									rel: "noreferrer",
									className: "inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg",
									children: "WhatsApp"
								}), removing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										removeBooking(booking.id);
										setPendingId(null);
									},
									className: "inline-flex h-11 items-center rounded-md border border-border px-4 text-sm",
									children: "Elimina"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setPendingId(null),
									className: "inline-flex h-11 items-center px-3 text-sm text-muted",
									children: "Annulla"
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setPendingId(booking.id),
									className: "inline-flex h-11 items-center rounded-md border border-border px-4 text-sm",
									children: "Rimuovi"
								})]
							})
						]
					}, booking.id);
				})
			}) : null
		]
	});
}
//#endregion
export { RichiestePage as component };
