#!/usr/bin/env node
/**
 * Envía un match-end a StatsGames (game_ingestion webhook).
 *
 * Lee automáticamente `.env` en la raíz del monorepo.
 *
 * Uso:
 *   npm run send:match -- --platform valorant --kills 18 --deaths 14 --assists 6
 *   npm run send:match -- --platform league_of_legends --platform-user-id "Diego#XQ37" --champion Ahri --role MIDDLE --cs 210
 *   npm run send:match -- --platform dota2 --hero "Shadow Fiend" --gpm 620 --xpm 770
 *   npm run send:match -- --platform overwatch2 --hero Tracer --role Damage --damage 12000
 *   npm run send:match -- --platform clash_royale --crowns 3 --trophies 6500
 *   npm run send:match -- --platform brawl_stars --brawler Shelly --trophies 800
 *
 * También acepta --user-id (Cognito sub) en lugar de platform user id.
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));

const LOL_QUEUE_MODE = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  450: 'ARAM',
  400: 'Normal Draft',
  430: 'Normal Blind',
  700: 'Clash',
  1700: 'Arena',
};

const PLATFORM_ADAPTERS = {
  valorant: {
    label: 'Valorant',
    mode: 'Competitive',
    map: 'Ascent',
    matchPrefix: 'val',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      headshotPct: num(ctx.values.hs ?? ctx.values.headshotPct ?? '24'),
      agent: ctx.values.agent || 'Jett',
      roundsWon: num(ctx.values['rounds-won'] ?? '13'),
      roundsLost: num(ctx.values['rounds-lost'] ?? '9'),
      score: num(ctx.values.score ?? '4400'),
      acs: num(ctx.values.acs ?? '245'),
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  league_of_legends: {
    label: 'League of Legends',
    mode: (ctx) => LOL_QUEUE_MODE[num(ctx.values['queue-id'] ?? '420')] || `Queue ${ctx.values['queue-id']}`,
    map: "Summoner's Rift",
    matchPrefix: 'lol',
    buildStats: (ctx) => {
      const durationSec = num(ctx.values.duration ?? '1684');
      const kills = num(ctx.values.kills ?? '0');
      const deaths = num(ctx.values.deaths ?? '0');
      const assists = num(ctx.values.assists ?? '0');
      const role = ctx.values.role || 'MIDDLE';
      const teamObjectives = {
        barons: num(ctx.values.barons ?? '1'),
        dragons: num(ctx.values.dragons ?? '2'),
        towers: num(ctx.values.towers ?? '8'),
      };
      return {
        ...baseCombatStats(ctx),
        champion: ctx.values.champion || 'Ahri',
        role,
        cs: num(ctx.values.cs ?? '210'),
        visionScore: num(ctx.values.vision ?? ctx.values.visionScore ?? '28'),
        queueId: num(ctx.values['queue-id'] ?? '420'),
        durationSec,
        goldEarned: num(ctx.values.gold ?? ctx.values.goldEarned ?? '12480'),
        champLevel: num(ctx.values.level ?? ctx.values.champLevel ?? '16'),
        items: parseItems(ctx.values.items) ?? [3089, 3020, 4645, 3115, 3135, 3165, 3364],
        teamObjectives,
        teamBarons: teamObjectives.barons,
        teamDragons: teamObjectives.dragons,
        teamTowers: teamObjectives.towers,
        mapTelemetry: buildSyntheticLolMapTelemetry({
          durationSec,
          kills,
          deaths,
          assists,
          role,
          won: bool(ctx.values.won, true),
          teamObjectives,
        }),
        won: bool(ctx.values.won, true),
        placement: bool(ctx.values.won, true) ? 1 : 2,
        source: 'send-match-cli-simulated-riot',
      };
    },
  },
  cs2: {
    label: 'CS2',
    mode: 'Premier',
    map: 'de_mirage',
    matchPrefix: 'cs2',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      adr: num(ctx.values.adr ?? '85'),
      headshotPct: num(ctx.values.hs ?? ctx.values.headshotPct ?? '38'),
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  dota2: {
    label: 'Dota 2',
    mode: 'Ranked',
    map: 'Dota 2',
    matchPrefix: 'dota2',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      hero: ctx.values.hero || 'Shadow Fiend',
      gpm: num(ctx.values.gpm ?? '620'),
      xpm: num(ctx.values.xpm ?? '770'),
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  overwatch2: {
    label: 'Overwatch 2',
    mode: 'Competitive',
    map: 'Control',
    matchPrefix: 'ow2',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      hero: ctx.values.hero || 'Tracer',
      role: ctx.values.role || 'Damage',
      damage: num(ctx.values.damage ?? '12000'),
      healing: num(ctx.values.healing ?? '0'),
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  rocket_league: {
    label: 'Rocket League',
    mode: '2v2',
    map: 'DFH Stadium',
    matchPrefix: 'rl',
    buildStats: (ctx) => {
      const goals = num(ctx.values.goals ?? ctx.values.kills ?? '4');
      return {
        goals,
        kills: goals,
        deaths: 0,
        assists: num(ctx.values.assists ?? '1'),
        saves: num(ctx.values.saves ?? '2'),
        shots: num(ctx.values.shots ?? '8'),
        shotPct: num(ctx.values['shot-pct'] ?? '42'),
        score: num(ctx.values.score ?? '650'),
        won: bool(ctx.values.won, true),
        placement: bool(ctx.values.won, true) ? 1 : 2,
      };
    },
  },
  fortnite: {
    label: 'Fortnite',
    mode: 'Battle Royale',
    matchPrefix: 'fn',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      placement: num(ctx.values.placement ?? '1'),
      won: num(ctx.values.placement ?? '1') === 1 || bool(ctx.values.won, false),
    }),
  },
  clash_royale: {
    label: 'Clash Royale',
    mode: 'Ladder',
    map: 'Arena',
    matchPrefix: 'cr',
    buildStats: (ctx) => ({
      crowns: num(ctx.values.crowns ?? '3'),
      trophies: num(ctx.values.trophies ?? '6500'),
      score: num(ctx.values.score ?? ctx.values.crowns ?? '3'),
      kills: num(ctx.values.crowns ?? '3'),
      deaths: 0,
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  brawl_stars: {
    label: 'Brawl Stars',
    mode: 'Gem Grab',
    map: 'Hard Rock Mine',
    matchPrefix: 'bs',
    buildStats: (ctx) => ({
      ...baseCombatStats(ctx),
      brawler: ctx.values.brawler || 'Shelly',
      trophies: num(ctx.values.trophies ?? '800'),
      won: bool(ctx.values.won, true),
      placement: bool(ctx.values.won, true) ? 1 : 2,
    }),
  },
  roblox: {
    label: (ctx) => (ctx.mode.toLowerCase() === 'arsenal' ? 'Arsenal' : 'BedWars'),
    mode: 'BedWars',
    map: 'Classic',
    matchPrefix: 'rbx',
    buildStats: (ctx) => {
      const isArsenal = ctx.mode.toLowerCase() === 'arsenal';
      return {
        ...baseCombatStats(ctx),
        placement: num(ctx.values.placement ?? '2'),
        experienceName: isArsenal ? 'Arsenal' : 'BedWars',
        experienceId: isArsenal ? 'arsenal' : 'bedwars',
        placeId: isArsenal ? '286090429' : '6872265039',
        universeId: isArsenal ? '111958650' : '2619619496',
        jobId: `cli-${ctx.matchId}`,
        durationSec: num(ctx.values.duration ?? '180'),
      };
    },
  },
};

const { values } = parseArgs({
  options: {
    platform: { type: 'string', default: 'valorant' },
    'match-id': { type: 'string' },
    'user-id': { type: 'string' },
    'platform-user-id': { type: 'string' },
    kills: { type: 'string', default: '0' },
    deaths: { type: 'string', default: '0' },
    placement: { type: 'string' },
    assists: { type: 'string' },
    mode: { type: 'string' },
    map: { type: 'string' },
    summary: { type: 'string' },
    champion: { type: 'string' },
    role: { type: 'string' },
    cs: { type: 'string' },
    vision: { type: 'string' },
    visionScore: { type: 'string' },
    won: { type: 'string' },
    'queue-id': { type: 'string' },
    hs: { type: 'string' },
    headshotPct: { type: 'string' },
    adr: { type: 'string' },
    agent: { type: 'string' },
    acs: { type: 'string' },
    score: { type: 'string' },
    'rounds-won': { type: 'string' },
    'rounds-lost': { type: 'string' },
    goals: { type: 'string' },
    saves: { type: 'string' },
    shots: { type: 'string' },
    'shot-pct': { type: 'string' },
    hero: { type: 'string' },
    gpm: { type: 'string' },
    xpm: { type: 'string' },
    damage: { type: 'string' },
    healing: { type: 'string' },
    crowns: { type: 'string' },
    trophies: { type: 'string' },
    brawler: { type: 'string' },
    duration: { type: 'string' },
    gold: { type: 'string' },
    goldEarned: { type: 'string' },
    level: { type: 'string' },
    champLevel: { type: 'string' },
    items: { type: 'string' },
    barons: { type: 'string' },
    dragons: { type: 'string' },
    towers: { type: 'string' },
    url: { type: 'string' },
    secret: { type: 'string' },
  },
  allowPositionals: false,
});

const platformRaw = (values.platform || 'valorant').toLowerCase();
const adapter = PLATFORM_ADAPTERS[platformRaw];
if (!adapter) {
  console.error(
    `Platform "${platformRaw}" no soportada. Usá una de: ${Object.keys(PLATFORM_ADAPTERS).join(', ')}`,
  );
  process.exit(1);
}
const platform = platformRaw;
const baseUrl =
  values.url ||
  process.env.SG_WEBHOOK_URL ||
  process.env.SG_WEBHOOK_URL_PATTERN;

if (!baseUrl) {
  console.error(
    'Falta SG_WEBHOOK_URL. Creá un `.env` en la raíz (ver `.env.example`) o pasá --url.',
  );
  process.exit(1);
}

const webhookUrl = baseUrl.includes('{platform}')
  ? baseUrl.replace('{platform}', platform)
  : baseUrl.includes('/webhooks/')
    ? baseUrl
    : `${baseUrl.replace(/\/$/, '')}/webhooks/${platform}`;

const secret = values.secret || process.env.SG_WEBHOOK_SECRET || '';
const userId = values['user-id'] || process.env.SG_USER_ID;
const platformUserId =
  values['platform-user-id'] || process.env.SG_PLATFORM_USER_ID;

if (!userId && !platformUserId) {
  console.error(
    'Falta SG_PLATFORM_USER_ID (o --platform-user-id / --user-id). Ponelo en `.env`.',
  );
  process.exit(1);
}

const matchId =
  values['match-id'] ||
  `${adapter.matchPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const occurredAt = new Date().toISOString();
const gameStartMs = Date.now() - 28 * 60 * 1000;
const mode = values.mode || resolveAdapterValue(adapter.mode, { values, mode: '', matchId });
const map = values.map || resolveAdapterValue(adapter.map, { values, mode, matchId });
const label = resolveAdapterValue(adapter.label, { values, mode, matchId });
const ctx = { values, mode, map, matchId };
const stats = {
  source: 'send-match-cli',
  ...adapter.buildStats(ctx),
  ...(mode ? { mode } : {}),
  ...(map ? { map } : {}),
};
const summary = values.summary || buildSummary(label, stats);
const finalMatchId = matchId.startsWith(`${adapter.matchPrefix}-`)
  ? matchId
  : `${adapter.matchPrefix}-${matchId}`;
const riotMatchId = platform === 'league_of_legends'
  ? finalMatchId.replace(/^lol-/, '') || `EUW1_${Date.now().toString().slice(-10)}`
  : matchId;

/** Forma reducida de lo que Riot Match-v5 devuelve al cerrar una partida (simulado). */
function buildSimulatedRiotMatchV5() {
  const lolKills = num(values.kills ?? '0');
  const lolDeaths = num(values.deaths ?? '0');
  const lolAssists = num(values.assists ?? '0');
  const lolCs = num(values.cs ?? '210');
  const lolVision = num(values.vision ?? values.visionScore ?? '28');
  const lolQueueId = num(values['queue-id'] ?? '420');
  const lolWon = bool(values.won, true);
  const lolItems = Array.isArray(stats.items) ? stats.items : [];
  const objectives = stats.teamObjectives ?? { barons: 0, dragons: 0, towers: 0 };
  return {
    metadata: {
      dataVersion: '2',
      matchId: riotMatchId,
      participants: ['simulated-puuid-diego-xq37'],
    },
    info: {
      endOfGameResult: 'GameComplete',
      gameCreation: gameStartMs,
      gameDuration: 1684,
      gameEndTimestamp: Date.now(),
      gameId: Number(String(riotMatchId).replace(/\D/g, '').slice(-10)) || Date.now(),
      gameMode: 'CLASSIC',
      gameName: `EUW1 ${Date.now()}`,
      gameStartTimestamp: gameStartMs,
      gameDuration: stats.durationSec,
      gameType: 'MATCHED_GAME',
      gameVersion: '14.12.1.512',
      mapId: 11,
      queueId: lolQueueId,
      platformId: 'EUW1',
      participants: [
        {
          puuid: 'simulated-puuid-diego-xq37',
          riotIdGameName: 'Diego',
          riotIdTagline: 'XQ37',
          summonerName: 'Diego',
          championName: stats.champion,
          teamPosition: stats.role,
          individualPosition: stats.role,
          kills: lolKills,
          deaths: lolDeaths,
          assists: lolAssists,
          totalMinionsKilled: Math.max(0, lolCs - 24),
          neutralMinionsKilled: 24,
          visionScore: lolVision,
          win: lolWon,
          goldEarned: stats.goldEarned,
          champLevel: stats.champLevel,
          item0: lolItems[0] ?? 0,
          item1: lolItems[1] ?? 0,
          item2: lolItems[2] ?? 0,
          item3: lolItems[3] ?? 0,
          item4: lolItems[4] ?? 0,
          item5: lolItems[5] ?? 0,
          item6: lolItems[6] ?? 0,
        },
      ],
      teams: [
        { teamId: 100, win: lolWon, objectives: { baron: { kills: objectives.barons }, dragon: { kills: objectives.dragons }, tower: { kills: objectives.towers } } },
        { teamId: 200, win: !lolWon, objectives: { baron: { kills: 0 }, dragon: { kills: 1 }, tower: { kills: 3 } } },
      ],
    },
  };
}

