#!/usr/bin/env node
/**
 * Trae un sample REAL de LoL (Challenger Ranked Solo) vía Riot API y arma
 * leaderboard + benchmarks semanales para comparar con el usuario logueado.
 *
 * No scrapea millones: ~15–25 peers + agregados de partidas recientes.
 *
 * Uso:
 *   RIOT_API_KEY=RGAPI-... node scripts/seed-lol-community-real.mjs --user-id <cognito-sub>
 *   # o lee riot_api_key de infra/terraform.tfvars
 *
 * Vars:
 *   LOL_PLATFORM=la1|na1|euw1…  (default la1)
 *   LOL_REGION=americas|europe… (default americas)
 *   PEER_COUNT=28
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const AWS_REGION = process.env['AWS_REGION'] ?? 'eu-central-1';
const PLATFORM_ROUTING = (process.env['LOL_PLATFORM'] ?? 'la1').trim();
const MATCH_REGION = (process.env['LOL_REGION'] ?? 'americas').trim();
const PEER_COUNT = Number(process.env['PEER_COUNT'] ?? 28);
const MATCHES_PER_PEER = 5;
const FALLBACK_ICON_ID = 29;

/** @type {string | null} */
let cachedDdragonVersion = null;

function parseArgs(argv) {
  const args = { userId: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--user-id' && argv[i + 1]) args.userId = argv[++i];
  }
  return args;
}

function resolveTableName() {
  if (process.env['TABLE_NAME']) return process.env['TABLE_NAME'];
  return execSync('terraform -chdir=infra output -raw table_name', {
    encoding: 'utf8',
  }).trim();
}

function resolveRiotKey() {
  if (process.env['RIOT_API_KEY']?.trim()) return process.env['RIOT_API_KEY'].trim();
  const tf = readFileSync('infra/terraform.tfvars', 'utf8');
  const m = /riot_api_key\s*=\s*"([^"]+)"/.exec(tf);
  if (!m) throw new Error('Falta RIOT_API_KEY o riot_api_key en terraform.tfvars');
  return m[1];
}

function isoWeekPeriodId(date = new Date()) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function riotGet(url, apiKey) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? 2);
      await sleep((retry + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${url} → ${body.slice(0, 180)}`);
    }
    return res.json();
  }
  throw new Error(`Rate limit persistente: ${url}`);
}

/** Score por ratios (alineado con libs/common fair-leaderboard-score). */
function scoreOf({ totalKills, totalDeaths, totalAssists = 0, winCount, matchCount }) {
  const matches = Math.max(0, Math.floor(matchCount));
  if (matches === 0) return 0;
  const deaths = Math.max(1, totalDeaths);
  const assists = Math.max(0, totalAssists);
  const kda = (totalKills + assists) / deaths;
  const winRate = (winCount / matches) * 100;
  const killsPerGame = totalKills / matches;
  const reliability = Math.min(1, matches / 5);
  return Math.round((kda * 100 + winRate * 1.5 + killsPerGame * 12) * reliability);
}

/** Escala totales al mismo tamaño de muestra que los peers (últimas N ranked). */
function normalizeToWindow(player, windowSize = MATCHES_PER_PEER) {
  const matches = Number(player.matchCount ?? 0);
  if (matches <= 0 || matches <= windowSize) return { ...player };
  const ratio = windowSize / matches;
  return {
    ...player,
    matchCount: windowSize,
    totalKills: Math.round(Number(player.totalKills ?? 0) * ratio),
    totalDeaths: Math.round(Number(player.totalDeaths ?? 0) * ratio),
    totalAssists: Math.round(Number(player.totalAssists ?? 0) * ratio),
    winCount: Math.round(Number(player.winCount ?? 0) * ratio),
    sampleNormalized: true,
  };
}

async function fetchChallengerEntries(apiKey) {
  const url = `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`;
  const league = await riotGet(url, apiKey);
  const entries = Array.isArray(league.entries) ? [...league.entries] : [];
  entries.sort((a, b) => (b.leaguePoints ?? 0) - (a.leaguePoints ?? 0));
  return entries;
}

async function resolveDdragonVersion() {
  if (cachedDdragonVersion) return cachedDdragonVersion;
  const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) =>
    r.json(),
  );
  cachedDdragonVersion = Array.isArray(versions) && versions[0] ? String(versions[0]) : '14.12.1';
  return cachedDdragonVersion;
}

function profileIconUrl(version, iconId) {
  const id = Number.isFinite(iconId) && iconId > 0 ? iconId : FALLBACK_ICON_ID;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`;
}

async function resolveEntryIdentity(entry, apiKey) {
  // league-v4 Challenger ya expone puuid (sin summonerId).
  const puuid = entry.puuid;
  if (!puuid) return null;
  const account = await riotGet(
    `https://${MATCH_REGION}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`,
    apiKey,
  );
  const gamerTag =
    account.gameName && account.tagLine
      ? `${account.gameName}#${account.tagLine}`
      : entry.summonerName || `Challenger-${puuid.slice(0, 8)}`;

  let profileIconId = FALLBACK_ICON_ID;
  try {
    const summoner = await riotGet(
      `https://${PLATFORM_ROUTING}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
      apiKey,
    );
    if (typeof summoner.profileIconId === 'number') {
      profileIconId = summoner.profileIconId;
    }
  } catch {
    // icon opcional
  }

  const version = await resolveDdragonVersion();
  return {
    puuid,
    gamerTag,
    profileIconId,
    avatarUrl: profileIconUrl(version, profileIconId),
  };
}

async function aggregateRecentMatches(puuid, apiKey) {
  const idsUrl = `https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=420&start=0&count=${MATCHES_PER_PEER}`;
  const ids = await riotGet(idsUrl, apiKey);
  if (!Array.isArray(ids) || ids.length === 0) {
    return { matchCount: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0, winCount: 0 };
  }

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let winCount = 0;
  let matchCount = 0;

  for (const matchId of ids.slice(0, MATCHES_PER_PEER)) {
    await sleep(120);
    try {
      const match = await riotGet(
        `https://${MATCH_REGION}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
        apiKey,
      );
      const player = match.info?.participants?.find((p) => p.puuid === puuid);
      if (!player) continue;
      matchCount += 1;
      totalKills += player.kills ?? 0;
      totalDeaths += player.deaths ?? 0;
      totalAssists += player.assists ?? 0;
      if (player.win) winCount += 1;
    } catch {
      // skip match failures
    }
  }

  return { matchCount, totalKills, totalDeaths, totalAssists, winCount };
}

