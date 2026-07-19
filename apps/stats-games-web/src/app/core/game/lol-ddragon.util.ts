/**
 * Assets estáticos oficiales vía Riot Data Dragon + Community Dragon CDN.
 * Docs Riot: https://developer.riotgames.com/docs/lol#data-dragon
 *
 * Preferimos splash *centered* (1280×720, crop de perfil/colección):
 * mejor para banners full-bleed que el splash uncentered clásico.
 */

const DDRAGON_SPLASH_BASE = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash';
/** Splash centered (cara al frente) — mejor para heroes full-bleed. */
const DDRAGON_CENTERED_BASE = 'https://ddragon.leagueoflegends.com/cdn/img/champion/centered';
const CDRAGON_CHAMP_BASE = 'https://cdn.communitydragon.org/latest/champion';

/** Claves internas cuando el display name no coincide 1:1. */
const CHAMPION_KEY_ALIASES: Record<string, string> = {
  wukong: 'MonkeyKing',
  'monkey king': 'MonkeyKing',
  "cho'gath": 'Chogath',
  chogath: 'Chogath',
  "kai'sa": 'Kaisa',
  kaisa: 'Kaisa',
  "kha'zix": 'Khazix',
  khazix: 'Khazix',
  "kog'maw": 'KogMaw',
  kogmaw: 'KogMaw',
  leblanc: 'Leblanc',
  'lee sin': 'LeeSin',
  leesin: 'LeeSin',
  'master yi': 'MasterYi',
  masteryi: 'MasterYi',
  'miss fortune': 'MissFortune',
  missfortune: 'MissFortune',
  'dr. mundo': 'DrMundo',
  'dr mundo': 'DrMundo',
  drmundo: 'DrMundo',
  'jarvan iv': 'JarvanIV',
  jarvaniv: 'JarvanIV',
  'renata glasc': 'Renata',
  renata: 'Renata',
  'nunu & willump': 'Nunu',
  'nunu and willump': 'Nunu',
  nunu: 'Nunu',
  "bel'veth": 'Belveth',
  belveth: 'Belveth',
  "rek'sai": 'RekSai',
  reksai: 'RekSai',
  "vel'koz": 'Velkoz',
  velkoz: 'Velkoz',
  tahmkench: 'TahmKench',
  'tahm kench': 'TahmKench',
  twistedfate: 'TwistedFate',
  'twisted fate': 'TwistedFate',
  xinzhao: 'XinZhao',
  'xin zhao': 'XinZhao',
  aurelionsol: 'AurelionSol',
  'aurelion sol': 'AurelionSol',
};

/**
 * Splash cinematicos (Data Dragon) — skins con arte fuerte para banner.
 * Formato: ChampionKey_skinNum
 */
/** Splash para Inicio / resumen semanal. */
const CINEMATIC_SPLASHES = [
  'Jinx_37', // Arcane
  'Ahri_27', // Spirit Blossom
  'Yasuo_36', // Nightbringer / high impact
  'Lux_15', // Elementalist vibe / strong light
  'Thresh_5', // Dark Star
  'MissFortune_16', // Gun Goddess
  'LeeSin_31', // God Fist / strong pose
  'Darius_15', // Dreadnova
] as const;

/**
 * Splash distintos para Partidas (combate / ranked vibe).
 * No reutilizar los de Inicio para que cada vista tenga identidad visual.
 */
const MATCHES_CINEMATIC_SPLASHES = [
  'Zed_13', // Galaxy Slayer
  'Aatrox_7', // Prestige / bloodied
  'Samira_1', // PsyOps
  'Pyke_16', // Empyrean
  'Diana_11', // Dark Waters
  'Sett_10', // Obsidian Dragon
  'Viego_1', // Lunar Beast
  'Riven_16', // Dawnbringer
] as const;

/** Evolución: progreso / control / macro. */
const EVOLUTION_CINEMATIC_SPLASHES = [
  'Ashe_11', // High Noon
  'Azir_2', // Galactic
  'Orianna_7', // Dark Star
  'Syndra_6', // Star Guardian
  'KaiSa_26', // Star Guardian
  'Anivia_5', // Blackfrost
  'Viktor_14', // Arcane
  'TwistedFate_13', // Crime City Nightmare
] as const;

/** Coach IA: mentores / utilidad / focus. */
const COACH_CINEMATIC_SPLASHES = [
  'Karma_14', // Immortal Journey
  'Lulu_15', // Star Guardian
  'Soraka_15', // Immortal Journey
  'Janna_5', // Forecast
  'Nami_7', // Program
  'Yuumi_11', // Heartseeker
  'Seraphine_1', // K/DA ALL OUT
  'Sona_6', // DJ Sona / Odyssey
] as const;

