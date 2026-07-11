#!/usr/bin/env node
/**
 * Envía un match-end a StatsGames (game_ingestion webhook).
 *
 * Lee automáticamente `.env` en la raíz del monorepo.
 *
 * Uso:
 *   npm run send:match -- --platform valorant --kills 18 --deaths 14 --assists 6
 *   npm run send:match -- --platform rocket_league --kills 5
 *   npm run send:match -- --platform fortnite --kills 8 --placement 1
 *   npm run send:match -- --platform roblox --kills 8 --deaths 2 --placement 3
 *
 * También acepta --user-id (Cognito sub) en lugar de platform user id.
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));

const PLATFORMS = new Set(['valorant', 'rocket_league', 'fortnite', 'roblox']);

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
    url: { type: 'string' },
    secret: { type: 'string' },
  },
  allowPositionals: false,
});

const platformRaw = (values.platform || 'valorant').toLowerCase();
const platform = PLATFORMS.has(platformRaw) ? platformRaw : 'valorant';
if (platformRaw !== platform) {
  console.warn(`Platform "${platformRaw}" no soportada; usando valorant.`);
}
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
  `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const mode =
  values.mode ||
  ({
    valorant: 'Competitive',
    rocket_league: '2v2',
    fortnite: 'Battle Royale',
    roblox: 'BedWars',
  }[platform] ?? 'match');
const map =
  values.map ||
  ({
    valorant: 'Ascent',
    rocket_league: 'DFH Stadium',
    fortnite: undefined,
    roblox: mode === 'Arsenal' ? 'Urban' : 'Classic',
  }[platform] ?? undefined);
const label =
  {
    valorant: 'Valorant',
    rocket_league: 'Rocket League',
    fortnite: 'Fortnite',
    roblox: mode === 'Arsenal' ? 'Arsenal' : 'BedWars',
  }[platform] ?? platform;
const summary =
  values.summary ||
  [
    label,
    mode,
    map,
    values.placement != null ? `Top ${values.placement}` : null,
    platform === 'rocket_league'
      ? `${values.kills ?? 0}G`
      : `${values.kills ?? 0}/${values.deaths ?? 0}${values.assists != null ? `/${values.assists}` : ''}`.replace(
          /\/$/,
          '',
        ),
  ]
    .filter(Boolean)
    .join(' · ');

const body = {
  ...(userId ? { userId } : {}),
  ...(platformUserId ? { platformUserId } : {}),
  matchId,
  occurredAt: new Date().toISOString(),
  mode,
  ...(map ? { map } : {}),
  summary,
  stats: {
    kills: Number(values.kills) || 0,
    deaths: Number(values.deaths) || 0,
    ...(values.placement != null ? { placement: Number(values.placement) } : {}),
    ...(values.assists != null ? { assists: Number(values.assists) } : {}),
    source: 'send-match-cli',
    ...(platform === 'rocket_league'
      ? { goals: Number(values.kills) || 0, saves: 2, shots: 8 }
      : {}),
    ...(platform === 'valorant'
      ? { headshotPct: 24, agent: 'Jett', roundsWon: 13 }
      : {}),
    ...(platform === 'roblox'
      ? {
          placeName: label,
          experienceName: label,
          experienceId: mode.toLowerCase() === 'arsenal' ? 'arsenal' : 'bedwars',
          placeId: mode.toLowerCase() === 'arsenal' ? '286090429' : '6872265039',
          universeId: mode.toLowerCase() === 'arsenal' ? '111958650' : '2619619496',
          jobId: `cli-${matchId}`,
          durationSec: 180,
        }
      : {}),
    ...(platform === 'fortnite'
      ? {
          placeName: undefined,
        }
      : {}),
  },
};

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
console.log(response.status, text);
if (!response.ok) process.exit(1);

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
