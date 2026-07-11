/**
 * Experiences Roblox trackeadas (badges / hitos).
 * UI top-level: blox_fruits, adopt_me, brookhaven (+ BedWars/Arsenal en poller).
 */

export type RobloxExperienceId =
  | 'bedwars'
  | 'arsenal'
  | 'blox_fruits'
  | 'adopt_me'
  | 'brookhaven';

export interface RobloxTrackedBadge {
  id: number;
  name: string;
  competitive: boolean;
}

export interface RobloxExperienceConfig {
  id: RobloxExperienceId;
  label: string;
  placeId: number;
  universeId: number;
  trackedBadges: RobloxTrackedBadge[];
  competitiveBadgeHints: string[];
}

export const ROBLOX_EXPERIENCES: Record<RobloxExperienceId, RobloxExperienceConfig> = {
  bedwars: {
    id: 'bedwars',
    label: 'BedWars',
    placeId: 6872265039,
    universeId: 2619619496,
    competitiveBadgeHints: ['champion', 'victorious', 'victory', 'win', 'ranked', 'diamond'],
    trackedBadges: [
      { id: 2146951156, name: 'Champion', competitive: true },
      { id: 2129916158, name: 'Be Victorious on Minigame Mountain', competitive: true },
    ],
  },
  arsenal: {
    id: 'arsenal',
    label: 'Arsenal',
    placeId: 286090429,
    universeId: 111958650,
    competitiveBadgeHints: ['victory', 'podium', 'golden', 'commander', 'sharpshooter', '10k'],
    trackedBadges: [
      { id: 2124444711, name: 'Golden Touch', competitive: true },
      { id: 2124485631, name: 'Podium of Gold', competitive: true },
      { id: 2124445040, name: 'Sharpshooter', competitive: true },
      { id: 2124444717, name: 'Commander', competitive: true },
    ],
  },
  blox_fruits: {
    id: 'blox_fruits',
    label: 'Blox Fruits',
    placeId: 2753915549,
    universeId: 994732206,
    competitiveBadgeHints: ['sea', 'fruit', 'awakening', 'raid', 'master', 'level'],
    trackedBadges: [
      { id: 2125253106, name: 'Second Sea', competitive: true },
      { id: 2125253113, name: 'Third Sea', competitive: true },
    ],
  },
  adopt_me: {
    id: 'adopt_me',
    label: 'Adopt Me!',
    placeId: 920587237,
    universeId: 383310974,
    competitiveBadgeHints: ['adopt', 'quest', 'shine', 'legendary', 'neon', 'mega', 'pet'],
    trackedBadges: [
      { id: 2124439922, name: 'Tiny Isles', competitive: false },
      { id: 1048893619880427, name: 'Roblox The Games: Adopt Me! - Quest 1', competitive: true },
      { id: 763171671267524, name: 'Roblox The Games: Adopt Me! - Quest 2', competitive: true },
      { id: 925260774262149, name: 'Roblox The Games: Adopt Me! - Quest 3', competitive: true },
    ],
  },
  brookhaven: {
    id: 'brookhaven',
    label: 'Brookhaven RP',
    placeId: 4924922222,
    universeId: 1686885941,
    competitiveBadgeHints: ['brookhaven', 'house', 'job', 'roleplay'],
    /** Brookhaven casi no publica badges; se mantiene para UI + webhook. */
    trackedBadges: [],
  },
};

export const ROBLOX_EXPERIENCE_LIST = Object.values(ROBLOX_EXPERIENCES);

/** Experiences visibles en el switcher de juegos del front. */
export const ROBLOX_UI_EXPERIENCE_IDS: RobloxExperienceId[] = [
  'blox_fruits',
  'adopt_me',
  'brookhaven',
];

export function resolveRobloxExperienceByUniverseId(
  universeId: number,
): RobloxExperienceConfig | null {
  return ROBLOX_EXPERIENCE_LIST.find((e) => e.universeId === universeId) ?? null;
}

export function isCompetitiveBadge(experience: RobloxExperienceConfig, badgeName: string): boolean {
  const lower = badgeName.toLowerCase();
  return experience.competitiveBadgeHints.some((hint) => lower.includes(hint));
}

export function allTrackedRobloxBadges(): Array<
  RobloxTrackedBadge & { experience: RobloxExperienceConfig }
> {
  return ROBLOX_EXPERIENCE_LIST.flatMap((experience) =>
    experience.trackedBadges.map((badge) => ({ ...badge, experience })),
  );
}