const body = {
  ...(userId ? { userId } : {}),
  ...(platformUserId ? { platformUserId } : {}),
  matchId: finalMatchId,
  occurredAt,
  mode,
  ...(map ? { map } : {}),
  summary,
  stats: stripUndefined(stats),
};

if (platform === 'league_of_legends') {
  console.log('\n=== Simulación Riot Match-v5 (fin de partida) ===');
  console.log(JSON.stringify(buildSimulatedRiotMatchV5(), null, 2));
  console.log('\n=== Payload webhook → game_ingestion ===');
  console.log(JSON.stringify(body, null, 2));
  console.log('');
}

console.log(`→ POST ${webhookUrl} (platformUserId=${platformUserId ?? userId})`);

const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(secret ? { 'x-webhook-secret': secret } : {}),
  },
  body: JSON.stringify(body),
});

const text = await response.text();
console.log('← Response', response.status, text);
if (!response.ok) process.exit(1);

/** Path + hitos sintéticos (simula Timeline-V5 normalizado 0–1). */
function buildSyntheticLolMapTelemetry(input) {
  const durationSec = Math.max(600, Number(input.durationSec) || 1680);
  const role = String(input.role || 'MIDDLE').toUpperCase();
  const lanes = {
    TOP: [
      [0.12, 0.88],
      [0.18, 0.35],
      [0.28, 0.55],
      [0.5, 0.5],
      [0.38, 0.38],
      [0.88, 0.12],
    ],
    JUNGLE: [
      [0.12, 0.88],
      [0.28, 0.55],
      [0.62, 0.62],
      [0.5, 0.5],
      [0.38, 0.38],
      [0.72, 0.45],
      [0.88, 0.12],
    ],
    MIDDLE: [
      [0.12, 0.88],
      [0.5, 0.5],
      [0.5, 0.48],
      [0.62, 0.62],
      [0.38, 0.38],
      [0.88, 0.12],
    ],
    BOTTOM: [
      [0.12, 0.88],
      [0.72, 0.82],
      [0.62, 0.62],
      [0.5, 0.5],
      [0.88, 0.12],
    ],
    UTILITY: [
      [0.12, 0.88],
      [0.72, 0.82],
      [0.62, 0.62],
      [0.5, 0.48],
      [0.5, 0.5],
      [0.88, 0.12],
    ],
  };
  const waypoints = lanes[role] || lanes.MIDDLE;
  const path = [];
  const segments = Math.max(waypoints.length - 1, 1);
  for (let s = 0; s < segments; s += 1) {
    const [x0, y0] = waypoints[s];
    const [x1, y1] = waypoints[s + 1] || waypoints[s];
    const steps = 6;
    const t0 = (durationSec / segments) * s;
    const t1 = (durationSec / segments) * (s + 1);
    for (let i = 0; i <= steps; i += 1) {
      const r = i / steps;
      path.push({
        t: Math.round(t0 + (t1 - t0) * r),
        x: Number((x0 + (x1 - x0) * r).toFixed(3)),
        y: Number((y0 + (y1 - y0) * r).toFixed(3)),
      });
    }
  }

  const pointAt = (ratio) => {
    const t = Math.round(durationSec * ratio);
    const hit = path.find((p) => p.t >= t) || path[path.length - 1];
    return { t, x: hit.x, y: hit.y };
  };

  const events = [
    {
      t: 0,
      type: 'spawn',
      x: path[0].x,
      y: path[0].y,
      poi: 'Blue Base',
      label: 'Salida de base',
      detail: 'Simulación send-match (Timeline-V5 shape).',
      impact: 'Inicio',
    },
  ];

  for (let i = 0; i < Math.min(input.kills || 0, 5); i += 1) {
    const p = pointAt(0.2 + i * 0.12);
    events.push({
      ...p,
      type: 'kill',
      poi: 'Mid Lane',
      label: `Kill #${i + 1}`,
      detail: 'Kill simulado.',
      impact: '+1 kill',
    });
  }
  for (let i = 0; i < Math.min(input.deaths || 0, 4); i += 1) {
    const p = pointAt(0.25 + i * 0.15);
    events.push({
      ...p,
      type: 'death',
      poi: 'River',
      label: `Death #${i + 1}`,
      detail: 'Death simulada.',
      impact: '−1',
    });
  }
  if ((input.teamObjectives?.dragons || 0) > 0) {
    events.push({
      t: Math.round(durationSec * 0.42),
      type: 'dragon',
      x: 0.62,
      y: 0.62,
      poi: 'Dragon Pit',
      label: 'Dragón',
      detail: 'Objetivo simulado.',
      impact: 'Dragon',
    });
  }
  if ((input.teamObjectives?.barons || 0) > 0) {
    events.push({
      t: Math.round(durationSec * 0.72),
      type: 'baron',
      x: 0.38,
      y: 0.38,
      poi: 'Baron Pit',
      label: 'Barón',
      detail: 'Objetivo simulado.',
      impact: 'Baron',
    });
  }
  const end = path[path.length - 1];
  events.push({
    t: durationSec,
    type: 'loot',
    x: end.x,
    y: end.y,
    poi: 'Red Base',
    label: input.won ? 'Victoria' : 'Derrota',
    detail: 'Cierre simulado.',
    impact: input.won ? 'Win' : 'Loss',
  });

  return {
    source: 'synthetic',
    durationSec,
    path,
    events: events.sort((a, b) => a.t - b.t),
    coordinateSpace: { maxX: 15000, maxY: 15000 },
  };
}

