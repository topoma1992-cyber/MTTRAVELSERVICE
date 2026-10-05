import type { Place, RouteResult } from "@/lib/types";

export const MAP_CENTER = { lat: 44.15, lon: 12.28 };

export const PRESETS: { chip: string; place: Place }[] = [
  { chip: "Gambettola", place: { label: "Gambettola", lat: 44.1167, lon: 12.3336 } },
  { chip: "Forlì", place: { label: "Forlì, centro", lat: 44.2227, lon: 12.0407 } },
  { chip: "Cesena", place: { label: "Cesena, centro", lat: 44.1396, lon: 12.2433 } },
  { chip: "Cesenatico", place: { label: "Cesenatico", lat: 44.199, lon: 12.395 } },
  { chip: "Rimini", place: { label: "Rimini, centro", lat: 44.0678, lon: 12.5695 } },
  { chip: "Aeroporto BLQ", place: { label: "Aeroporto di Bologna (BLQ)", lat: 44.5354, lon: 11.2887 } },
  { chip: "Aeroporto RMI", place: { label: "Aeroporto di Rimini (RMI)", lat: 44.0203, lon: 12.6117 } },
  { chip: "Stazione Forlì", place: { label: "Stazione FS Forlì", lat: 44.2242, lon: 12.0547 } },
  { chip: "Bologna", place: { label: "Bologna, centro", lat: 44.4949, lon: 11.3426 } },
  { chip: "San Marino", place: { label: "Città di San Marino", lat: 43.9356, lon: 12.4473 } },
];

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

function toPlace(feature: PhotonFeature): Place | null {
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
  const uniqueTail = [...new Set(tail)];
  return { label: [head, ...uniqueTail].join(" · "), lat, lon };
}

const SEARCH_STOP = new Set([
  "via",
  "viale",
  "piazza",
  "corso",
  "largo",
  "piazzale",
  "strada",
  "di",
  "del",
  "della",
  "dei",
  "delle",
  "il",
  "la",
  "le",
  "in",
  "al",
]);

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function queryTokens(query: string) {
  return fold(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !SEARCH_STOP.has(token));
}

type Hit = Place & { city: string; street: string; house: string; name: string };

type AddressQuery = { street: string; number: string; city: string };

function parseAddress(query: string): AddressQuery | null {
  const cleaned = query.replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const num = cleaned.match(/\b(\d+[a-zA-Z]?)\b/);
  if (!num?.[1]) return null;
  const number = num[1];
  const rest = cleaned.replace(num[0], " ").replace(/\s+/g, " ").trim();
  if (rest.length < 3) return null;
  const parts = rest.split(" ");
  const hasStreet = /^(via|viale|piazza|piazzale|corso|largo|strada|vicolo|contrada)\b/i.test(rest);
  if (hasStreet && parts.length >= 3) {
    return { street: parts.slice(0, -1).join(" "), number, city: parts[parts.length - 1] ?? "" };
  }
  if (!hasStreet && parts.length >= 2) {
    return { street: parts.slice(0, -1).join(" "), number, city: parts[parts.length - 1] ?? "" };
  }
  return { street: rest, number, city: "" };
}

type NominatimHit = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    state?: string;
  };
};

function rankHit(hit: Hit, query: string) {
  const tokens = queryTokens(query).filter((token) => !/^\d+$/.test(token));
  const label = fold(hit.label);
  const city = fold(hit.city);
  const name = fold(hit.name);
  const number = query.match(/\b(\d+[a-z]?)\b/i)?.[1]?.toLowerCase() ?? "";
  let score = 0;
  let streetHits = 0;
  let nameHits = 0;
  for (const token of tokens) {
    if (name.includes(token) && token !== city) {
      score += 14;
      nameHits += 1;
    } else if (fold(hit.street).includes(token)) {
      score += 12;
      streetHits += 1;
    } else if (city === token || city.startsWith(token)) score += 5;
    else if (label.includes(token)) score += 4;
  }
  const house = fold(hit.house);
  const exactHouse = Boolean(number) && house === number;
  if (number && exactHouse) score += 40;
  else if (number && house && house !== number) score -= 25;
  const unmatched = tokens.filter(
    (token) => !name.includes(token) && !fold(hit.street).includes(token) && city !== token && !city.startsWith(token),
  );
  if (unmatched.length > 0 && streetHits === 0 && nameHits === 0) score -= 6;
  return { score, streetHits: streetHits + nameHits, exactHouse };
}

