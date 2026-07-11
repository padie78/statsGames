export interface ParsedMatchSummary {
  /** Título principal de la card (modo Fortnite o experiencia Roblox). */
  primaryLabel: string;
  /** Línea secundaria sin repetir el título. */
  detailLine: string | null;
  /** Nombre de la experiencia Roblox, si viene en el summary. */
  experienceName: string | null;
  /** Modo Fortnite, si viene en el summary. */
  modeLabel: string | null;
}

export function isRobloxPlatform(platform: string): boolean {
  return platform?.toLowerCase() === 'roblox';
}

export function isFortnitePlatform(platform: string): boolean {
  return platform?.toLowerCase() === 'fortnite';
}

export function isValorantPlatform(platform: string): boolean {
  return platform?.toLowerCase() === 'valorant';
}

export function isRocketLeaguePlatform(platform: string): boolean {
  return platform?.toLowerCase() === 'rocket_league';
}

export function parseMatchSummary(platform: string, summary: string): ParsedMatchSummary {
  const trimmed = summary?.trim() ?? '';
  const segments = trimmed
    .split('·')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (isRobloxPlatform(platform)) {
    const experienceName = segments[0] ?? null;
    return {
      primaryLabel: experienceName ?? 'Sesión Roblox',
      detailLine: segments.length > 1 ? segments.slice(1).join(' · ') : null,
      experienceName,
      modeLabel: null,
    };
  }

  const modeLabel = segments[0] ?? null;
  const fallback = isValorantPlatform(platform)
    ? 'Valorant'
    : isRocketLeaguePlatform(platform)
      ? 'Rocket League'
      : isFortnitePlatform(platform)
        ? 'Fortnite'
        : 'Partida';

  return {
    primaryLabel: modeLabel ?? fallback,
    detailLine: segments.length > 1 ? segments.slice(1).join(' · ') : null,
    experienceName: null,
    modeLabel,
  };
}

/** Contexto legible para narrativa IA — nunca trata Roblox como un solo juego. */
export function matchSessionContext(platform: string, summary: string): string {
  const parsed = parseMatchSummary(platform, summary);

  if (isRobloxPlatform(platform)) {
    return parsed.experienceName ? `en ${parsed.experienceName}` : 'en esta sesión de Roblox';
  }

  return parsed.modeLabel ? `en ${parsed.modeLabel}` : 'en modo ranked';
}
