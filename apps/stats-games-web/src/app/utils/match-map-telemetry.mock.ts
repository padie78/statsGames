import type { MatchUpdateView } from '../services/match.service';
import type {
  MatchMapEvent,
  MatchMapPoint,
  MatchMapTelemetry,
} from '../core/telemetry/match-map-telemetry.types';
import { isFortnitePlatform } from './match-display.util';

interface PoiAnchor {
  name: string;
  x: number;
  y: number;
}

const FORTNITE_MVP_POIS: PoiAnchor[] = [
  { name: 'Coastal Drop', x: 0.18, y: 0.72 },
  { name: 'Harbor Hub', x: 0.28, y: 0.58 },
  { name: 'Central Plaza', x: 0.48, y: 0.46 },
  { name: 'Highland Ridge', x: 0.62, y: 0.32 },
  { name: 'Storm Edge', x: 0.74, y: 0.52 },
  { name: 'Final Zone', x: 0.55, y: 0.62 },
];

const MAP_ASSET = '/assets/maps/fortnite-island-mvp.svg';

export function resolveMatchMapTelemetry(match: MatchUpdateView): MatchMapTelemetry | null {
  if (!isFortnitePlatform(match.platform)) return null;
  return buildMockMatchMapTelemetry(match);
}

export function buildMockMatchMapTelemetry(match: MatchUpdateView): MatchMapTelemetry {
  const seed = hashString(match.matchId);
  const kills = match.stats?.kills ?? 2;
  const deaths = match.stats?.deaths ?? 1;
  const placement = match.stats?.placement ?? 12;

  const durationSec = 420 + (seed % 180);
  const path = buildMockPath(seed, durationSec);
  const events = buildMockEvents({
    seed,
    path,
    kills,
    deaths,
    placement,
    durationSec,
  });

  return {
    matchId: match.matchId,
    seasonId: 'CH7S1',
    seasonLabel: 'Capítulo 7 · Season 1 (preview)',
    mapAssetUrl: MAP_ASSET,
    durationSec,
    path,
    events,
    isPreview: true,
  };
}

function buildMockPath(seed: number, durationSec: number): MatchMapPoint[] {
  const waypoints = pickWaypoints(seed);
  const segments = Math.max(waypoints.length - 1, 1);
  const points: MatchMapPoint[] = [];

  for (let segment = 0; segment < segments; segment += 1) {
    const from = waypoints[segment] ?? FORTNITE_MVP_POIS[0];
    const to = waypoints[segment + 1] ?? FORTNITE_MVP_POIS[1];
    const steps = 8 + ((seed + segment) % 5);
    const segmentStart = (durationSec / segments) * segment;
    const segmentEnd = (durationSec / segments) * (segment + 1);

    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const jitter = pseudoRandom(seed, segment, step) * 0.035 - 0.017;
      points.push({
        t: Math.round(segmentStart + (segmentEnd - segmentStart) * ratio),
        x: clamp01(from.x + (to.x - from.x) * ratio + jitter),
        y: clamp01(from.y + (to.y - from.y) * ratio + jitter * 0.8),
      });
    }
  }

  return dedupeByTime(points);
}

