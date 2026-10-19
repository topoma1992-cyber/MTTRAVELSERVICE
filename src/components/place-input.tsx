import { LocateFixed } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { PRESETS, reversePlace, searchPlaces } from "@/lib/geo";
import type { Place } from "@/lib/types";

const control =
  "h-12 w-full rounded-md border bg-bg px-3 text-base text-fg placeholder:text-muted";

type Props = {
  label: string;
  place: Place | null;
  onPlace: (place: Place | null) => void;
  onIncomplete?: (dirty: boolean) => void;
  error?: string;
  presets?: boolean;
  locate?: boolean;
  mapActive?: boolean;
  onMapRequest?: () => void;
  placeholder?: string;
};

export function PlaceInput({
  label,
  place,
  onPlace,
  onIncomplete,
  error,
  presets = false,
  locate = false,
  mapActive = false,
  onMapRequest,
  placeholder,
}: Props) {
  const { t } = useI18n();
  const placePlaceholder = placeholder ?? t("placePh");
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(place?.label ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    if (place) setQuery(place.label);
  }, [place]);

  const dirty = query.trim().length > 0 && (!place || query !== place.label);
  const dirtyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    onIncomplete?.(dirty);
  }, [dirty, onIncomplete]);

  useEffect(() => {
    if (query.trim().length < 3 || (place && query === place.label)) {
      setSuggestions([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearchError("");
      void searchPlaces(query.trim(), controller.signal)
        .then((found) => {
          setSuggestions(found);
          setOpen(true);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setSuggestions([]);
          setSearchError(t("searchOff"));
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setSearched(true);
          }
        });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, place]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function applyHouse(value: string) {
    if (!place) return;
    const house = value.replace(/[^\dA-Za-z/]/g, "").slice(0, 8);
    const base = place.baseLabel ?? place.label;
    const comma = base.indexOf(",");
    const head = (comma === -1 ? base : base.slice(0, comma)).trim();
    const tail = comma === -1 ? "" : base.slice(comma + 1).trim();
    const line = house ? `${head} ${house}` : head;
    onPlace({
      ...place,
      house,
      houseSource: "manual",
      baseLabel: base,
      label: tail ? `${line}, ${tail}` : line,
    });
  }

  function pick(next: Place) {
    onPlace(next);
    setQuery(next.label);
    setOpen(false);
    setSuggestions([]);
    setLocError("");
  }

  async function locateMe() {
    if (!navigator.geolocation) {
      setLocError(t("geoOff"));
      return;
    }
    setLocating(true);
    setLocError("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60_000,
        });
      });
      const found = await reversePlace(pos.coords.latitude, pos.coords.longitude);
      pick(found);
    } catch {
      setLocError(t("geoFail"));
    } finally {
      setLocating(false);
    }
  }

  return (
    <div ref={wrapRef} className="grid gap-2" data-invalid={error ? "true" : undefined}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor={listId}>
          {label}
        </label>
        {onMapRequest ? (
          <button
            type="button"
            onClick={onMapRequest}
            className={`inline-flex min-h-11 items-center text-sm ${mapActive ? "font-semibold text-primary" : "text-primary"}`}
          >
            {mapActive ? t("onMapOn") : t("onMap")}
          </button>
        ) : null}
        {locate ? (
          <button
            type="button"
            onClick={() => void locateMe()}
            disabled={locating}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-primary disabled:opacity-60"
          >
            <LocateFixed className="size-4" aria-hidden="true" />
            {locating ? t("locating") : t("here")}
          </button>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={listId}
          value={query}
          placeholder={placePlaceholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          className={`${control} ${error ? "border-primary" : "border-border"}`}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (place && next !== place.label) onPlace(null);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && suggestions[0]) pick(suggestions[0]);
            }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {open && (loading || suggestions.length > 0 || searchError || (searched && dirty)) ? (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
            {loading ? <li className="px-3 py-3 text-sm text-muted">{t("searching")}</li> : null}
            {searchError ? <li className="px-3 py-3 text-sm text-muted">{searchError}</li> : null}
            {!loading && searched && !searchError && suggestions.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted">{t("searchEmpty")}</li>
            ) : null}
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.label}-${suggestion.lat}`}>
                <button
                  type="button"
                  className="w-full px-3 py-3 text-left text-sm hover:bg-surface-2"
                  onClick={() => pick(suggestion)}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {presets ? (
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {PRESETS.map((preset) => {
            const selected = place?.label === preset.place.label;
            return (
              <button
                key={preset.chip}
                type="button"
                onClick={() => pick(preset.place)}
                className={`shrink-0 rounded-full border px-3 py-2 text-sm ${
                  selected ? "border-primary bg-primary text-primary-fg" : "border-border text-fg"
                }`}
              >
                {preset.chip}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? <p className="text-sm font-medium text-primary">{error}</p> : null}
      {place && (place.houseSource === "missing" || place.houseSource === "manual") ? (
        <label className="grid gap-1 text-sm">
          {t("houseNumber")}
          <input
            value={place.house ?? ""}
            inputMode="text"
            autoComplete="off"
            placeholder={t("housePh")}
            className={`${control} border-border`}
            onChange={(event) => applyHouse(event.target.value)}
          />
        </label>
      ) : null}
      {locError ? <p className="text-sm text-muted">{locError}</p> : null}
    </div>
  );
}
