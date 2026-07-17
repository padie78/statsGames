import type { MatchUpdateView } from '../services/match.service';
import type {
  MatchMapEvent,
  MatchMapEventType,
  MatchMapPoint,
  MatchMapTelemetry,
  MatchMapTelemetryPayload,
  MatchMapTelemetrySource,
} from '../core/telemetry/match-map-telemetry.types';
import { isFortnitePlatform } from './match-display.util';
import {
  buildMockMatchMapTelemetry,
  formatMapTime,
  interpolatePath,
} from './match-map-telemetry.mock';

export { formatMapTime, interpolatePath } from './match-map-telemetry.mock';

const RIFT_MAP_ASSET = '/assets/maps/summoners-rift-mvp.svg';
const RIFT_MAX = 15_000;

interface PoiAnchor {
  name: string;
  x: number;
  y: number;
}

/** Landmarks normalizados (SVG: y crece hacia abajo; blue base abajo-izq). */
const RIFT_POIS: PoiAnchor[] = [
  { name: 'Blue Base', x: 0.12, y: 0.88 },
  { name: 'Red Base', x: 0.88, y: 0.12 },
  { name: 'Top Lane', x: 0.18, y: 0.35 },
  { name: 'Mid Lane', x: 0.5, y: 0.5 },
  { name: 'Bot Lane', x: 0.72, y: 0.82 },
  { name: 'Dragon Pit', x: 0.62, y: 0.62 },
  { name: 'Baron Pit', x: 0.38, y: 0.38 },
  { name: 'Blue Jungle', x: 0.28, y: 0.55 },
  { name: 'Red Jungle', x: 0.72, y: 0.45 },
  { name: 'River', x: 0.5, y: 0.48 },
];

const ROLE_LANE: Record<string, PoiAnchor[]> = {
  TOP: [
    RIFT_POIS[0],
    RIFT_POIS[2],
    RIFT_POIS[7],
    RIFT_POIS[3],
    RIFT_POIS[6],
    RIFT_POIS[1],
  ],
  JUNGLE: [
    RIFT_POIS[0],
    RIFT_POIS[7],
    RIFT_POIS[5],
    RIFT_POIS[3],
    RIFT_POIS[6],
    RIFT_POIS[8],
    RIFT_POIS[1],
  ],
  MIDDLE: [
    RIFT_POIS[0],
    RIFT_POIS[3],
    RIFT_POIS[9],
    RIFT_POIS[5],
    RIFT_POIS[6],
    RIFT_POIS[1],
  ],
  BOTTOM: [
    RIFT_POIS[0],
    RIFT_POIS[4],
    RIFT_POIS[5],
    RIFT_POIS[3],
    RIFT_POIS[1],
  ],
  UTILITY: [
    RIFT_POIS[0],
    RIFT_POIS[4],
    RIFT_POIS[5],
    RIFT_POIS[9],
    RIFT_POIS[3],
    RIFT_POIS[1],
  ],
  SUPPORT: [
    RIFT_POIS[0],
    RIFT_POIS[4],
    RIFT_POIS[5],
    RIFT_POIS[9],
    RIFT_POIS[3],
    RIFT_POIS[1],
  ],
};

export function isLolPlatform(platform: string): boolean {
  const p = platform.toLowerCase();
  return p === 'league_of_legends' || p === 'lol';
}

export function resolveMatchMapTelemetry(match: MatchUpdateView): MatchMapTelemetry | null {
  if (isFortnitePlatform(match.platform)) {
    return buildMockMatchMapTelemetry(match);
  }
  if (isLolPlatform(match.platform)) {
    return resolveLolMatchMapTelemetry(match);
  }
  return null;
}

export function resolveLolMatchMapTelemetry(match: MatchUpdateView): MatchMapTelemetry {
  const fromStats = normalizeMapTelemetryPayload(match.stats?.mapTelemetry);
  if (fromStats && fromStats.path.length > 0) {
    return toViewTelemetry(match, fromStats);
  }
  return buildSyntheticLolMapTelemetry(match);
}

