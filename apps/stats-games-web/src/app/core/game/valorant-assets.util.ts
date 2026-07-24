/**
 * Arte oficial de agentes vía media.valorant-api.com (mismo patrón que DDragon en LoL).
 * Full portrait para heroes/cards; bust como fallback.
 */

const MEDIA_BASE = 'https://media.valorant-api.com/agents';

/** UUID oficiales (playable) — valorant-api.com. */
const AGENT_UUIDS: Record<string, string> = {
  gekko: 'e370fa57-4757-3604-3648-499e1f642d3f',
  fade: 'dade69b4-4f5a-8528-247b-219e5a1facd6',
  breach: '5f8d3a7f-467b-97f3-062c-13acf203c006',
  deadlock: 'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235',
  tejo: 'b444168c-4e35-8076-db47-ef9bf368f384',
  raze: 'f94c3b30-42be-e959-889c-5aa313dba261',
  chamber: '22697a3d-45bf-8dd7-4fec-84a9e28c69d7',
  'kay/o': '601dbbe7-43ce-be57-2a40-4abd24953621',
  kayo: '601dbbe7-43ce-be57-2a40-4abd24953621',
  skye: '6f2a04ca-43e0-be17-7f36-b3908627744d',
  cypher: '117ed9e3-49f3-6512-3ccf-0cada7e3823b',
  sova: '320b2a48-4d9b-a075-30f1-1f93a9b638fa',
  killjoy: '1e58de9c-4950-5125-93e9-a0aee9f98746',
  harbor: '95b78ed7-4637-86d9-7e41-71ba8c293152',
  vyse: 'efba5359-4016-a1e5-7626-b1ae76895940',
  viper: '707eab51-4836-f488-046a-cda6bf494859',
  phoenix: 'eb93336a-449b-9c1b-0a54-a891f7921d69',
  astra: '41fb69c1-4189-7b37-f117-bcaf1e96f1bf',
  brimstone: '9f0d8ba9-4140-b941-57d3-a7ad57c6b417',
  iso: '0e38b510-41a8-5780-5e8f-568b2a4f2d6c',
  clove: '1dbf2edd-4729-0984-3115-daa5eed44993',
  neon: 'bb2a4828-46eb-8cd1-e765-15848195d751',
  yoru: '7f94d92c-4234-0a36-9646-3a87eb8b5c89',
  waylay: 'df1cb487-4902-002e-5c17-d28e83e78588',
  sage: '569fdd95-4d10-43ab-ca70-79becc718b46',
  reyna: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc',
  omen: '8e253930-4c05-31dd-1b6c-968525494517',
  jett: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
};

/** Pools por vista — mismos keys que LoL cinematic pools. */
const HOME_AGENTS = ['jett', 'reyna', 'phoenix', 'raze', 'neon', 'chamber', 'yoru', 'iso'] as const;
const MATCHES_AGENTS = ['raze', 'jett', 'reyna', 'phoenix', 'sova', 'breach', 'gekko', 'fade'] as const;
const EVOLUTION_AGENTS = ['sova', 'cypher', 'killjoy', 'viper', 'omen', 'astra', 'harbor', 'vyse'] as const;
const COACH_AGENTS = ['sage', 'skye', 'brimstone', 'kayo', 'omen', 'killjoy', 'cypher', 'clove'] as const;
const PROFILE_AGENTS = ['chamber', 'reyna', 'jett', 'fade', 'neon', 'iso', 'deadlock', 'tejo'] as const;

export type ValorantBannerPool = 'home' | 'matches' | 'evolution' | 'coach' | 'profile';

function poolFor(pool: ValorantBannerPool): readonly string[] {
  switch (pool) {
    case 'matches':
      return MATCHES_AGENTS;
    case 'evolution':
      return EVOLUTION_AGENTS;
    case 'coach':
      return COACH_AGENTS;
    case 'profile':
      return PROFILE_AGENTS;
    default:
      return HOME_AGENTS;
  }
}

function pickAgentKey(pool: readonly string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length] ?? pool[0] ?? 'jett';
}

export function valorantAgentKey(name: string | null | undefined): string | null {
  const raw = name?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, '');
  if (AGENT_UUIDS[lower]) return lower;
  if (lower === 'kay/o' || lower === 'kayo') return 'kayo';
  return AGENT_UUIDS[lower] ? lower : null;
}

export function valorantAgentUuid(name: string | null | undefined): string | null {
  const key = valorantAgentKey(name);
  if (!key) return null;
  return AGENT_UUIDS[key] ?? null;
}

/** Full portrait HQ — heroes y splash de cards. */
export function valorantAgentSplashUrl(agentName: string | null | undefined): string | null {
  const uuid = valorantAgentUuid(agentName);
  if (!uuid) return null;
  return `${MEDIA_BASE}/${uuid}/fullportrait.png`;
}

/** Bust portrait — 2º intento si falla fullportrait. */
export function valorantAgentSplashFallbackUrl(agentName: string | null | undefined): string | null {
  const uuid = valorantAgentUuid(agentName);
  if (!uuid) return null;
  return `${MEDIA_BASE}/${uuid}/bustportrait.png`;
}

function splashFromPool(pool: ValorantBannerPool, seed: number, bust = false): string {
  const key = pickAgentKey(poolFor(pool), seed);
  const uuid = AGENT_UUIDS[key] ?? AGENT_UUIDS['jett'];
  return `${MEDIA_BASE}/${uuid}/${bust ? 'bustportrait' : 'fullportrait'}.png`;
}

export function valorantFallbackSplashUrl(seed = 0): string {
  return splashFromPool('home', seed);
}

export function valorantMatchesBannerSplashUrl(seed = 0): string {
  return splashFromPool('matches', seed);
}

export function valorantEvolutionBannerSplashUrl(seed = 0): string {
  return splashFromPool('evolution', seed);
}

export function valorantCoachBannerSplashUrl(seed = 0): string {
  return splashFromPool('coach', seed);
}

export function valorantProfileBannerSplashUrl(seed = 0): string {
  return splashFromPool('profile', seed);
}

/** Fallback si falla el fullportrait del pool. */
export function valorantBannerSplashFallbackUrl(
  seed: number,
  pool: ValorantBannerPool = 'home',
): string {
  return splashFromPool(pool, seed, true);
}