function baseCombatStats(ctx) {
  return {
    kills: num(ctx.values.kills ?? '0'),
    deaths: num(ctx.values.deaths ?? '0'),
    ...(ctx.values.assists != null ? { assists: num(ctx.values.assists) } : { assists: 0 }),
  };
}

function buildSummary(label, stats) {
  const result = stats.won === true ? 'Victoria' : stats.won === false ? 'Derrota' : null;
  const placement = stats.placement != null ? `Top ${stats.placement}` : null;
  const performance = stats.goals != null
    ? `${stats.goals}G ${stats.assists ?? 0}A`
    : stats.crowns != null
      ? `${stats.crowns} coronas`
      : `${stats.kills ?? 0}/${stats.deaths ?? 0}/${stats.assists ?? 0}`;
  return [label, stats.mode, stats.map, result ?? placement, performance]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200);
}

function resolveAdapterValue(value, ctx) {
  if (typeof value === 'function') return value(ctx);
  return value;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value, fallback) {
  if (value == null) return fallback;
  return !['0', 'false', 'no', 'loss', 'derrota'].includes(String(value).toLowerCase());
}

function stripUndefined(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function parseItems(value) {
  if (!value) return null;
  const items = String(value)
    .split(',')
    .map((item) => num(item.trim()))
    .filter((item) => item > 0);
  return items.length ? items.slice(0, 7) : null;
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
