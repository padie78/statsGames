/**
 * Live Client Data API (local) — vía futura para alertas in-match.
 *
 * Endpoint local mientras el cliente de LoL está en partida:
 *   https://127.0.0.1:2999/liveclientdata/allgamedata
 *
 * Limitaciones Riot:
 * - Expone stats del jugador local y datos generales visibles.
 * - NO expone coordenadas exactas de enemigos (anti-cheat).
 * - Sí puede alimentar path aproximado del jugador + hitos de combate visibles.
 *
 * Integración prevista: companion Electron/Overwolf → webhook StatsGames
 * con `mapTelemetry.source = 'live_client'`.
 */

export interface LiveClientPosition {
  x: number;
  y: number;
}

export interface LiveClientPlayerSnapshot {
  riotIdGameName?: string;
  championName?: string;
  level?: number;
  currentGold?: number;
  scores?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    creepScore?: number;
    wardScore?: number;
  };
  /** Posición del jugador local si el companion la deriva (no siempre en allgamedata). */
  position?: LiveClientPosition;
}

export interface LiveClientMapSample {
  gameTimeSec: number;
  sampledAtIso: string;
  player: LiveClientPlayerSnapshot;
  /** Eventos detectados por delta (kills/deaths/objectives) entre samples. */
  events?: Array<{
    type: string;
    label?: string;
    atGameTimeSec: number;
  }>;
}

export const LIVE_CLIENT_ALL_GAME_DATA_URL =
  'https://127.0.0.1:2999/liveclientdata/allgamedata';

export function isLiveClientSample(value: unknown): value is LiveClientMapSample {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row['gameTimeSec'] === 'number' && typeof row['sampledAtIso'] === 'string';
}