function fromNominatim(hit: NominatimHit): Hit | null {
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = hit.address ?? {};
  const city = address.city || address.town || address.village || address.hamlet || address.municipality || "";
  const house = address.house_number || "";
  const streetName = address.road || (hit.name && !/^parco\b/i.test(hit.name) ? hit.name : "") || "";
  const line = [address.road, house].filter(Boolean).join(" ");
  const name = hit.name && !/^parco\b/i.test(hit.name) ? hit.name : "";
  const head = name && line && name !== line ? `${name}, ${line}` : line || name || city || hit.display_name?.split(",")[0] || "Luogo";
  const label = city && !head.toLowerCase().includes(city.toLowerCase()) ? `${head}, ${city}` : head;
  return { label, lat, lon, city, street: streetName, house, name };
}

async function nominatimSearch(
  query: string,
  signal: AbortSignal,
  options?: { limit?: number; viewbox?: string; bounded?: boolean; layer?: string },
) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "it");
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set("layer", options?.layer ?? "address");
  url.searchParams.set("limit", String(options?.limit ?? 8));
  if (options?.viewbox) {
    url.searchParams.set("viewbox", options.viewbox);
    if (options.bounded) url.searchParams.set("bounded", "1");
  }
  const res = await fetch(url, { signal, headers: { "Accept-Language": "it" } });
  if (!res.ok) throw new Error("nominatim");
  const data = (await res.json()) as NominatimHit[];
  return data.map(fromNominatim).filter((place): place is Hit => Boolean(place));
}

async function nominatimHouse(parsed: AddressQuery, signal: AbortSignal) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("street", `${parsed.number} ${parsed.street}`);
  if (parsed.city) url.searchParams.set("city", parsed.city);
  url.searchParams.set("country", "Italia");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "it");
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set("limit", "5");
  const res = await fetch(url, { signal, headers: { "Accept-Language": "it" } });
  if (!res.ok) throw new Error("nominatim");
  const data = (await res.json()) as NominatimHit[];
  return data.map(fromNominatim).filter((place): place is Hit => Boolean(place));
}

function knownPlaces(query: string): Hit[] {
  const compact = fold(query).replace(/[^a-z0-9]+/g, "");
  const aliases = ["mttravel", "mttravelservice", "mttransport", "mariotopo"];
  if (!aliases.some((alias) => compact.includes(alias))) return [];
  return [
    {
      label: "MT TRAVEL SERVICE, Via Grazia Deledda 12, Gambettola",
      lat: 44.11676,
      lon: 12.34566,
      city: "Gambettola",
      street: "Via Grazia Deledda",
      house: "12",
      name: "MT TRAVEL SERVICE",
    },
  ];
}

