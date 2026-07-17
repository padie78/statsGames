/**
 * Contrato de telemetría de mapa (Fortnite companion / Riot Timeline-V5 / Live Client).
 * Coordenadas siempre normalizadas 0–1 para el overlay SVG.
 */

export type MatchMapEventType =
  | 'spawn'
  | 'kill'
  | 'death'
  | 'assist'
  | 'storm'
  | 'rotate'
  | 'damage'
  | 'loot'
  | 'objective'
  | 'turret'
  | 'dragon'
  | 'baron'
  | 'ward';

export type MatchMapTelemetrySource =
  | 'riot_timeline_v5'
  | 'live_client'
  | 'synthetic'
  | 'fortnite_preview';

export interface MatchMapPoint {
  /** Segundos desde el inicio de la partida. */
  t: number;
  /** Coordenada normalizada 0–1 sobre el mapa. */
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

export interface MatchMapTelemetryPayload {
  source: MatchMapTelemetrySource;
  durationSec: number;
  path: MatchMapPoint[];
  events: MatchMapEvent[];
  /** Espacio Riot original (opcional; path ya viene normalizado). */
  coordinateSpace?: {
    maxX: number;
    maxY: number;
  };
  participantId?: number;
}

export interface MatchMapTelemetry {
  matchId: string;
  platform: string;
  seasonId: string;
  seasonLabel: string;
  mapAssetUrl: string;
  durationSec: number;
  path: MatchMapPoint[];
  events: MatchMapEvent[];
  source: MatchMapTelemetrySource;
  isPreview: boolean;
}
