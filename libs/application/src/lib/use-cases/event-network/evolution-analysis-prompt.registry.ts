import type { GamePlatform } from '@stats-games/domain';

export interface EvolutionPromptContext {
  userId: string;
  platform: GamePlatform;
  periodId: string;
  gamerTag?: string;
  weekly: {
    matchCount: number;
    totalKills: number;
    totalDeaths: number;
    totalAssists?: number;
    winCount?: number;
    avgPlacement?: number;
  };
  previousWeekly?: {
    matchCount: number;
    totalKills: number;
    totalDeaths: number;
  } | null;
  dailyTrend: Array<{
    periodId: string;
    matchCount: number;
    totalKills: number;
    totalDeaths: number;
  }>;
  recentMatches: Array<{
    matchId: string;
    summary: string;
    won?: boolean | null;
    kills?: number | null;
    deaths?: number | null;
    assists?: number | null;
    champion?: string | null;
    placement?: number | null;
  }>;
  community?: {
    yourRank?: number | null;
    sampleSize?: number | null;
    avgKd?: number | null;
    avgWinRate?: number | null;
  } | null;
}

export function buildEvolutionAnalysisPrompt(ctx: EvolutionPromptContext): string {
  const platformLabel = labelForPlatform(ctx.platform);
  const tone = toneForPlatform(ctx.platform);

  return `Actuás como coach de rendimiento de StatsGames para el rol JUGADOR.
Analizás la EVOLUCIÓN táctica a lo largo del tiempo (macro semanal), no una sola partida.
Juego: ${platformLabel}. Periodo: ${ctx.periodId}.
Tono: ${tone}

Respondé SOLO con JSON válido (sin fences) con esta forma:
{
  "headline": string,
  "summary": string (1-2 oraciones),
  "markdown": string,
  "performanceScore": number 0-100,
  "gradeLabel": string (S|A|B|C|D),
  "verdict": "ascending" | "stable" | "declining" | "volatile",
  "pros": string[],
  "cons": string[],
  "actionPlan": string[] (exactamente 3 pasos concretos para la próxima semana)
}

El markdown debe empezar con este encabezado y secciones:
# Informe de evolución — ${platformLabel}
## Forma de la semana
## Tendencia vs semana anterior
## Fortalezas mecánicas
## Riesgos / regresiones
## Plan de foco (próximos 7 días)

Reglas:
- Segunda persona (vos).
- No inventes mapas, campeones, armas ni modos ausentes en los datos.
- Anclá cada afirmación a métricas (WR, KDA/KD, kills/partida, volumen, racha).
- Si hay pocos datos, decilo y bajá la confianza del score.
- Compará tendencia diaria y delta vs semana previa cuando exista.

Datos del jugador:
gamerTag: ${ctx.gamerTag ?? 'n/a'}
userId: ${ctx.userId}
platform: ${ctx.platform}
periodId: ${ctx.periodId}

weeklyJson: ${JSON.stringify(ctx.weekly)}
previousWeeklyJson: ${JSON.stringify(ctx.previousWeekly ?? null)}
dailyTrendJson: ${JSON.stringify(ctx.dailyTrend)}
recentMatchesJson: ${JSON.stringify(ctx.recentMatches.slice(0, 12))}
communityJson: ${JSON.stringify(ctx.community ?? null)}`;
}

function labelForPlatform(platform: GamePlatform): string {
  switch (platform) {
    case 'league_of_legends':
      return 'League of Legends';
    case 'valorant':
      return 'Valorant';
    case 'fortnite':
      return 'Fortnite';
    case 'cs2':
      return 'Counter-Strike 2';
    case 'rocket_league':
      return 'Rocket League';
    default:
      return platform;
  }
}

function toneForPlatform(platform: GamePlatform): string {
  if (platform === 'league_of_legends' || platform === 'valorant') {
    return 'directo, educativo, motivacional y crítico (mejora mecánica)';
  }
  return 'directo, claro y orientado a mejora medible';
}