function toViewTelemetry(
  match: MatchUpdateView,
  payload: MatchMapTelemetryPayload,
): MatchMapTelemetry {
  const isPreview =
    payload.source === 'synthetic' || payload.source === 'fortnite_preview';

  return {
    matchId: match.matchId,
    platform: match.platform,
    seasonId: 'SR',
    seasonLabel: seasonLabelFor(payload.source, match),
    mapAssetUrl: RIFT_MAP_ASSET,
    durationSec: payload.durationSec,
    path: payload.path,
    events: payload.events,
    source: payload.source,
    isPreview,
  };
}

function seasonLabelFor(source: MatchMapTelemetrySource, match: MatchUpdateView): string {
  const champ = match.stats?.champion ? ` · ${match.stats.champion}` : '';
  const role = match.stats?.role ? ` · ${match.stats.role}` : '';
  if (source === 'riot_timeline_v5') {
    return `Grieta del Invocador · Timeline-V5${champ}${role}`;
  }
  if (source === 'live_client') {
    return `Grieta del Invocador · Live Client${champ}${role}`;
  }
  return `Grieta del Invocador · preview estimado${champ}${role}`;
}

export function normalizeMapTelemetryPayload(
  raw: unknown,
): MatchMapTelemetryPayload | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const path = Array.isArray(row['path'])
    ? (row['path'] as unknown[])
        .map(normalizePoint)
        .filter((point): point is MatchMapPoint => point != null)
    : [];
  const events = Array.isArray(row['events'])
    ? (row['events'] as unknown[])
        .map(normalizeEvent)
        .filter((event): event is MatchMapEvent => event != null)
    : [];
  const durationSec = Number(row['durationSec'] ?? 0);
  if (!path.length || !(durationSec > 0)) return null;

  const source = normalizeSource(row['source']);
  return {
    source,
    durationSec: Math.round(durationSec),
    path,
    events,
    participantId:
      typeof row['participantId'] === 'number' ? row['participantId'] : undefined,
    coordinateSpace:
      row['coordinateSpace'] && typeof row['coordinateSpace'] === 'object'
        ? {
            maxX: Number((row['coordinateSpace'] as Record<string, unknown>)['maxX'] ?? RIFT_MAX),
            maxY: Number((row['coordinateSpace'] as Record<string, unknown>)['maxY'] ?? RIFT_MAX),
          }
        : { maxX: RIFT_MAX, maxY: RIFT_MAX },
  };
}

function normalizeSource(raw: unknown): MatchMapTelemetrySource {
  if (
    raw === 'riot_timeline_v5' ||
    raw === 'live_client' ||
    raw === 'synthetic' ||
    raw === 'fortnite_preview'
  ) {
    return raw;
  }
  return 'synthetic';
}

function normalizePoint(raw: unknown): MatchMapPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const t = Number(row['t']);
  const x = Number(row['x']);
  const y = Number(row['y']);
  if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { t: Math.max(0, Math.round(t)), x: clamp01(x), y: clamp01(y) };
}

function normalizeEvent(raw: unknown): MatchMapEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const point = normalizePoint(raw);
  if (!point) return null;
  const type = String(row['type'] ?? 'rotate') as MatchMapEventType;
  return {
    ...point,
    type: isEventType(type) ? type : 'rotate',
    poi: row['poi'] != null ? String(row['poi']) : undefined,
    label: row['label'] != null ? String(row['label']) : undefined,
    detail: row['detail'] != null ? String(row['detail']) : undefined,
    impact: row['impact'] != null ? String(row['impact']) : undefined,
  };
}

function isEventType(value: string): value is MatchMapEventType {
  return [
    'spawn',
    'kill',
    'death',
    'assist',
    'storm',
    'rotate',
    'damage',
    'loot',
    'objective',
    'turret',
    'dragon',
    'baron',
    'ward',
  ].includes(value);
}

