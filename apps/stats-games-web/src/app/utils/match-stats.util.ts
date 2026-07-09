import type { MatchCardStats } from '../ui/molecules/match-stat-card/match-stat-card.component';

export interface MatchStatsView {
  kills?: number | null;
  deaths?: number | null;
  placement?: number | null;
  assists?: number | null;
}

export function toMatchCardStats(stats?: MatchStatsView | null): MatchCardStats {
  if (!stats) return {};
  return {
    kills: stats.kills ?? undefined,
    deaths: stats.deaths ?? undefined,
    placement: stats.placement ?? undefined,
    assists: stats.assists ?? undefined,
  };
}

export function computeKdRatio(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? kills.toFixed(1) : '0.0';
  return (kills / deaths).toFixed(2);
}

export function buildPlayerShareUrl(gamerTag: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/player/${encodeURIComponent(gamerTag)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
