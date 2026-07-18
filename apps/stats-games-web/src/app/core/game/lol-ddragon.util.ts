/**
 * Assets estáticos oficiales vía Riot Data Dragon + Community Dragon CDN.
 * Docs Riot: https://developer.riotgames.com/docs/lol#data-dragon
 *
 * Preferimos splash *centered* (1280×720, crop de perfil/colección):
 * mejor para banners full-bleed que el splash uncentered clásico.
 */

const DDRAGON_SPLASH_BASE = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash';
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
  const pick =
    CINEMATIC_SPLASHES[Math.abs(seed) % CINEMATIC_SPLASHES.length] ?? CINEMATIC_SPLASHES[0];
  return `${DDRAGON_SPLASH_BASE}/${pick}.jpg`;
}
