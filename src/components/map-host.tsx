import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { MapData } from "@/lib/types";

export function MapHost({
  data,
  picking = false,
  onPick,
  scrollSignal = "",
}: {
  data: MapData;
  picking?: boolean;
  onPick?: (lat: number, lon: number) => void;
  scrollSignal?: string;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const pickRef = useRef(onPick);
  const apiRef = useRef<{
    update: (next: MapData) => void;
    setPick: (handler: ((lat: number, lon: number) => void) | null) => void;
    centerOn: (lat: number, lon: number) => void;
    destroy: () => void;
  } | null>(null);
  const [booted, setBooted] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");
  dataRef.current = data;
  pickRef.current = onPick;

  useEffect(() => {
    let dead = false;
    let api: typeof apiRef.current = null;
    void import("./leaflet-map").then((mod) => {
      if (dead || !host.current) return;
      api = mod.mountMap(host.current);
      apiRef.current = api;
      api.setPick((lat, lon) => pickRef.current?.(lat, lon));
      api.update(dataRef.current);
      setBooted(true);
    });
    return () => {
      dead = true;
      api?.destroy();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!booted) return;
    apiRef.current?.update(data);
  }, [booted, data]);

  useEffect(() => {
    if (!scrollSignal) return;
    frame.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [scrollSignal]);

  async function centerGps() {
    if (!navigator.geolocation) {
      setGpsError(t("geoOff"));
      return;
    }
    setGpsBusy(true);
    setGpsError("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60_000,
        });
      });
      apiRef.current?.centerOn(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setGpsError(t("geoFail"));
    } finally {
      setGpsBusy(false);
    }
  }

  return (
    <div ref={frame} className={`relative h-full min-h-64 w-full scroll-mt-20 ${picking ? "map-picking" : ""}`}>
      <div ref={host} className="h-full w-full" />
      <button
        type="button"
        onClick={() => void centerGps()}
        disabled={gpsBusy}
        className="absolute left-3 top-3 z-[1000] inline-flex h-10 items-center rounded-md bg-surface px-3 text-sm font-medium text-fg shadow-md disabled:opacity-60"
      >
        {gpsBusy ? t("locating") : t("mapGps")}
      </button>
      {gpsError ? (
        <p className="absolute left-3 top-14 z-[1000] max-w-[14rem] rounded-md bg-surface px-3 py-2 text-sm text-primary">{gpsError}</p>
      ) : null}
    </div>
  );
}