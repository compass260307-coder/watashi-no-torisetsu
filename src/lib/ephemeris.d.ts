export type PlanetPosition = { sign: string; degree: number };

export type NatalChart = {
  source: string;
  datetime_utc: string;
  location: { latitude: number; longitude: number };
  houses_available: boolean;
  planets?: Record<string, PlanetPosition>;
  asc?: PlanetPosition;
  mc?: PlanetPosition;
};

export function computeNatalChart(opts: { dateIso: string; latitude?: number; longitude?: number; timezone?: string; timeUnknown?: boolean }): NatalChart;
