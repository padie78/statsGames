/**
 * Links a perfiles públicos de Tracker.gg.
 * LoL: https://tracker.gg/lol/profile/riot/{Nombre}%23{TAG}/overview
 * Valorant: https://tracker.gg/valorant/profile/riot/{Nombre}%23{TAG}/overview
 */

function riotIdSlug(riotId: string | null | undefined): string | null {
  const raw = riotId?.trim();
  if (!raw) return null;
  const hash = raw.lastIndexOf('#');
  if (hash <= 0 || hash === raw.length - 1) return null;
  const gameName = raw.slice(0, hash).trim();
  const tagLine = raw.slice(hash + 1).trim();
  if (!gameName || !tagLine) return null;
  // Tracker usa Nombre%23TAG en el path.
  return `${encodeURIComponent(gameName)}%23${encodeURIComponent(tagLine)}`;
}

/** Riot ID válido `Nombre#TAG` → URL Tracker LoL. */
export function trackerLolProfileUrl(riotId: string | null | undefined): string | null {
  const slug = riotIdSlug(riotId);
  if (!slug) return null;
  return `https://tracker.gg/lol/profile/riot/${slug}/overview`;
}

/** Riot ID válido `Nombre#TAG` → URL Tracker Valorant. */
export function trackerValorantProfileUrl(riotId: string | null | undefined): string | null {
  const slug = riotIdSlug(riotId);
  if (!slug) return null;
  return `https://tracker.gg/valorant/profile/riot/${slug}/overview`;
}

export function looksLikeRiotId(value: string | null | undefined): boolean {
  return riotIdSlug(value) != null;
}
