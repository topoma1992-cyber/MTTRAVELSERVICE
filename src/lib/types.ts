export type VehicleId = "car" | "van";

export type Place = {
  label: string;
  lat: number;
  lon: number;
  house?: string;
  houseSource?: "auto" | "missing" | "manual";
  baseLabel?: string;
};

export type Pin = {
  lat: number;
  lon: number;
  kind: "a" | "b" | "s";
  label: string;
};

export type MapData = {
  pins: Pin[];
  line: [number, number][];
};

export type RouteResult = {
  km: number;
  minutes: number;
  outboundKm: number;
  outboundMinutes: number;
  line: [number, number][];
  estimated: boolean;
};