async function esriSearch(query: string, signal: AbortSignal): Promise<Hit[]> {
  const suggest = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest");
  suggest.searchParams.set("f", "json");
  suggest.searchParams.set("text", query);
  suggest.searchParams.set("countryCode", "ITA");
  suggest.searchParams.set("maxSuggestions", "6");
  suggest.searchParams.set("location", `${MAP_CENTER.lon},${MAP_CENTER.lat}`);
  const listed = await fetch(suggest, { signal });
  if (!listed.ok) throw new Error("esri");
  const data = (await listed.json()) as { suggestions?: Array<{ text?: string; magicKey?: string }> };
  const suggestions = (data.suggestions ?? []).filter((item) => item.text && item.magicKey).slice(0, 5);
  const resolved = await Promise.all(
    suggestions.map(async (item) => {
      const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
      url.searchParams.set("f", "json");
      url.searchParams.set("magicKey", item.magicKey ?? "");
      url.searchParams.set("singleLine", item.text ?? "");
      url.searchParams.set("maxLocations", "1");
      url.searchParams.set("outFields", "PlaceName,Place_addr,City,StAddr");
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        candidates?: Array<{
          location?: { x?: number; y?: number };
          attributes?: { PlaceName?: string; Place_addr?: string; City?: string; StAddr?: string };
        }>;
      };
      const candidate = body.candidates?.[0];
      const lat = candidate?.location?.y;
      const lon = candidate?.location?.x;
      if (typeof lat !== "number" || typeof lon !== "number") return null;
      const attrs = candidate?.attributes ?? {};
      const name = attrs.PlaceName || item.text?.split(",")[0] || "";
      const city = attrs.City || "";
      const street = attrs.StAddr || "";
      const house = street.match(/\b(\d+[a-zA-Z]?)\b/)?.[1] ?? "";
      const addr = (attrs.Place_addr || item.text || "").replace(/, ITA$/, "");
      const head = name && addr && !addr.toLowerCase().startsWith(name.toLowerCase()) ? `${name}, ${addr}` : addr || name;
      const label = head.replace(/, ITA$/, "");
      const hit: Hit = { label, lat, lon, city, street, house, name };
      return hit;
    }),
  );
  return resolved.filter((place): place is Hit => Boolean(place));
}

async function photonSearch(query: string, signal: AbortSignal, lat?: number, lon?: number) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("bbox", "6.6,36.6,18.8,47.1");
  if (lat !== undefined && lon !== undefined) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("photon");
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const places: Hit[] = [];
  for (const feature of data.features ?? []) {
    const place = toPlace(feature);
    if (!place) continue;
    const props = feature.properties;
    const city = props?.city || props?.town || props?.village || "";
    const name = props?.name || "";
    const street = props?.street || "";
    const house = props?.housenumber || "";
    if (/^parco\b/i.test(name) && !/^parco\b/i.test(query)) continue;
    const label = house && street && !place.label.includes(house) ? place.label.replace(street, `${street} ${house}`) : place.label;
    places.push({ ...place, label, city, street, house, name });
  }
  return places;
}

