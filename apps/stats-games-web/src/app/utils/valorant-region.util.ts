/**
 * Labels cortos de región/shard Valorant (na, latam, eu…).
 * Paridad con lol-region.util.ts para chips de Partidas.
 */
const SHARD_TO_REGION: Record<string, string> = {
  na: 'NA',
  latam: 'LATAM',
  br: 'BR',
  eu: 'EU',
  ap: 'AP',
  kr: 'KR',
};

const STORAGE_KEY = 'sg.valorant.shard';

export function valorantRegionLabelFromShard(shard?: string | null): string | null {
  const key = (shard ?? '').trim().toLowerCase();
  if (!key) return null;
  return SHARD_TO_REGION[key] ?? key.toUpperCase();
}

export function readStoredValorantShard(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function persistValorantShard(shard: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, shard.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

/** Default razonable para LATAM. */
export function resolveValorantRegionLabel(explicitShard?: string | null): string {
  return (
    valorantRegionLabelFromShard(explicitShard) ||
    valorantRegionLabelFromShard(readStoredValorantShard()) ||
    'LATAM'
  );
}
