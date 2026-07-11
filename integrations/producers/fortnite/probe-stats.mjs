#!/usr/bin/env node
/**
 * Verifica que fortnite-api.com responda para tu cuenta (stats públicas).
 *
 * Uso:
 *   FORTNITE_API_KEY=xxx npm run probe:fortnite -- Ninja
 *   FORTNITE_API_KEY=xxx npm run probe:fortnite -- <epic-account-id-32-hex>
 *
 * También lee FORTNITE_API_KEY / SG_FORTNITE_NAME desde `.env` en la raíz.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv(resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'));

const apiKey = process.env.FORTNITE_API_KEY?.trim();
const account = (process.argv[2] || process.env.SG_FORTNITE_NAME || '').trim();

if (!apiKey) {
  console.error('Falta FORTNITE_API_KEY (fortnite-api.com). Ponela en `.env` o el entorno.');
  process.exit(1);
}

if (!account) {
  console.error('Pasá display name o Epic account id: npm run probe:fortnite -- TuNombre');
  process.exit(1);
}

const looksLikeId = /^[0-9a-f]{32}$/i.test(account);
const url = looksLikeId
  ? `https://fortnite-api.com/v2/stats/br/v2/${encodeURIComponent(account)}`
  : `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(account)}`;

const response = await fetch(url, { headers: { Authorization: apiKey } });
const text = await response.text();

if (!response.ok) {
  console.error(`fortnite-api ${response.status}`);
  console.error(text);
  if (response.status === 404) {
    console.error(
      '\nTip: la cuenta no existe o las stats BR están privadas en Epic (Privacy → Stats).',
    );
  }
  process.exit(1);
}

const body = JSON.parse(text);
const overall = body?.data?.stats?.all?.overall ?? {};
const accountInfo = body?.data?.account ?? {};

console.log('OK — cuenta visible para el poller\n');
console.log({
  accountId: accountInfo.id,
  displayName: accountInfo.name,
  matches: overall.matches ?? 0,
  kills: overall.kills ?? 0,
  deaths: overall.deaths ?? 0,
  wins: overall.wins ?? 0,
  lastModified: overall.lastModified
    ? new Date(overall.lastModified * 1000).toISOString()
    : null,
});
console.log(
  '\nSiguiente: vinculá exactamente este display name o accountId en Integraciones → Fortnite.',
);

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