function collect(hits: Hit[], query: string) {
  const seen = new Set<string>();
  const ranked: Array<{ place: Place; score: number; streetHits: number; exactHouse: boolean }> = [];
  for (const hit of hits) {
    const key = `${hit.lat.toFixed(4)}|${fold(hit.name)}|${fold(hit.house)}|${fold(hit.street)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { score, streetHits, exactHouse } = rankHit(hit, query);
    if (score < 4) continue;
    ranked.push({
      place: {
        label: hit.label,
        lat: hit.lat,
        lon: hit.lon,
        house: hit.house || undefined,
        houseSource: hit.house ? "auto" : "missing",
      },
      score,
      streetHits,
      exactHouse,
    });
  }
  ranked.sort((a, b) => Number(b.exactHouse) - Number(a.exactHouse) || b.score - a.score);
  return ranked;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const streetLike = /^(via|viale|piazza|piazzale|corso|largo|strada|vicolo|contrada)\b/i.test(query.trim());
  const parsed = streetLike ? parseAddress(query) : null;
  const [addresses, places, localPhoton, widePhoton, houses, esri] = await Promise.all([
    nominatimSearch(query, signal).catch(() => [] as Hit[]),
    nominatimSearch(query, signal, { layer: "poi" }).catch(() => [] as Hit[]),
    photonSearch(query, signal, MAP_CENTER.lat, MAP_CENTER.lon).catch(() => [] as Hit[]),
    photonSearch(query, signal).catch(() => [] as Hit[]),
    parsed ? nominatimHouse(parsed, signal).catch(() => [] as Hit[]) : Promise.resolve([] as Hit[]),
    esriSearch(query, signal).catch(() => [] as Hit[]),
  ]);
  if (signal.aborted) return [];
  let hits = [...knownPlaces(query), ...esri, ...houses, ...places, ...addresses, ...localPhoton, ...widePhoton];
  let ranked = collect(hits, query);
  const found = ranked.some((item) => item.streetHits > 0);
  const parts = query.trim().split(/\s+/).filter((part) => part.length > 2 && !/^\d+$/.test(part));
  if (!found && parts.length >= 2) {
    const localityName = parts[parts.length - 1] ?? "";
    const escaped = localityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const streetQuery = query.replace(new RegExp(`\\b${escaped}\\b`, "i"), "").replace(/\s+/g, " ").trim();
    const locality = await nominatimSearch(localityName, signal, { limit: 1 }).catch(() => [] as Hit[]);
    const city = locality[0];
    if (city && streetQuery.length > 2) {
      const span = 0.35;
      const viewbox = `${city.lon - span},${city.lat + span},${city.lon + span},${city.lat - span}`;
      const [nearAddress, nearPlaces, nearPhoton] = await Promise.all([
        nominatimSearch(streetQuery, signal, { viewbox, bounded: true, limit: 6 }).catch(() => [] as Hit[]),
        nominatimSearch(streetQuery, signal, { viewbox, bounded: true, limit: 6, layer: "poi" }).catch(() => [] as Hit[]),
        photonSearch(streetQuery, signal, city.lat, city.lon).catch(() => [] as Hit[]),
      ]);
      hits = [...nearPlaces, ...nearAddress, ...nearPhoton, ...hits];
      ranked = collect(hits, query);
    }
  }
  const exact = streetLike ? ranked.filter((item) => item.exactHouse) : [];
  const list = (exact.length > 0 ? exact : ranked).slice(0, 8).map((item) => item.place);
  if (list.length === 0 && hits.length === 0) throw new Error("geocode");
  return list;
}

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "it");
    const res = await fetch(url, { headers: { "Accept-Language": "it" } });
    if (res.ok) {
      const data = (await res.json()) as NominatimHit;
      const place = fromNominatim(data);
      if (place) return { label: place.label, lat, lon };
    }
  } catch {
    /* prova il secondo servizio */
  }
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("reverse");
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const place = data.features?.[0] ? toPlace(data.features[0]) : null;
    if (place) return { ...place, lat, lon };
  } catch {
    /* fall through */
  }
  return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimate(points: { lat: number; lon: number }[]): RouteResult {
  let km = 0;
  for (let i = 1; i < points.length; i += 1) {
    km += haversineKm(points[i - 1], points[i]);
  }
  km *= 1.32;
  const minutes = (km / 55) * 60;
  return {
    km,
    minutes,
    outboundKm: km,
    outboundMinutes: minutes,
    line: points.map((point) => [point.lat, point.lon]),
    estimated: true,
  };
}

export async function fetchRoute(
  points: { lat: number; lon: number }[],
  signal: AbortSignal,
): Promise<RouteResult> {
  if (points.length < 2) return { km: 0, minutes: 0, outboundKm: 0, outboundMinutes: 0, line: [], estimated: false };
  try {
    const path = points.map((point) => `${point.lon},${point.lat}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,
      { signal },
    );
    if (!res.ok) throw new Error("osrm");
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[];
    };
    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!route || !coords?.length) throw new Error("empty");
    return {
      km: route.distance / 1000,
      minutes: route.duration / 60,
      outboundKm: route.distance / 1000,
      outboundMinutes: route.duration / 60,
      line: coords.map(([lon, lat]) => [lat, lon]),
      estimated: false,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    if (signal.aborted) throw error;
    return estimate(points);
  }
}

export async function routeTrip(
  going: { lat: number; lon: number }[],
  back: { lat: number; lon: number }[] | null,
  signal: AbortSignal,
): Promise<RouteResult> {
  const outbound = await fetchRoute(going, signal);
  if (!back) return outbound;
  const inbound = await fetchRoute(back, signal);
  return {
    km: outbound.km + inbound.km,
    minutes: outbound.minutes + inbound.minutes,
    outboundKm: outbound.km,
    outboundMinutes: outbound.minutes,
    line: [...outbound.line, ...inbound.line],
    estimated: outbound.estimated || inbound.estimated,
  };
}