/** Perfil público: identidad / prestige. */
const PROFILE_CINEMATIC_SPLASHES = [
  'Akali_14', // True Damage
  'Katarina_29', // Battle Queen
  'Ezreal_5', // Pulsefire
  'Fiora_4', // Headmistress
  'Irelia_15', // Sentinel
  'Caitlyn_11', // Pulsefire
  'Leblanc_20', // Prestige
  'Camille_2', // Program
] as const;

/**
 * Banner: siempre splash *centered* del campeón (skin 0).
 * Las skins cinematográficas wide cortan caras en heroes bajos;
 * el centered base mantiene el foco en el personaje principal.
 */
function splashKeyToCenteredUrl(skinKey: string): string {
  const champKey = skinKey.split('_')[0] || 'Jinx';
  return `${DDRAGON_CENTERED_BASE}/${champKey}_0.jpg`;
}

/** Wide cinematic (fallback si no hay centered). */
function splashKeyToWideUrl(skinKey: string): string {
  return `${DDRAGON_SPLASH_BASE}/${skinKey}.jpg`;
}

function pickDdragonSplash(pool: readonly string[], seed: number): string {
  const pick = pool[Math.abs(seed) % pool.length] ?? pool[0];
  return splashKeyToCenteredUrl(pick);
}

/** Fallback wide si falla el centered (usar desde onError de banners). */
export function lolBannerSplashFallbackUrl(
  seed: number,
  pool: 'home' | 'matches' | 'evolution' | 'coach' | 'profile' = 'home',
): string {
  const map = {
    home: CINEMATIC_SPLASHES,
    matches: MATCHES_CINEMATIC_SPLASHES,
    evolution: EVOLUTION_CINEMATIC_SPLASHES,
    coach: COACH_CINEMATIC_SPLASHES,
    profile: PROFILE_CINEMATIC_SPLASHES,
  } as const;
  const list = map[pool];
  const pick = list[Math.abs(seed) % list.length] ?? list[0];
  return splashKeyToWideUrl(pick);
}

export function lolChampionKey(name: string | null | undefined): string | null {
  const raw = name?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (CHAMPION_KEY_ALIASES[lower]) return CHAMPION_KEY_ALIASES[lower];
  const compact = raw.replace(/['.]/g, '').replace(/\s+/g, '');
  if (!compact) return null;
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

/**
 * Splash centered HQ (Community Dragon) — crop pensado para fondos de perfil.
 * Fallback Data Dragon splash del mismo campeón.
 */
export function lolChampionSplashUrl(
  championName: string | null | undefined,
  skinNum = 0,
): string | null {
  const key = lolChampionKey(championName);
  if (!key) return null;
  const slug = key.toLowerCase();
  if (skinNum === 0) {
    return `${CDRAGON_CHAMP_BASE}/${slug}/splash-art/centered`;
  }
  return `${DDRAGON_SPLASH_BASE}/${key}_${skinNum}.jpg`;
}

/** Splash Data Dragon (útil como 2º intento si falla Community Dragon). */
export function lolChampionSplashFallbackUrl(
  championName: string | null | undefined,
  skinNum = 0,
): string | null {
  const key = lolChampionKey(championName);
  if (!key) return null;
  return `${DDRAGON_SPLASH_BASE}/${key}_${skinNum}.jpg`;
}

export function lolFallbackSplashUrl(seed = 0): string {
  return pickDdragonSplash(CINEMATIC_SPLASHES, seed);
}

/** Banner de Partidas: pool cinematic distinto al de Inicio. */
export function lolMatchesBannerSplashUrl(seed = 0): string {
  return pickDdragonSplash(MATCHES_CINEMATIC_SPLASHES, seed);
}

/** Banner de Evolución. */
export function lolEvolutionBannerSplashUrl(seed = 0): string {
  return pickDdragonSplash(EVOLUTION_CINEMATIC_SPLASHES, seed);
}

/** Banner de Coach IA. */
export function lolCoachBannerSplashUrl(seed = 0): string {
  return pickDdragonSplash(COACH_CINEMATIC_SPLASHES, seed);
}

/** Banner de Perfil. */
export function lolProfileBannerSplashUrl(seed = 0): string {
  return pickDdragonSplash(PROFILE_CINEMATIC_SPLASHES, seed);
}