async function loadUserWeeklyRollup(doc, tableName, userId, periodId) {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `METRICS#WEEKLY#${periodId}#league_of_legends`,
      },
    }),
  );
  return res.Item ?? null;
}

async function loadUserProfile(doc, tableName, userId) {
  const res = await doc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    }),
  );
  return res.Item ?? null;
}

async function deleteExistingLolLeaderboard(doc, tableName, periodId) {
  const pk = `LEADERBOARD#league_of_legends#WEEKLY#${periodId}`;
  const existing = await doc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ProjectionExpression: 'PK, SK',
    }),
  );
  const items = existing.Items ?? [];
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => ({
            DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
          })),
        },
      }),
    );
  }
  return items.length;
}

async function batchPut(doc, tableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let pending = chunk.map((Item) => ({ PutRequest: { Item } }));
    while (pending.length) {
      const result = await doc.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: pending } }),
      );
      pending = result.UnprocessedItems?.[tableName] ?? [];
      if (pending.length) await sleep(400);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userId) {
    throw new Error('Pasá --user-id <cognito-sub> del usuario logueado');
  }

  const apiKey = resolveRiotKey();
  const tableName = resolveTableName();
  const periodId = isoWeekPeriodId();
  const now = new Date().toISOString();
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

  console.log(`Tabla: ${tableName}`);
  console.log(`Periodo: ${periodId}`);
  console.log(`Riot platform=${PLATFORM_ROUTING} matchRegion=${MATCH_REGION}`);
  console.log(`Usuario: ${args.userId}`);
  console.log(`Peers objetivo: ${PEER_COUNT}`);

  const profile = await loadUserProfile(doc, tableName, args.userId);
  const gamerTag = profile?.gamerTag || 'Vos';
  const rollup = await loadUserWeeklyRollup(doc, tableName, args.userId, periodId);

  console.log('\n→ Bajando Challenger Ranked Solo…');
  const challenger = await fetchChallengerEntries(apiKey);
  console.log(`  Challenger entries: ${challenger.length}`);

  const peers = [];
  for (const entry of challenger.slice(0, PEER_COUNT + 8)) {
    if (peers.length >= PEER_COUNT) break;
    try {
      await sleep(100);
      const identity = await resolveEntryIdentity(entry, apiKey);
      if (!identity) continue;
      await sleep(100);
      const agg = await aggregateRecentMatches(identity.puuid, apiKey);
      if (agg.matchCount === 0) {
        // fallback: usar W/L de ranked season si no hay match-v5 reciente
        const wins = entry.wins ?? 0;
        const losses = entry.losses ?? 0;
        const matchCount = wins + losses;
        if (matchCount === 0) continue;
        peers.push({
          userId: `riot-${identity.puuid.slice(0, 16)}`,
          gamerTag: identity.gamerTag,
          puuid: identity.puuid,
          avatarUrl: identity.avatarUrl,
          profileIconId: identity.profileIconId,
          matchCount: Math.min(matchCount, 20),
          totalKills: Math.round((wins + losses) * 6.5),
          totalDeaths: Math.round((wins + losses) * 5.2),
          totalAssists: Math.round((wins + losses) * 7),
          winCount: Math.round((wins / matchCount) * Math.min(matchCount, 20)),
          source: 'league-v4-fallback',
          leaguePoints: entry.leaguePoints ?? 0,
        });
        console.log(`  · ${identity.gamerTag} (fallback ranked W/L) icon#${identity.profileIconId}`);
        continue;
      }
      peers.push({
        userId: `riot-${identity.puuid.slice(0, 16)}`,
        gamerTag: identity.gamerTag,
        puuid: identity.puuid,
        avatarUrl: identity.avatarUrl,
        profileIconId: identity.profileIconId,
        ...agg,
        source: 'match-v5',
        leaguePoints: entry.leaguePoints ?? 0,
      });
      console.log(
        `  · ${identity.gamerTag}  ${agg.winCount}V/${agg.matchCount}  KDA ${agg.totalKills}/${agg.totalDeaths}/${agg.totalAssists}  icon#${identity.profileIconId}`,
      );
    } catch (err) {
      console.warn(`  skip peer: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (peers.length === 0) {
    throw new Error('No se pudo resolver ningún peer real de Challenger');
  }

  const selfRaw = {
    userId: args.userId,
    gamerTag,
    matchCount: Number(rollup?.match_count ?? 0),
    totalKills: Number(rollup?.total_kills ?? 0),
    totalDeaths: Number(rollup?.total_deaths ?? 0),
    totalAssists: Number(rollup?.total_assists ?? 0),
    winCount: Number(rollup?.win_count ?? 0),
    source: 'user-rollup',
    leaguePoints: 0,
  };
  // Misma ventana que peers: evita ventaja por más partidas seed.
  const self = normalizeToWindow(selfRaw, MATCHES_PER_PEER);

  console.log(
    `\n→ Vos (${gamerTag}): ${self.winCount}V / ${self.matchCount} partidas · ${self.totalKills}/${self.totalDeaths}/${self.totalAssists} (normalizado a ${MATCHES_PER_PEER})`,
  );

  const deleted = await deleteExistingLolLeaderboard(doc, tableName, periodId);
  console.log(`→ Borrados ${deleted} entries viejos del leaderboard LoL`);

  const allPlayers = [...peers, self];
  const leaderboardItems = allPlayers.map((p) => ({
    PK: `LEADERBOARD#league_of_legends#WEEKLY#${periodId}`,
    SK: `USER#${p.userId}`,
    entityType: 'LEADERBOARD_ENTRY',
    userId: p.userId,
    platform: 'league_of_legends',
    periodId,
    score: scoreOf(p),
    totalKills: p.totalKills,
    matchCount: p.matchCount,
    winCount: p.winCount,
    totalDeaths: p.totalDeaths,
    totalAssists: p.totalAssists ?? 0,
    leaguePoints: p.leaguePoints ?? 0,
    lastUpdatedIso: now,
    gamerTag: p.gamerTag,
    source: p.source,
  }));

  // Profiles mínimos para que el API muestre gamerTag + avatar (no inventar USER# del cognito)
  const profileItems = peers.map((p) => ({
    PK: `USER#${p.userId}`,
    SK: 'PROFILE',
    entityType: 'PLAYER',
    userId: p.userId,
    gamerTag: p.gamerTag,
    gamerTagNormalized: p.gamerTag.trim().toLowerCase(),
    primaryPlatform: 'league_of_legends',
    leagueOfLegendsId: p.gamerTag,
    avatarUrl: p.avatarUrl,
    profileIconId: p.profileIconId,
    createdAtIso: now,
    updatedAtIso: now,
    versionId: 1,
    communitySample: true,
  }));

  let matchSum = 0;
  let killSum = 0;
  let deathSum = 0;
  let winSum = 0;
  for (const p of allPlayers) {
    matchSum += p.matchCount;
    killSum += p.totalKills;
    deathSum += p.totalDeaths;
    winSum += p.winCount;
  }

  const benchmark = {
    PK: 'COMMUNITY#league_of_legends',
    SK: `BENCHMARK#WEEKLY#${periodId}`,
    entityType: 'COMMUNITY_BENCHMARK',
    platform: 'league_of_legends',
    periodId,
    match_count: matchSum,
    total_kills: killSum,
    total_deaths: deathSum,
    win_count: winSum,
    player_count: allPlayers.length,
    lastUpdatedIso: now,
    source: 'riot-challenger-sample',
  };

  await batchPut(doc, tableName, [...leaderboardItems, ...profileItems, benchmark]);

  const ranked = [...allPlayers].sort((a, b) => scoreOf(b) - scoreOf(a));
  const yourRank = ranked.findIndex((p) => p.userId === args.userId) + 1;

  console.log('\n✓ Comunidad LoL real lista (score justo por ratios)\n');
  ranked.slice(0, 12).forEach((p, idx) => {
    const you = p.userId === args.userId ? ' ← VOS' : '';
    const wr =
      p.matchCount > 0 ? ((p.winCount / p.matchCount) * 100).toFixed(0) : '0';
    console.log(
      `  #${idx + 1} ${p.gamerTag}${you}  score ${scoreOf(p)}  WR ${wr}%  ${p.totalKills}/${p.totalDeaths}/${p.totalAssists ?? 0}  LP ${p.leaguePoints ?? 0}  (${p.matchCount}g)`,
    );
  });
  console.log(`\nTu puesto: #${yourRank} de ${ranked.length}`);
  console.log('Refrescá Inicio / Evolución con LoL activo.');
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