/** Preview local cuando aún no hay Timeline-V5 en stats. */
export function buildSyntheticLolMapTelemetry(match: MatchUpdateView): MatchMapTelemetry {
  const stats = match.stats ?? {};
  const seed = hashString(match.matchId);
  const kills = Number(stats.kills ?? 0);
  const deaths = Number(stats.deaths ?? 0);
  const assists = Number(stats.assists ?? 0);
  const durationSec = Math.max(600, Number(stats.durationSec ?? 1680));
  const role = String(stats.role ?? 'MIDDLE').toUpperCase();
  const waypoints = ROLE_LANE[role] ?? ROLE_LANE['MIDDLE'];
  const path = buildPathFromWaypoints(waypoints, durationSec, seed);
  const events = buildSyntheticLolEvents({
    path,
    durationSec,
    kills,
    deaths,
    assists,
    won: stats.won === true,
    teamBarons: Number(stats.teamBarons ?? 0),
    teamDragons: Number(stats.teamDragons ?? 0),
    teamTowers: Number(stats.teamTowers ?? 0),
    champion: stats.champion ? String(stats.champion) : undefined,
    role,
  });

  return toViewTelemetry(match, {
    source: 'synthetic',
    durationSec,
    path,
    events,
    coordinateSpace: { maxX: RIFT_MAX, maxY: RIFT_MAX },
  });
}

function buildPathFromWaypoints(
  waypoints: PoiAnchor[],
  durationSec: number,
  seed: number,
): MatchMapPoint[] {
  const segments = Math.max(waypoints.length - 1, 1);
  const points: MatchMapPoint[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const from = waypoints[segment] ?? RIFT_POIS[0];
    const to = waypoints[segment + 1] ?? RIFT_POIS[3];
    const steps = 6 + ((seed + segment) % 4);
    const segmentStart = (durationSec / segments) * segment;
    const segmentEnd = (durationSec / segments) * (segment + 1);

    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const jitter = pseudoRandom(seed, segment, step) * 0.03 - 0.015;
      points.push({
        t: Math.round(segmentStart + (segmentEnd - segmentStart) * ratio),
        x: clamp01(from.x + (to.x - from.x) * ratio + jitter),
        y: clamp01(from.y + (to.y - from.y) * ratio + jitter * 0.7),
      });
    }
  }

  return dedupeByTime(points);
}

