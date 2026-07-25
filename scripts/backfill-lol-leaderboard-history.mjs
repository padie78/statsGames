#!/usr/bin/env node
/**
 * Backfill de leaderboards LoL semanales a partir del board más reciente.
 * Sin esto, 30d y 90d agregan las mismas semanas no-vacías y la grilla no cambia.
 *
 * Uso:
 *   node scripts/backfill-lol-leaderboard-history.mjs
 *   node scripts/backfill-lol-leaderboard-history.mjs --weeks 12 --from 2026-W30
 */
import { execSync } from 'node:child_process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const AWS_REGION = process.env['AWS_REGION'] ?? 'eu-central-1';

function parseArgs(argv) {
  const args = { weeks: 12, from: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--weeks' && argv[i + 1]) args.weeks = Number(argv[++i]);
    if (argv[i] === '--from' && argv[i + 1]) args.from = argv[++i];
  }
  return args;
}

function resolveTableName() {
  if (process.env['TABLE_NAME']) return process.env['TABLE_NAME'];
  return execSync('terraform -chdir=infra output -raw table_name', {
    encoding: 'utf8',
  }).trim();
}

function isoWeekPeriodId(date = new Date()) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weeklyPeriodIdWeeksAgo(weeksAgo, fromPeriodId) {
  const match = /^(\d{4})-W(\d{2})$/.exec(fromPeriodId);
  if (!match) return isoWeekPeriodId();
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  monday.setUTCDate(monday.getUTCDate() - weeksAgo * 7);
  return isoWeekPeriodId(monday);
}

function scoreOf(p) {
  const matches = Math.max(0, Math.floor(p.matchCount));
  if (matches === 0) return 0;
  const deaths = Math.max(1, p.totalDeaths);
  const assists = Math.max(0, p.totalAssists ?? 0);
  const kda = (p.totalKills + assists) / deaths;
  const winRate = (p.winCount / matches) * 100;
  const killsPerGame = p.totalKills / matches;
  const reliability = Math.min(1, matches / 5);
  return Math.round((kda * 100 + winRate * 1.5 + killsPerGame * 12) * reliability);
}

/** Hash estable 0..1 por userId+periodId. */
function unitNoise(userId, periodId, salt = 0) {
  let h = salt * 374761393;
  const s = `${userId}|${periodId}|${salt}`;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function perturbPeer(base, periodId, weeksAgo) {
  // Semanas más viejas: un poco menos de volumen y más varianza de forma.
  const ageFade = 1 - Math.min(0.35, weeksAgo * 0.025);
  const form = 0.55 + unitNoise(base.userId, periodId, 1) * 0.9; // 0.55–1.45
  const aggression = 0.65 + unitNoise(base.userId, periodId, 2) * 0.7;
  const matchCount = Math.max(3, Math.round((base.matchCount || 5) * ageFade));
  const totalKills = Math.max(0, Math.round(base.totalKills * form * aggression * ageFade));
  const totalDeaths = Math.max(1, Math.round(base.totalDeaths * (2.1 - form) * ageFade));
  const totalAssists = Math.max(0, Math.round((base.totalAssists ?? 0) * form * ageFade));
  const winRateBase = base.matchCount > 0 ? base.winCount / base.matchCount : 0.5;
  const winJitter = (unitNoise(base.userId, periodId, 3) - 0.5) * 0.4;
  const winRate = Math.min(1, Math.max(0.05, winRateBase * form + winJitter));
  const winCount = Math.min(matchCount, Math.max(0, Math.round(matchCount * winRate)));
  const leaguePoints = Math.max(
    0,
    Math.round((base.leaguePoints ?? 0) * (0.85 + unitNoise(base.userId, periodId, 4) * 0.35)),
  );
  return {
    ...base,
    matchCount,
    totalKills,
    totalDeaths,
    totalAssists,
    winCount,
    leaguePoints,
    score: 0,
  };
}

/** Algunos peers faltan en semanas viejas → 90d trae gente/volumen que 30d no. */
function selectPeersForWeek(peers, periodId, weeksAgo) {
  if (weeksAgo <= 4) return peers;
  const keepRate = Math.max(0.55, 1 - weeksAgo * 0.03);
  return peers.filter((p) => unitNoise(p.userId, periodId, 7) < keepRate);
}

async function loadBoard(doc, tableName, periodId) {
  const pk = `LEADERBOARD#league_of_legends#WEEKLY#${periodId}`;
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await doc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ExclusiveStartKey,
      }),
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function deleteBoard(doc, tableName, periodId) {
  const items = await loadBoard(doc, tableName, periodId);
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
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
        },
      }),
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tableName = resolveTableName();
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
  const sourcePeriod = args.from ?? isoWeekPeriodId();
  const weeks = Math.max(1, Math.min(20, Math.floor(args.weeks)));

  console.log(`Tabla: ${tableName}`);
  console.log(`Fuente: ${sourcePeriod} → backfill ${weeks} semanas atrás`);

  const source = await loadBoard(doc, tableName, sourcePeriod);
  if (!source.length) {
    throw new Error(`No hay entries en ${sourcePeriod}. Corré primero seed-lol-community-real.mjs`);
  }

  // No clonar al usuario real: su fila sale de sus rollups/partidas.
  const peers = source.filter((row) => row.source !== 'user-rollup');
  console.log(`Peers base: ${peers.length} (se omite user-rollup)`);

  const now = new Date().toISOString();
  let writtenWeeks = 0;

  for (let weeksAgo = 1; weeksAgo <= weeks; weeksAgo += 1) {
    const periodId = weeklyPeriodIdWeeksAgo(weeksAgo, sourcePeriod);
    if (periodId === sourcePeriod) continue;

    const deleted = await deleteBoard(doc, tableName, periodId);
    const weekPeers = selectPeersForWeek(peers, periodId, weeksAgo).map((p) =>
      perturbPeer(p, periodId, weeksAgo),
    );
    for (const p of weekPeers) p.score = scoreOf(p);

    const leaderboardItems = weekPeers.map((p) => ({
      PK: `LEADERBOARD#league_of_legends#WEEKLY#${periodId}`,
      SK: `USER#${p.userId}`,
      entityType: 'LEADERBOARD_ENTRY',
      userId: p.userId,
      platform: 'league_of_legends',
      periodId,
      score: p.score,
      totalKills: p.totalKills,
      matchCount: p.matchCount,
      winCount: p.winCount,
      totalDeaths: p.totalDeaths,
      totalAssists: p.totalAssists ?? 0,
      leaguePoints: p.leaguePoints ?? 0,
      lastUpdatedIso: now,
      gamerTag: p.gamerTag,
      source: 'history-backfill',
    }));

    let matchSum = 0;
    let killSum = 0;
    let deathSum = 0;
    let winSum = 0;
    for (const p of weekPeers) {
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
      player_count: weekPeers.length,
      lastUpdatedIso: now,
      source: 'history-backfill',
    };

    await batchPut(doc, tableName, [...leaderboardItems, benchmark]);
    writtenWeeks += 1;
    const top = [...weekPeers].sort((a, b) => b.score - a.score)[0];
    console.log(
      `  ✓ ${periodId}  peers=${weekPeers.length}  (borrados ${deleted})  #1 ${top?.gamerTag} score ${top?.score}`,
    );
  }

  console.log(`\n✓ Backfill listo: ${writtenWeeks} semanas. 30d ≠ 90d en la grilla.`);
  console.log('Refrescá Inicio / Evolución y cambiá el rango.');
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
