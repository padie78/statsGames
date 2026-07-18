#!/usr/bin/env node
/**
 * Seed de datos mock para desarrollo — perfiles, partidas y rollups KPI.
 *
 * Uso:
 *   npm run seed:mock
 *   npm run seed:mock -- --user-id <cognito-sub>   # también carga partidas en TU cuenta
 *   TABLE_NAME=stats-games-dev-core npm run seed:mock
 *
 * Requiere: AWS credentials con acceso a DynamoDB (región eu-central-1 por defecto).
 * La tabla se lee de `terraform output table_name` si no pasás TABLE_NAME.
 */
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const AWS_REGION = process.env['AWS_REGION'] ?? 'eu-central-1';

const MOCK_PLAYERS = [
  {
    userId: 'mock-user-neofragger',
    gamerTag: 'NeoFragger',
    primaryPlatform: 'fortnite',
    fortniteId: 'fn-neo-8842',
    robloxId: null,
    leagueOfLegendsId: null,
  },
  {
    userId: 'mock-user-robloxking',
    gamerTag: 'RobloxKing99',
    primaryPlatform: 'roblox',
    fortniteId: null,
    robloxId: 'rbx-king-9912',
    leagueOfLegendsId: null,
  },
  {
    userId: 'mock-user-shadowaim',
    gamerTag: 'ShadowAim',
    primaryPlatform: 'fortnite',
    fortniteId: 'fn-shadow-3310',
    robloxId: null,
    leagueOfLegendsId: null,
  },
  {
    userId: 'mock-user-pixelqueen',
    gamerTag: 'PixelQueen',
    primaryPlatform: 'roblox',
    fortniteId: null,
    robloxId: 'rbx-pixel-5521',
    leagueOfLegendsId: null,
  },
  {
    userId: 'mock-user-trndemo',
    gamerTag: 'TRN_Demo',
    primaryPlatform: 'fortnite',
    fortniteId: 'fn-trn-demo',
    robloxId: null,
    leagueOfLegendsId: null,
  },
  {
    userId: 'mock-user-upstats',
    gamerTag: 'UpStatsPro',
    primaryPlatform: 'roblox',
    fortniteId: null,
    robloxId: 'rbx-upstats-77',
    leagueOfLegendsId: null,
  },
  // Peers LoL reales (seed) para ranking comunitario en Inicio / Evolución
  {
    userId: 'mock-user-jinxcarry',
    gamerTag: 'JinxCarry#LAN',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-jinx-carry-lan',
  },
  {
    userId: 'mock-user-ahrirose',
    gamerTag: 'AhriRose#NA1',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-ahri-rose-na1',
  },
  {
    userId: 'mock-user-zedblade',
    gamerTag: 'ZedBlade#EUW',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-zed-blade-euw',
  },
  {
    userId: 'mock-user-threshhook',
    gamerTag: 'ThreshHook#LAN',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-thresh-hook-lan',
  },
  {
    userId: 'mock-user-leesinmain',
    gamerTag: 'LeeSinMain#KR',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-leesin-main-kr',
  },
  {
    userId: 'mock-user-luxmid',
    gamerTag: 'LuxMid#NA1',
    primaryPlatform: 'league_of_legends',
    fortniteId: null,
    robloxId: null,
    leagueOfLegendsId: 'lol-lux-mid-na1',
  },
];

const LOL_CHAMPIONS = ['Jinx', 'Ahri', 'Zed', 'Thresh', 'Lee Sin', 'Lux', 'Darius', 'Yasuo'];