function buildSyntheticLolEvents(input: {
  path: MatchMapPoint[];
  durationSec: number;
  kills: number;
  deaths: number;
  assists: number;
  won: boolean;
  teamBarons: number;
  teamDragons: number;
  teamTowers: number;
  champion?: string;
  role: string;
}): MatchMapEvent[] {
  const events: MatchMapEvent[] = [];
  const spawn = input.path[0] ?? { t: 0, x: 0.12, y: 0.88 };
  const champ = input.champion ?? 'tu campeón';

  events.push({
    t: 0,
    type: 'spawn',
    x: spawn.x,
    y: spawn.y,
    poi: 'Blue Base',
    label: 'Salida de base',
    detail: `${champ} (${input.role}) sale de base. Path estimado por rol hasta que llegue Timeline-V5.`,
    impact: 'Inicio',
  });

  distributeTimes(input.durationSec, input.kills, 0.12, 0.85).forEach((t, index) => {
    const point = interpolatePath(input.path, t);
    const poi = nearestPoi(point);
    events.push({
      t,
      type: 'kill',
      x: point.x,
      y: point.y,
      poi: poi.name,
      label: `Kill #${index + 1}`,
      detail: `Eliminación cerca de ${poi.name}. Coordenada estimada (sin frame Riot).`,
      impact: '+1 kill',
    });
  });

  distributeTimes(input.durationSec, Math.min(input.assists, 4), 0.18, 0.8).forEach((t, index) => {
    const point = interpolatePath(input.path, t);
    const poi = nearestPoi(point);
    events.push({
      t,
      type: 'assist',
      x: point.x,
      y: point.y,
      poi: poi.name,
      label: `Assist #${index + 1}`,
      detail: `Asistencia en pelea cerca de ${poi.name}.`,
      impact: '+1 assist',
    });
  });

  if (input.teamDragons > 0) {
    const t = Math.round(input.durationSec * 0.42);
    events.push({
      t,
      type: 'dragon',
      x: 0.62,
      y: 0.62,
      poi: 'Dragon Pit',
      label: 'Dragón del equipo',
      detail: `Tu equipo cerró dragón (${input.teamDragons} en la partida).`,
      impact: `×${input.teamDragons} dragon`,
    });
  }

  if (input.teamBarons > 0) {
    const t = Math.round(input.durationSec * 0.72);
    events.push({
      t,
      type: 'baron',
      x: 0.38,
      y: 0.38,
      poi: 'Baron Pit',
      label: 'Barón Nashor',
      detail: `Barón asegurado (${input.teamBarons}). Ventana de push.`,
      impact: 'Baron',
    });
  }

  if (input.teamTowers > 0) {
    const t = Math.round(input.durationSec * 0.55);
    const point = interpolatePath(input.path, t);
    events.push({
      t,
      type: 'turret',
      x: point.x,
      y: point.y,
      poi: nearestPoi(point).name,
      label: 'Torre del equipo',
      detail: `Torres del equipo: ${input.teamTowers}. Hito de presión de mapa.`,
      impact: `×${input.teamTowers} torres`,
    });
  }

  distributeTimes(input.durationSec, input.deaths, 0.2, 0.9).forEach((t, index) => {
    const point = interpolatePath(input.path, t);
    const poi = nearestPoi(point);
    events.push({
      t,
      type: 'death',
      x: point.x,
      y: point.y,
      poi: poi.name,
      label: `Death #${index + 1}`,
      detail: `Caída en ${poi.name}. Con Timeline-V5 se marca la coordenada exacta del kill event.`,
      impact: '−1',
    });
  });

  const end = interpolatePath(input.path, input.durationSec);
  events.push({
    t: input.durationSec,
    type: 'loot',
    x: end.x,
    y: end.y,
    poi: nearestPoi(end).name,
    label: input.won ? 'Victoria' : 'Derrota',
    detail: input.won
      ? 'Cierre de partida. Revisá rotaciones a objetivos mid/late.'
      : 'Cierre en derrota. Revisá deaths en zonas sin visión.',
    impact: input.won ? 'Win' : 'Loss',
  });

  return events.sort((a, b) => a.t - b.t);
}

function distributeTimes(
  duration: number,
  count: number,
  startRatio: number,
  endRatio: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round(duration * ((startRatio + endRatio) / 2))];
  const start = duration * startRatio;
  const end = duration * endRatio;
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(start + step * index));
}

function nearestPoi(point: MatchMapPoint): PoiAnchor {
  return RIFT_POIS.reduce((best, poi) => {
    const bestDist = Math.hypot(best.x - point.x, best.y - point.y);
    const poiDist = Math.hypot(poi.x - point.x, poi.y - point.y);
    return poiDist < bestDist ? poi : best;
  });
}

function dedupeByTime(points: MatchMapPoint[]): MatchMapPoint[] {
  const seen = new Set<number>();
  return points.filter((point) => {
    if (seen.has(point.t)) return false;
    seen.add(point.t);
    return true;
  });
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pseudoRandom(seed: number, a: number, b: number): number {
  const mixed = (seed ^ (a * 374761393) ^ (b * 668265263)) >>> 0;
  return (mixed % 10_000) / 10_000;
}

function clamp01(value: number): number {
  return Math.max(0.02, Math.min(0.98, value));
}

/** Convierte coordenada Riot (0–15000) a overlay 0–1 (Y invertida). */
export function riotPositionToNorm(x: number, y: number, max = RIFT_MAX): MatchMapPoint {
  return {
    t: 0,
    x: clamp01(x / max),
    y: clamp01(1 - y / max),
  };
}
