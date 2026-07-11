#!/usr/bin/env node
/**
 * Envía un match-end a StatsGames (game_ingestion webhook).
 *
 * Uso:
 *   SG_WEBHOOK_URL=... SG_WEBHOOK_SECRET=... SG_PLATFORM_USER_ID=... \
 *     node integrations/producers/send-match.mjs --platform fortnite --kills 8 --deaths 2 --placement 3
 *
 * También acepta --user-id (Cognito sub) en lugar de platform user id.
 */

import { parseArgs } from 'node:util';

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
  process.env.SG_WEBHOOK_URL_PATTERN?.replace('{platform}', platform);

if (!baseUrl) {
  console.error('Falta --url o SG_WEBHOOK_URL (…/webhooks/fortnite|roblox)');
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
  console.error('Pasá --user-id o --platform-user-id (cuenta vinculada).');
  process.exit(1);
}

const matchId =
  values['match-id'] ||
  `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const body = {
  ...(userId ? { userId } : {}),
  ...(platformUserId ? { platformUserId } : {}),
  matchId,
  occurredAt: new Date().toISOString(),
  ...(values.mode ? { mode: values.mode } : {}),
  ...(values.map ? { map: values.map } : {}),
  ...(values.summary ? { summary: values.summary } : {}),
  stats: {
    kills: Number(values.kills) || 0,
    deaths: Number(values.deaths) || 0,
    ...(values.placement != null ? { placement: Number(values.placement) } : {}),
    ...(values.assists != null ? { assists: Number(values.assists) } : {}),
    source: 'send-match-cli',
  },
};

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
