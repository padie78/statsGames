#!/usr/bin/env node
/**
 * Chequea ownership de badges BedWars / Arsenal (misma lógica que el poller).
 *
 *   npm run probe:roblox -- 8367095373
 */

const EXPERIENCES = [
  {
    label: 'BedWars',
    universeId: 2619619496,
    hints: ['champion', 'victorious', 'victory', 'win', 'ranked', 'diamond', 'emerald', 'nightmare'],
    curated: [
      { id: 2146951156, name: 'Champion' },
      { id: 2129916158, name: 'Be Victorious on Minigame Mountain' },
      { id: 661345209724224, name: 'The Hunt - BedWars' },
    ],
  },
  {
    label: 'Arsenal',
    universeId: 111958650,
    hints: [
      'victory',
      'podium',
      'golden',
      'commander',
      'enforcer',
      'sharpshooter',
      'server sweeper',
      '10k',
      'arms race',
      'shared victory',
      'stepping',
    ],
    curated: [
      { id: 2124444711, name: 'Golden Touch' },
      { id: 2124485633, name: 'A Shared Victory' },
      { id: 2124485630, name: 'An Arsenal Arms Race' },
      { id: 2124485631, name: 'Podium of Gold' },
      { id: 2124444712, name: 'Stepping Stone' },
      { id: 2124445040, name: 'Sharpshooter' },
      { id: 2124445041, name: 'Server Sweeper' },
      { id: 2124470375, name: '10K Takeover' },
      { id: 2124444717, name: 'Commander' },
      { id: 2124445038, name: 'Enforcer' },
    ],
  },
];

const userId = (process.argv[2] || process.env.SG_PLATFORM_USER_ID || '').trim();
if (!userId || !/^\d+$/.test(userId)) {
  console.error('Pasá un Roblox UserId numérico: npm run probe:roblox -- 123456789');
  process.exit(1);
}

async function fetchUniverseBadges(universeId) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 8; page += 1) {
    const qs = new URLSearchParams({ limit: '100', sortOrder: 'Asc' });
    if (cursor) qs.set('cursor', cursor);
    const url = `https://badges.roblox.com/v1/universes/${universeId}/badges?${qs}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'StatsGames/1.0' },
    });
    if (!response.ok) throw new Error(`universe ${universeId}: ${response.status}`);
    const body = await response.json();
    out.push(...(body.data ?? []));
    cursor = body.nextPageCursor ?? null;
    if (!cursor) break;
  }
  return out;
}

async function ownsBadge(badgeId) {
  const url = `https://inventory.roblox.com/v1/users/${encodeURIComponent(userId)}/items/Badge/${badgeId}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'StatsGames/1.0' },
  });
  if (!response.ok) return false;
  const body = await response.json();
  return Array.isArray(body.data) && body.data.length > 0;
}

const owned = [];
for (const exp of EXPERIENCES) {
  const remote = await fetchUniverseBadges(exp.universeId);
  const byId = new Map(exp.curated.map((b) => [b.id, b.name]));
  for (const b of remote) {
    const name = b.name ?? '';
    const competitive = exp.hints.some((h) => name.toLowerCase().includes(h));
    if (exp.label === 'BedWars' || competitive || byId.has(b.id)) {
      byId.set(b.id, name || byId.get(b.id) || String(b.id));
    }
  }

  for (const [id, name] of byId) {
    if (await ownsBadge(id)) {
      const competitive = exp.hints.some((h) => String(name).toLowerCase().includes(h));
      owned.push({ experience: exp.label, id, name, competitive });
    }
  }
}

console.log(`UserId ${userId}`);
for (const label of ['BedWars', 'Arsenal']) {
  const list = owned.filter((o) => o.experience === label);
  console.log(
    `${label}: ${list.length} owned (competitivos: ${list.filter((o) => o.competitive).length})`,
  );
}
console.log('\nOwned:');
for (const hit of owned) {
  console.log(`  [${hit.experience}]${hit.competitive ? ' ★' : ''} ${hit.name}`);
}
if (owned.length === 0) {
  console.log('\nSin badges trackeados. Jugá BedWars/Arsenal o verificá el UserId.');
}