function buildMockEvents(input: {
  seed: number;
  path: MatchMapPoint[];
  kills: number;
  deaths: number;
  placement: number;
  durationSec: number;
}): MatchMapEvent[] {
  const events: MatchMapEvent[] = [];
  const spawn = input.path[0] ?? { t: 0, x: 0.18, y: 0.72 };

  events.push({
    t: 0,
    type: 'spawn',
    x: spawn.x,
    y: spawn.y,
    poi: 'Coastal Drop',
    label: 'Aterrizaje inicial',
    detail: 'Caíste en Coastal Drop y empezaste a lootear. Buena zona de apertura con rutas de escape al interior.',
    impact: 'Inicio',
  });

  const killSlots = distributeTimes(input.durationSec, input.kills, 0.15, 0.82);
  const killDetails = [
    'Duelo 1v1 ganado con peek corto. Reposition inmediato después del frag.',
    'Third-party limpio: llegaste con ventaja y cerraste el fight.',
    'Fight en caja — high ground convertido en eliminación.',
    'Spray mid-range controlado; el oponente quedó sin cobertura.',
  ];
  killSlots.forEach((t, index) => {
    const point = interpolatePath(input.path, t);
    const poi = nearestPoi(point);
    events.push({
      t,
      type: 'kill',
      x: point.x,
      y: point.y,
      poi: poi.name,
      label: `Eliminación #${index + 1}`,
      detail: `${killDetails[index % killDetails.length]} Zona: ${poi.name}.`,
      impact: '+1 kill',
    });
  });

  const stormTimes = [Math.round(input.durationSec * 0.35), Math.round(input.durationSec * 0.62)];
  stormTimes.forEach((t, index) => {
    const point = interpolatePath(input.path, t);
    const poi = nearestPoi(point);
    events.push({
      t,
      type: 'storm',
      x: point.x,
      y: point.y,
      poi: poi.name,
      label: index === 0 ? 'Primera rotación de zona' : 'Cierre de storm — reagrupar',
      detail:
        index === 0
          ? `La zona se movió. Estabas cerca de ${poi.name}; rotaste para no quedar atrapado en storm.`
          : `Círculo final cerca de ${poi.name}. Quedan pocos equipos — posición > frageo.`,
      impact: index === 0 ? 'Rotate' : 'Endgame',
    });
  });

  const rotateT = Math.round(input.durationSec * 0.48);
  const rotatePoint = interpolatePath(input.path, rotateT);
  const rotatePoi = nearestPoi(rotatePoint);
  events.push({
    t: rotateT,
    type: 'rotate',
    x: rotatePoint.x,
    y: rotatePoint.y,
    poi: rotatePoi.name,
    label: 'Rotación hacia centro',
    detail: `Saliste de ${rotatePoi.name} hacia el próximo círculo con heals y mats. Buen timing de rotate.`,
    impact: 'Rotate OK',
  });

  if (input.deaths > 0) {
    const deathT = Math.round(input.durationSec * (input.placement <= 3 ? 0.88 : 0.71));
    const deathPoint = interpolatePath(input.path, deathT);
    const deathPoi = nearestPoi(deathPoint);
    events.push({
      t: deathT,
      type: 'death',
      x: deathPoint.x,
      y: deathPoint.y,
      poi: deathPoi.name,
      label: input.placement === 1 ? 'Caída final tras victoria' : 'Eliminado — fight desventajoso',
      detail:
        input.placement === 1
          ? `Caíste en ${deathPoi.name} después de cerrar la partida. Win ya asegurada.`
          : `Moriste en ${deathPoi.name} sin cobertura. El oponente tenía high ground y full heals.`,
      impact: input.placement === 1 ? 'Win' : '−1 vida',
    });
  }

  const endPoint = interpolatePath(input.path, input.durationSec);
  events.push({
    t: input.durationSec,
    type: 'loot',
    x: endPoint.x,
    y: endPoint.y,
    poi: 'Final Zone',
    label: input.placement === 1 ? 'Victory Royale' : `Cierre #${input.placement}`,
    detail:
      input.placement === 1
        ? 'Último jugador en pie. Cierre perfecto en Final Zone.'
        : `Partida cerrada en #${input.placement}. Revisá la rotate del mid-game.`,
    impact: input.placement === 1 ? 'Victory' : `#${input.placement}`,
  });

  return events.sort((a, b) => a.t - b.t);
}

function pickWaypoints(seed: number): PoiAnchor[] {
  const count = 4 + (seed % 2);
  const order = [...FORTNITE_MVP_POIS].sort(
    (a, b) => pseudoRandom(seed, a.name.length, b.name.length) - 0.5,
  );
  return order.slice(0, count);
}

function distributeTimes(
  duration: number,
  count: number,
  startRatio: number,
  endRatio: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round(duration * endRatio)];

  const start = duration * startRatio;
  const end = duration * endRatio;
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(start + step * index));
}

export function interpolatePath(path: MatchMapPoint[], t: number): MatchMapPoint {
  if (path.length === 0) return { t, x: 0.5, y: 0.5 };
  if (t <= path[0].t) return path[0];
  if (t >= path[path.length - 1].t) return path[path.length - 1];

  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    if (t >= current.t && t <= next.t) {
      const ratio = (t - current.t) / Math.max(next.t - current.t, 1);
      return {
        t,
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio,
      };
    }
  }

  return path[path.length - 1];
}

export function formatMapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function nearestPoi(point: MatchMapPoint): PoiAnchor {
  return FORTNITE_MVP_POIS.reduce((best, poi) => {
    const bestDist = distance(best, point);
    const poiDist = distance(poi, point);
    return poiDist < bestDist ? poi : best;
  });
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  return Math.max(0.04, Math.min(0.96, value));
}
