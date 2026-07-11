#!/usr/bin/env node
/**
 * Envía un match-end a StatsGames (game_ingestion webhook).
 *
 * Lee automáticamente `.env` en la raíz del monorepo.
 *
 * Uso:
 *   npm run send:match -- --platform roblox --kills 8 --deaths 2 --placement 3
 *
 * También acepta --user-id (Cognito sub) en lugar de platform user id.
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'));

const { values } = parseArgs({
  options: {
    platform: { type: 'string', default: 'fortnite' },
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

const platform = values.platform === 'roblox' ? 'roblox' : 'fortnite';
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
  (platform === 'roblox' ? 'Demo Experience' : 'Battle Royale');
const map = values.map || (platform === 'roblox' ? 'Lobby Arena' : undefined);
const summary =
  values.summary ||
  [
    platform === 'roblox' ? 'Demo Experience' : 'Fortnite',
    mode,
    map,
    values.placement != null ? `Top ${values.placement}` : null,
    `${values.kills ?? 0} kills`,
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
    ...(platform === 'roblox'
      ? {
          placeName: 'Demo Experience',
          experienceName: 'Demo Experience',
          placeId: '0',
          jobId: `cli-${matchId}`,
          durationSec: 180,
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
