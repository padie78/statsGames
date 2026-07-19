/**
 * Labels cortos de región LoL a partir del platform routing (la1, na1…).
 * Usado en badge de muestra cuando no hay rank nativo en el perfil.
 */
const ROUTING_TO_REGION: Record<string, string> = {
  la1: 'LAN',
  la2: 'LAS',
  na1: 'NA',
  euw1: 'EUW',
  eun1: 'EUNE',
  br1: 'BR',
  kr: 'KR',
  jp1: 'JP',
  oc1: 'OCE',
  tr1: 'TR',
  ru: 'RU',
  ph2: 'PH',
  sg2: 'SG',
  th2: 'TH',
  tw2: 'TW',
  vn2: 'VN',
};

/** Preferencia local si el usuario eligió shard en Integraciones / seed. */
const STORAGE_KEY = 'sg.lol.routingPlatform';

export function lolRegionLabelFromRouting(routing?: string | null): string | null {
  const key = (routing ?? '').trim().toLowerCase();
  if (!key) return null;
  return ROUTING_TO_REGION[key] ?? key.toUpperCase();
}

export function readStoredLolRoutingPlatform(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function persistLolRoutingPlatform(routing: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, routing.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

/** Default razonable para LATAM (seed Challenger usa la1). */
export function resolveLolRegionLabel(explicitRouting?: string | null): string {
  return (
    lolRegionLabelFromRouting(explicitRouting) ||
    lolRegionLabelFromRouting(readStoredLolRoutingPlatform()) ||
    'LAN'
  );
}
