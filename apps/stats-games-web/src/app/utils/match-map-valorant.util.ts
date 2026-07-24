/**
 * Telemetría de mapa Valorant (preview sintético por mapa/agente).
 * Paridad con match-map-lol.util.ts hasta que llegue timeline real.
 */

import type { MatchUpdateView } from '../services/match.service';
import type {
  MatchMapEvent,
  MatchMapPoint,
  MatchMapTelemetry,
} from '../core/telemetry/match-map-telemetry.types';

const VAL_MAP_ASSET = '/assets/maps/valorant-bind-mvp.svg';

/** Sites / mid / spawn aproximados (y crece hacia abajo). */
const SITES = {
  attackerSpawn: { x: 0.12, y: 0.78 },
  defenderSpawn: { x: 0.88, y: 0.22 },
  siteA: { x: 0.72, y: 0.28 },
  siteB: { x: 0.28, y: 0.72 },
  mid: { x: 0.5, y: 0.5 },
} as const;

export function isValorantPlatform(platform: string): boolean {
  return platform.toLowerCase() === 'valorant';
}

export function resolveValorantMatchMapTelemetry(match: MatchUpdateView): MatchMapTelemetry {
  const won = match.stats?.won === true;
  const kills = match.stats?.kills ?? 0;
  const deaths = match.stats?.deaths ?? 0;
  const durationSec = Math.max(18 * 60, Math.min(45 * 60, 22 * 60 + kills * 40));
  const mapName = match.stats?.map?.trim() || 'Bind';
  const agent = match.stats?.agent?.trim() || 'Agente';

  const path = buildPath(durationSec, won);
  const events = buildEvents(durationSec, kills, deaths, won, agent, mapName);

  return {
    matchId: match.matchId,
    platform: match.platform,
    seasonId: 'valorant-preview',
    seasonLabel: mapName,
    mapAssetUrl: VAL_MAP_ASSET,
    durationSec,
    path,
    events,
    source: 'synthetic',
    isPreview: true,
  };
}

function buildPath(durationSec: number, won: boolean): MatchMapPoint[] {
  const attackFirst = true;
  const mid = durationSec / 2;
  const route = attackFirst
    ? [SITES.attackerSpawn, SITES.mid, SITES.siteA, SITES.mid, SITES.siteB, SITES.defenderSpawn]
    : [SITES.defenderSpawn, SITES.siteA, SITES.mid, SITES.siteB, SITES.attackerSpawn];

  if (!won) {
    // Path más corto / muerto mid-round vibe
    return sampleAlong(route.slice(0, 4), durationSec * 0.7);
  }
  return sampleAlong(route, durationSec);
}

function sampleAlong(
  anchors: Array<{ x: number; y: number }>,
  durationSec: number,
): MatchMapPoint[] {
  if (anchors.length === 0) return [{ t: 0, x: 0.5, y: 0.5 }];
  const points: MatchMapPoint[] = [];
  const steps = Math.max(anchors.length * 4, 12);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = Math.round(u * durationSec);
    const seg = u * (anchors.length - 1);
    const i0 = Math.min(anchors.length - 2, Math.floor(seg));
    const f = seg - i0;
    const a = anchors[i0];
    const b = anchors[i0 + 1] ?? a;
    points.push({
      t,
      x: a.x + (b.x - a.x) * f + jitter(i),
      y: a.y + (b.y - a.y) * f + jitter(i + 3),
    });
  }
  return points;
}

function jitter(seed: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 0.03;
}

function buildEvents(
  durationSec: number,
  kills: number,
  deaths: number,
  won: boolean,
  agent: string,
  mapName: string,
): MatchMapEvent[] {
  const events: MatchMapEvent[] = [
    {
      t: 0,
      type: 'spawn',
      x: SITES.attackerSpawn.x,
      y: SITES.attackerSpawn.y,
      poi: 'Attacker Spawn',
      label: 'Spawn',
      detail: `${agent} · ${mapName}`,
    },
  ];

  const killCount = Math.min(kills, 8);
  for (let i = 0; i < killCount; i++) {
    const t = Math.round(((i + 1) / (killCount + 1)) * durationSec * 0.85);
    const site = i % 2 === 0 ? SITES.siteA : SITES.siteB;
    events.push({
      t,
      type: 'kill',
      x: site.x + jitter(i),
      y: site.y + jitter(i + 1),
      poi: i % 2 === 0 ? 'A Site' : 'B Site',
      label: 'Kill',
      impact: '+1',
      detail: `${agent} frag`,
    });
  }

  const deathCount = Math.min(deaths, 6);
  for (let i = 0; i < deathCount; i++) {
    const t = Math.round(((i + 1) / (deathCount + 1)) * durationSec * 0.9 + 30);
    events.push({
      t: Math.min(t, durationSec - 5),
      type: 'death',
      x: SITES.mid.x + jitter(i + 5),
      y: SITES.mid.y + jitter(i + 7),
      poi: 'Mid',
      label: 'Death',
      detail: 'Traded / peeked',
    });
  }

  events.push({
    t: Math.round(durationSec * 0.55),
    type: 'objective',
    x: SITES.siteA.x,
    y: SITES.siteA.y,
    poi: 'A Site',
    label: won ? 'Plant' : 'Retake',
    detail: won ? 'Spike plant' : 'Defensa / retake',
    impact: won ? 'Plant' : undefined,
  });

  return events.sort((a, b) => a.t - b.t);
}
