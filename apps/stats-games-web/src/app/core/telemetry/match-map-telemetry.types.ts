export type MatchMapEventType =
  | 'spawn'
  | 'kill'
  | 'death'
  | 'storm'
  | 'rotate'
  | 'damage'
  | 'loot';

export interface MatchMapPoint {
  /** Segundos desde el inicio de la partida. */
  t: number;
  /** Coordenada normalizada 0–1 sobre el mapa de la season. */
  x: number;
  y: number;
}

export interface MatchMapEvent {
  t: number;
  type: MatchMapEventType;
  x: number;
  y: number;
  poi?: string;
  label?: string;
  /** Resumen corto de lo que pasó en este punto. */
  detail?: string;
  /** Impacto rápido (ej. +1 kill). */
  impact?: string;
}

export interface MatchMapTelemetry {
  matchId: string;
  seasonId: string;
  seasonLabel: string;
  mapAssetUrl: string;
  durationSec: number;
  path: MatchMapPoint[];
  events: MatchMapEvent[];
  isPreview: boolean;
}