function parseArgs(argv) {
  const args = { userId: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--user-id' && argv[i + 1]) {
      args.userId = argv[++i];
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function normalizeGamerTag(tag) {
  return tag.trim().toLowerCase();
}

function isoWeek(date) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return String(week).padStart(2, '0');
}

function dailyPeriodId(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weeklyPeriodId(date) {
  return `${date.getUTCFullYear()}-W${isoWeek(date)}`;
}

function monthlyPeriodId(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function resolveTableName() {
  if (process.env['TABLE_NAME']) return process.env['TABLE_NAME'];
  try {
    return execSync('terraform -chdir=infra output -raw table_name', {
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error(
      'No se pudo resolver TABLE_NAME. Exportá TABLE_NAME o ejecutá desde el repo con terraform apply hecho.',
    );
  }
}

function randomMatchStats(platform) {
  if (platform === 'league_of_legends') {
    const kills = Math.floor(Math.random() * 14) + 2;
    const deaths = Math.floor(Math.random() * 9) + 1;
    const assists = Math.floor(Math.random() * 16) + 2;
    const won = Math.random() > 0.48;
    return {
      kills,
      deaths,
      assists,
      won,
      placement: won ? 1 : 2,
      champion: LOL_CHAMPIONS[Math.floor(Math.random() * LOL_CHAMPIONS.length)],
      mode: Math.random() > 0.35 ? 'Ranked Solo/Duo' : 'Normal Draft',
      cs: Math.floor(Math.random() * 120) + 80,
      visionScore: Math.floor(Math.random() * 40) + 10,
    };
  }

  const kills = Math.floor(Math.random() * 12) + 1;
  const deaths = Math.floor(Math.random() * 8);
  const placement =
    platform === 'fortnite'
      ? Math.floor(Math.random() * 100) + 1
      : Math.floor(Math.random() * 12) + 1;
  return { kills, deaths, placement, assists: Math.floor(Math.random() * 5) };
}

function buildProfileItem(player, now) {
  const normalized = normalizeGamerTag(player.gamerTag);
  return {
    PK: `USER#${player.userId}`,
    SK: 'PROFILE',
    GSI2PK: 'GAMERTAG',
    GSI2SK: `${normalized}#${player.userId}`,
    entityType: 'PLAYER',
    userId: player.userId,
    gamerTag: player.gamerTag,
    gamerTagNormalized: normalized,
    primaryPlatform: player.primaryPlatform,
    fortniteId: player.fortniteId,
    robloxId: player.robloxId,
    leagueOfLegendsId: player.leagueOfLegendsId ?? null,
    createdAtIso: now,
    updatedAtIso: now,
    versionId: 1,
  };
}

function buildGamerTagLookup(player, now) {
  const normalized = normalizeGamerTag(player.gamerTag);
  return {
    PK: `GAMERTAG#${normalized}`,
    SK: 'PROFILE',
    entityType: 'GAMERTAG_LOOKUP',
    userId: player.userId,
    gamerTag: player.gamerTag,
    updatedAtIso: now,
  };
}

function buildPlatformLink(player, platform, externalId, now) {
  return {
    PK: `PLATFORM_ACCOUNT#${platform}#${externalId}`,
    SK: 'LINK',
    entityType: 'PLATFORM_ACCOUNT_LINK',
    platform,
    externalId,
    userId: player.userId,
    updatedAtIso: now,
  };
}

function buildMatchItem(userId, platform, matchId, occurredAtIso, stats) {
  return {
    PK: `USER#${userId}`,
    SK: `MATCH#${platform}#${matchId}`,
    GSI1PK: `PLATFORM#${platform}`,
    GSI1SK: `${occurredAtIso}#${matchId}#${userId}`,
    entityType: 'MATCH',
    userId,
    matchId,
    platform,
    statsJson: JSON.stringify(stats),
    occurredAtIso,
    correlationId: randomUUID(),
    versionId: 1,
  };
}

function buildRollupItem(userId, platform, granularity, periodId, kpis, now) {
  return {
    PK: `USER#${userId}`,
    SK: `METRICS#${granularity}#${periodId}#${platform}`,
    entityType: 'STATS_ROLLUP',
    userId,
    platform,
    granularity,
    periodId,
    match_count: kpis.matchCount,
    total_kills: kpis.totalKills,
    total_deaths: kpis.totalDeaths,
    placement_sum: kpis.placementSum,
    win_count: kpis.winCount ?? 0,
    lastUpdatedIso: now,
    versionId: 1,
  };
}

function generateMatchesForPlayer(player, count = 12) {
  const matches = [];
  const platform = player.primaryPlatform;

  for (let i = 0; i < count; i += 1) {
    const daysAgo = Math.floor(Math.random() * 7);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    date.setUTCHours(Math.floor(Math.random() * 20) + 2, Math.floor(Math.random() * 59), 0, 0);

    const stats = randomMatchStats(platform);
    matches.push({
      matchId: `mock-${platform}-${String(i + 1).padStart(3, '0')}`,
      platform,
      occurredAtIso: date.toISOString(),
      stats,
    });
  }

  return matches.sort((a, b) => b.occurredAtIso.localeCompare(a.occurredAtIso));
}

function aggregateRollups(matches, platform) {
  const daily = new Map();
  const weekly = new Map();
  const monthly = new Map();

  for (const m of matches) {
    if (m.platform !== platform) continue;
    const date = new Date(m.occurredAtIso);
    const keys = [
      ['DAILY', dailyPeriodId(date), daily],
      ['WEEKLY', weeklyPeriodId(date), weekly],
      ['MONTHLY', monthlyPeriodId(date), monthly],
    ];

    for (const [granularity, periodId, map] of keys) {
      const key = `${granularity}#${periodId}`;
      const cur = map.get(key) ?? {
        granularity,
        periodId,
        matchCount: 0,
        totalKills: 0,
        totalDeaths: 0,
        placementSum: 0,
        winCount: 0,
      };
      cur.matchCount += 1;
      cur.totalKills += m.stats.kills;
      cur.totalDeaths += m.stats.deaths;
      cur.placementSum += m.stats.placement;
      if (m.stats.placement === 1) cur.winCount += 1;
      map.set(key, cur);
    }
  }

  return { daily, weekly, monthly };
}

function computeLeaderboardScore(rollup) {
  return rollup.totalKills * 10 + rollup.winCount * 100 + rollup.matchCount * 5;
}

function buildCommunitySeedItems(allItems, now) {
  const weeklyRollups = allItems.filter(
    (item) => typeof item.SK === 'string' && item.SK.startsWith('METRICS#WEEKLY#'),
  );
  const communityItems = [];
  const seenPlayers = new Set();

  for (const rollup of weeklyRollups) {
    const platform = rollup.platform;
    const periodId = rollup.periodId;
    const userId = rollup.userId;
    const seenKey = `${platform}#${periodId}#${userId}`;

    communityItems.push({
      PK: `LEADERBOARD#${platform}#WEEKLY#${periodId}`,
      SK: `USER#${userId}`,
      entityType: 'LEADERBOARD_ENTRY',
      userId,
      platform,
      periodId,
      score: computeLeaderboardScore({
        totalKills: rollup.total_kills,
        winCount: rollup.win_count ?? 0,
        matchCount: rollup.match_count,
      }),
      totalKills: rollup.total_kills,
      matchCount: rollup.match_count,
      winCount: rollup.win_count ?? 0,
      totalDeaths: rollup.total_deaths,
      lastUpdatedIso: now,
    });

    if (!seenPlayers.has(seenKey)) {
      seenPlayers.add(seenKey);
      communityItems.push({
        PK: `USER#${userId}`,
        SK: `COMMUNITY_SEEN#WEEKLY#${periodId}#${platform}`,
        entityType: 'COMMUNITY_PLAYER_SEEN',
        userId,
        platform,
        periodId,
      });
    }
  }

  const benchmarkMap = new Map();
  for (const rollup of weeklyRollups) {
    const key = `${rollup.platform}#${rollup.periodId}`;
    const cur = benchmarkMap.get(key) ?? {
      platform: rollup.platform,
      periodId: rollup.periodId,
      match_count: 0,
      total_kills: 0,
      total_deaths: 0,
      win_count: 0,
      player_count: 0,
    };
    cur.match_count += rollup.match_count;
    cur.total_kills += rollup.total_kills;
    cur.total_deaths += rollup.total_deaths;
    cur.win_count += rollup.win_count ?? 0;
    benchmarkMap.set(key, cur);
  }

  for (const seenKey of seenPlayers) {
    const [platform, periodId] = seenKey.split('#');
    const key = `${platform}#${periodId}`;
    const cur = benchmarkMap.get(key);
    if (cur) cur.player_count += 1;
  }

  for (const benchmark of benchmarkMap.values()) {
    communityItems.push({
      PK: `COMMUNITY#${benchmark.platform}`,
      SK: `BENCHMARK#WEEKLY#${benchmark.periodId}`,
      entityType: 'COMMUNITY_BENCHMARK',
      platform: benchmark.platform,
      periodId: benchmark.periodId,
      match_count: benchmark.match_count,
      total_kills: benchmark.total_kills,
      total_deaths: benchmark.total_deaths,
      win_count: benchmark.win_count,
      player_count: benchmark.player_count,
      lastUpdatedIso: now,
    });
  }

  return communityItems;
}

function seedPlayerBundle(player, now, matchCount) {
  const items = [];
  items.push(buildProfileItem(player, now));
  items.push(buildGamerTagLookup(player, now));

  if (player.fortniteId) {
    items.push(buildPlatformLink(player, 'fortnite', player.fortniteId, now));
  }
  if (player.robloxId) {
    items.push(buildPlatformLink(player, 'roblox', player.robloxId, now));
  }
  if (player.leagueOfLegendsId) {
    items.push(
      buildPlatformLink(player, 'league_of_legends', player.leagueOfLegendsId, now),
    );
  }

  const matches = generateMatchesForPlayer(player, matchCount);
  for (const m of matches) {
    items.push(buildMatchItem(player.userId, m.platform, m.matchId, m.occurredAtIso, m.stats));
  }

  const { daily, weekly, monthly } = aggregateRollups(matches, player.primaryPlatform);
  for (const map of [daily, weekly, monthly]) {
    for (const rollup of map.values()) {
      items.push(
        buildRollupItem(
          player.userId,
          player.primaryPlatform,
          rollup.granularity,
          rollup.periodId,
          rollup,
          now,
        ),
      );
    }
  }

  return items;
}

function seedCurrentUserMatches(userId, platform, now, matchCount = 18) {
  const player = {
    userId,
    gamerTag: 'CurrentUser',
    primaryPlatform: platform,
    fortniteId: platform === 'fortnite' ? `fn-${userId.slice(0, 8)}` : null,
    robloxId: platform === 'roblox' ? `rbx-${userId.slice(0, 8)}` : null,
    leagueOfLegendsId:
      platform === 'league_of_legends' ? `lol-${userId.slice(0, 8)}` : null,
  };

  const items = [];
  const matches = generateMatchesForPlayer(player, matchCount);
  for (const m of matches) {
    items.push(buildMatchItem(userId, m.platform, m.matchId, m.occurredAtIso, m.stats));
  }

  const { daily, weekly, monthly } = aggregateRollups(matches, platform);
  for (const map of [daily, weekly, monthly]) {
    for (const rollup of map.values()) {
      items.push(
        buildRollupItem(userId, platform, rollup.granularity, rollup.periodId, rollup, now),
      );
    }
  }

  return items;
}

async function batchWriteAll(doc, tableName, items) {
  const chunkSize = 25;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    let pending = chunk.map((Item) => ({ PutRequest: { Item } }));

    while (pending.length > 0) {
      const result = await doc.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: pending },
        }),
      );

      const unprocessed = result.UnprocessedItems?.[tableName] ?? [];
      pending = unprocessed;
      if (pending.length > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tableName = resolveTableName();
  const now = new Date().toISOString();

  const allItems = [];

  for (const player of MOCK_PLAYERS) {
    allItems.push(...seedPlayerBundle(player, now, 10 + Math.floor(Math.random() * 6)));
  }

  if (args.userId) {
    console.log(`→ Agregando partidas mock para tu cuenta: ${args.userId}`);
    allItems.push(...seedCurrentUserMatches(args.userId, 'fortnite', now, 20));
    allItems.push(...seedCurrentUserMatches(args.userId, 'roblox', now, 8));
    allItems.push(...seedCurrentUserMatches(args.userId, 'league_of_legends', now, 16));
  }

  allItems.push(...buildCommunitySeedItems(allItems, now));

  console.log(`Tabla: ${tableName}`);
  console.log(`Ítems a escribir: ${allItems.length}`);
  console.log(`Jugadores mock: ${MOCK_PLAYERS.map((p) => p.gamerTag).join(', ')}`);

  if (args.dryRun) {
    console.log('\n[dry-run] Primeros 3 ítems:');
    console.log(JSON.stringify(allItems.slice(0, 3), null, 2));
    return;
  }

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
  await batchWriteAll(doc, tableName, allItems);

  console.log('\n✓ Seed completado.');
  console.log('\nProbá en la app:');
  console.log('  • Topbar → buscar "NeoFragger", "JinxCarry#LAN", "ZedBlade#EUW", etc.');
  console.log('  • LoL activo → Inicio / Evolución → ranking vs comunidad');
  console.log('  • /player/NeoFragger → perfil público');
  if (args.userId) {
    console.log('  • Dashboard / Partidas / Estadísticas con tu userId (FN + Roblox + LoL)');
  } else {
    console.log('\nTip: agregá tus partidas con:');
    console.log('  npm run seed:mock -- --user-id <tu-cognito-sub>');
    console.log('  (el sub está en Config → User ID)');
  }
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
