import { i as __toESM } from "../_runtime.mjs";
import { n as MAP_CENTER } from "./routes-rskn6LYP.mjs";
import { t as require_leaflet_src } from "../_libs/leaflet.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/leaflet-map-D9WXUmRW.js
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src());
function leafletApi() {
	const mod = import_leaflet_src;
	if (typeof mod.map === "function") return mod;
	if (mod.default && typeof mod.default.map === "function") return mod.default;
	return mod;
}
function mountMap(el) {
	const L = leafletApi();
	const map = L.map(el, {
		zoomControl: false,
		attributionControl: true
	}).setView([MAP_CENTER.lat, MAP_CENTER.lon], 9);
	L.control.zoom({ position: "topright" }).addTo(map);
	L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
		attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>",
		subdomains: "abcd",
		maxZoom: 19
	}).addTo(map);
	const group = L.layerGroup().addTo(map);
	let lastFit = "";
	const update = (data) => {
		group.clearLayers();
		const color = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
		if (data.line.length > 1) L.polyline(data.line, {
			color: color || "#d4b483",
			weight: 4,
			opacity: .92
		}).addTo(group);
		for (const pin of data.pins) {
			const mark = pin.kind === "a" ? "A" : pin.kind === "b" ? "B" : "•";
			const icon = L.divIcon({
				className: "mt-pin",
				html: `<span class="mt-pin-dot mt-pin-${pin.kind}">${mark}</span>`,
				iconSize: [28, 28],
				iconAnchor: [14, 14]
			});
			L.marker([pin.lat, pin.lon], {
				icon,
				title: pin.label,
				keyboard: false
			}).addTo(group);
		}
		const signature = data.line.length ? `${data.line[0]?.join(",")}|${data.line[data.line.length - 1]?.join(",")}|${data.line.length}|${data.pins.length}` : data.pins.map((pin) => `${pin.lat},${pin.lon}`).join(";");
		if (signature && signature !== lastFit) {
			lastFit = signature;
			const bounds = data.line.length > 1 ? L.latLngBounds(data.line) : L.latLngBounds(data.pins.map((pin) => [pin.lat, pin.lon]));
			if (bounds.isValid()) map.fitBounds(bounds, {
				padding: [28, 28],
				maxZoom: 13
			});
		}
		map.invalidateSize();
	};
	const observer = new ResizeObserver(() => map.invalidateSize());
	observer.observe(el);
	window.setTimeout(() => map.invalidateSize(), 180);
	return {
		update,
		destroy() {
			observer.disconnect();
			map.remove();
		}
	};
}
//#endregion
export { mountMap };
