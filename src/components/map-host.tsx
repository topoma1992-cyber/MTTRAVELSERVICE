import { useEffect, useRef, useState } from "react";
import type { MapData } from "@/lib/types";

export function MapHost({
  data,
  picking = false,
  onPick,
}: {
  data: MapData;
  picking?: boolean;
  onPick?: (lat: number, lon: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const pickRef = useRef(onPick);
  const apiRef = useRef<{
    update: (next: MapData) => void;
    setPick: (handler: ((lat: number, lon: number) => void) | null) => void;
    destroy: () => void;
  } | null>(null);
  const [booted, setBooted] = useState(false);
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

  return (
    <div className={`h-full min-h-64 w-full ${picking ? "map-picking" : ""}`}>
      <div ref={host} className="h-full w-full" />
    </div>
  );
}
