import type { TrendChartPoint } from '../core/charts/chart.types';
import type { CommunityBenchmarks } from '../data/community-mock.data';
import type { MatchUpdateView } from '../services/match.service';
import {
  buildCommunityComparison,
  type CommunityComparisonItem,
} from './community-stats.util';
import { isRobloxPlatform, matchSessionContext, parseMatchSummary } from './match-display.util';
import {
  aggregateMatchStats,
  computeKdRatio,
  formatMatchRelativeTime,
  getMatchOutcome,
  isMatchWin,
} from './match-stats.util';

export interface MatchAnalysisMetric {
  label: string;
  value: string;
  hint?: string;
  accent?: 'lime' | 'cyan' | 'default';
}

export interface MatchAnalysisComparisonRow {
  label: string;
  matchValue: number;
  averageValue: number;
  format: 'int' | 'decimal' | 'placement';
}

export interface MatchAnalysisRadarAxis {
  name: string;
  value: number;
}

export interface MatchAnalysisStructuredSection {
  title: string;
  items: string[];
}

export interface MatchAnalysisEconomyTimeline {
  /** Estimado: curva acumulada desde totales de fin de partida (sin frames Riot). */
  estimated: boolean;
  csTrend: TrendChartPoint[];
  goldTrend: TrendChartPoint[];
  csPerMin: number | null;
  goldPerMin: number | null;
}

export interface MatchAnalysisResilienceDimension {
  key: 'stress' | 'decision' | 'consistency';
  label: string;
  score: number;
  hint: string;
}

export interface MatchAnalysisResilienceScorecard {
  overall: number;
  gradeLabel: string;
  dimensions: MatchAnalysisResilienceDimension[];
}

export interface MatchAnalysisReport {
  headline: string;
  summary: string;
  narrative: string[];
  structuredSections: MatchAnalysisStructuredSection[];
  verdict: 'victory' | 'podium' | 'solid' | 'rough';
  performanceScore: number;
  gradeLabel: string;
  pros: string[];
  cons: string[];
  focusNext: string;
  actionPlan: string[];
  keyMetrics: MatchAnalysisMetric[];
  comparisonRows: MatchAnalysisComparisonRow[];
  communityBenchmarkRows: MatchAnalysisComparisonRow[];
  communityPercentiles: CommunityComparisonItem[];
  radarAxes: MatchAnalysisRadarAxis[];
  recentKillsTrend: TrendChartPoint[];
  recentKdTrend: TrendChartPoint[];
  economyTimeline: MatchAnalysisEconomyTimeline | null;
  resilienceScorecard: MatchAnalysisResilienceScorecard;
  isPreview: boolean;
}

export interface BuildMatchAnalysisInput {
  match: MatchUpdateView;
  recentMatches?: MatchUpdateView[];
}

export function matchDetailRoute(matchId: string): string {
  return `/tabs/matches/${encodeURIComponent(matchId)}`;
}

export function matchAiReportToAnalysisReport(
  ai: {
    headline: string;
    summary: string;
    markdown: string;
    performanceScore: number;
    gradeLabel: string;
    verdict: string;
    pros: string[];
    cons: string[];
    actionPlan: string[];
  },
  match: MatchUpdateView,
  recentMatches: MatchUpdateView[] = [],
): MatchAnalysisReport {
  const heuristic = buildMatchAnalysisReport({ match, recentMatches });
  const verdict = normalizeVerdict(ai.verdict);
  const structuredSections = markdownToStructuredSections(ai.markdown);
  const narrative = markdownToParagraphs(ai.markdown);

  return {
    ...heuristic,
    headline: ai.headline || heuristic.headline,
    summary: ai.summary || heuristic.summary,
    narrative: narrative.length > 0 ? narrative : heuristic.narrative,
    structuredSections:
      structuredSections.length > 0 ? structuredSections : heuristic.structuredSections,
    verdict,
    performanceScore: ai.performanceScore || heuristic.performanceScore,
    gradeLabel: ai.gradeLabel || heuristic.gradeLabel,
    pros: ai.pros.length > 0 ? ai.pros : heuristic.pros,
    cons: ai.cons.length > 0 ? ai.cons : heuristic.cons,
    actionPlan: ai.actionPlan.length > 0 ? ai.actionPlan : heuristic.actionPlan,
    focusNext: ai.actionPlan[0] ?? heuristic.focusNext,
    isPreview: false,
  };
}

function normalizeVerdict(raw: string): MatchAnalysisReport['verdict'] {
  const v = (raw ?? '').toLowerCase();
  if (v === 'victory' || v === 'podium' || v === 'solid' || v === 'rough') return v;
  return 'solid';
}

function markdownToParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) =>
      block
        .replace(/^#+\s*/gm, '')
        .replace(/^\s*[-*]\s+/gm, '')
        .replace(/\*\*/g, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 6);
}

function markdownToStructuredSections(markdown: string): MatchAnalysisStructuredSection[] {
  const sections: MatchAnalysisStructuredSection[] = [];
  const chunks = markdown.split(/^##\s+/m).slice(1);

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const title = lines[0]
      .replace(/^[✅❌📈🎯]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
    const items = lines
      .slice(1)
      .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean);
    if (title && items.length) {
      sections.push({ title, items: items.slice(0, 6) });
    }
  }

  return sections.slice(0, 4);
}

/** Adjunta benchmarks de comunidad al reporte (sin mutar el original). */
export function withCommunityBenchmarks(
  report: MatchAnalysisReport,
  match: MatchUpdateView,
  recentMatches: MatchUpdateView[],
  benchmarks: CommunityBenchmarks | null,
): MatchAnalysisReport {
  if (!benchmarks) {
    return {
      ...report,
      communityBenchmarkRows: [],
      communityPercentiles: [],
    };
  }

  const stats = match.stats ?? {};
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const kd = deaths === 0 ? kills : kills / Math.max(deaths, 1);
  const won = isMatchWin(stats);
  const recent = recentMatches.filter((m) => m.matchId !== match.matchId);
  const recentSummary = aggregateMatchStats(recent.length ? recent : [match]);
  const avgKillsPerMatch =
    benchmarks.avgMatchesPerWeek > 0
      ? benchmarks.avgKillsPerWeek / benchmarks.avgMatchesPerWeek
      : benchmarks.avgKillsPerWeek;

  const communityBenchmarkRows: MatchAnalysisComparisonRow[] = [
    {
      label: 'K/D',
      matchValue: Number(kd.toFixed(2)),
      averageValue: Number(benchmarks.avgKd.toFixed(2)),
      format: 'decimal',
    },
    {
      label: 'Kills',
      matchValue: kills,
      averageValue: Number(avgKillsPerMatch.toFixed(1)),
      format: 'decimal',
    },
    {
      label: 'Win %',
      matchValue: won ? 100 : 0,
      averageValue: Number(benchmarks.avgWinRate.toFixed(1)),
      format: 'decimal',
    },
  ];

  const communityPercentiles = buildCommunityComparison({
    benchmarks,
    winRate: won ? '100%' : '0%',
    winRateNumeric: won ? 100 : 0,
    kd: computeKdRatio(kills, deaths),
    kdNumeric: kd,
    kills,
    matchCount: Math.max(1, recentSummary.matchCount),
    kdLabel: 'K/D',
    killsLabel: match.platform === 'rocket_league' ? 'Goles' : 'Kills',
  });

  return {
    ...report,
    communityBenchmarkRows,
    communityPercentiles,
  };
}

export function buildMatchAnalysisReport(input: BuildMatchAnalysisInput): MatchAnalysisReport {
  const { match } = input;
  const stats = match.stats ?? {};
  const kills = stats.kills ?? 0;
  const deaths = stats.deaths ?? 0;
  const placement = stats.placement ?? null;
  const assists = stats.assists ?? 0;
  const kd = deaths === 0 ? kills : kills / Math.max(deaths, 1);
  const kdLabel = computeKdRatio(kills, deaths);
  const outcome = getMatchOutcome(placement);

  const recent = (input.recentMatches ?? []).filter((m) => m.matchId !== match.matchId);
  const recentSummary = aggregateMatchStats(recent);
  const avgKills =
    recentSummary.matchCount > 0 ? recentSummary.totalKills / recentSummary.matchCount : kills;
  const avgDeaths =
    recentSummary.matchCount > 0 ? recentSummary.totalDeaths / recentSummary.matchCount : deaths;
  const avgKd = avgDeaths === 0 ? avgKills : avgKills / avgDeaths;
  const avgPlacement = Number.parseFloat(recentSummary.avgPlacement);
  const avgCs = averageStat(recent, 'cs');
  const avgVision = averageStat(recent, 'visionScore');
  const avgAssists =
    recentSummary.matchCount > 0 ? recentSummary.totalAssists / recentSummary.matchCount : assists;

  const pros: string[] = [];
  const cons: string[] = [];
  const narrative: string[] = [];
  const actionPlan: string[] = [];

  let verdict: MatchAnalysisReport['verdict'] = 'solid';
  let headline = 'Partida competitiva con margen claro de mejora';
  let summary = `${outcome.label} · ${kills} kills · K/D ${kdLabel}${placement != null ? ` · #${placement}` : ''}.`;

  const sessionContext = matchSessionContext(match.platform, match.summary);
  const roblox = isRobloxPlatform(match.platform);

  if (roblox) {
    applyRobloxVerdict({
      placement,
      kills,
      deaths,
      assists,
      kd,
      kdLabel,
      avgKills,
      sessionContext,
      pros,
      cons,
      narrative,
      actionPlan,
      setVerdict: (v) => {
        verdict = v;
      },
      setHeadline: (h) => {
        headline = h;
      },
    });
  } else if (placement === 1) {
    verdict = 'victory';
    headline = 'Victoria dominante — cerraste cuando importaba';
    narrative.push(
      `Ganaste la partida ${sessionContext} con un cierre en placement #1. Eso indica que tus decisiones de rotación y pelea en endgame estuvieron alineadas con el objetivo principal: sobrevivir y quedar último en pie.`,
      `Con ${kills} eliminaciones y K/D ${kdLabel}, ${kd >= 1.5 ? 'convertiste la ventaja mecánica en control de la partida' : 'priorizaste posición sobre frageo agresivo, lo cual es válido en cierres tight'}. ${assists >= 2 ? `También aportaste ${assists} asistencias, señal de juego de equipo.` : 'El próximo paso es mantener este criterio en partidas más exigentes.'}`,
    );
    pros.push('Placement #1: ejecutaste el win condition sin regalar la partida.');
    if (kd >= 1.2) pros.push(`K/D ${kdLabel} — tus duelos generaron ventaja tangible.`);
    if (assists >= 2) pros.push(`${assists} asistencias: buen impacto en fights de equipo.`);
    if (deaths <= 1) pros.push('Baja cantidad de muertes — economía de vida bien administrada.');
    cons.push('Documentá qué rotación y loadout usaste para repetir el patrón.');
    actionPlan.push('Repetí la misma mentalidad de endgame en la próxima ranked.');
    actionPlan.push('Grabá mentalmente el timing de tu última rotación (qué funcionó).');
  } else if (placement != null && placement <= 3) {
    verdict = 'podium';
    headline = 'Podio — a un fight del victory royale';
    narrative.push(
      `Llegaste al top ${placement} en una partida donde el endgame fue decisivo. Estás en la franja de jugadores que consistentemente llega a la fase final, lo cual es la base para convertir podios en victorias.`,
      `Registraste ${kills} kills con K/D ${kdLabel}. ${kills >= avgKills ? 'Tu output ofensivo estuvo por encima de tu media reciente.' : 'El frageo fue moderado; posiblemente priorizaste posición, pero dejaste oportunidades en la mesa.'} La diferencia entre #${placement} y #1 suele ser una rotación tardía o un duelo forzado sin cobertura.`,
    );
    pros.push(`Top ${placement} — entrás en la élite del lobby en esta partida.`);
    if (kills >= 4) pros.push('Buen volumen de eliminaciones en mid/end game.');
    if (kd >= 1) pros.push(`K/D positivo (${kdLabel}) en una partida de alta presión.`);
    cons.push('Revisá el último círculo: ¿rotaste tarde o peleaste sin high ground?');
    if (deaths >= 2) cons.push(`${deaths} muertes — cada respawn te restó tempo en endgame.`);
    actionPlan.push('En el próximo endgame, rotá 1 zona antes de lo habitual.');
    actionPlan.push('Evitá third-party inmediato tras kill: reposition first.');
  } else if (placement != null && placement <= 10) {
    verdict = 'solid';
    headline = 'Top 10 — buena base, falta convertir en podio';
    narrative.push(
      `Terminaste #${placement} con ${kills} kills y K/D ${kdLabel}. Estás compitiendo en la mitad superior del lobby, lo que muestra que tu loop de juego (loot → posición → pelea selectiva) funciona en líneas generales.`,
      `${kd >= 1.2 ? 'Tu mecánica en duelos es un activo claro.' : 'El K/D sugiere que algunos fights fueron desventajosos — conviene elegir mejor cuándo disparar.'} Para escalar a top 3, el foco debe estar en llegar al endgame con recursos completos y evitar daño innecesario en mid-game.`,
    );
    if (kills >= 3) pros.push('Generás presión ofensiva — los kills vienen.');
    if (placement <= 7) pros.push('Llegaste al top 7: estás cerca del podio.');
    cons.push('Priorizá posición en círculo antes de buscar eliminaciones.');
    if (deaths >= 2) cons.push('Reducí peleas sin cobertura o sin info de terceros.');
    actionPlan.push('Jugá 2 partidas priorizando rotación sobre kills.');
    actionPlan.push('Antes de cada fight preguntate: ¿gana placement o solo stats?');
  } else {
    verdict = 'rough';
    headline = 'Partida dura — reset mental y foco en supervivencia';
    narrative.push(
      placement != null
        ? `El placement #${placement} indica que la partida se complicó antes del endgame o que hubo desgaste acumulado. Con ${kills} kills y K/D ${kdLabel}, ${kills <= 1 ? 'hubo poco impacto ofensivo' : 'hubo momentos de frageo pero no se tradujeron en posición'}`
        : `Sin placement registrado, pero el K/D ${kdLabel} y ${kills} kills dibujan una partida donde la supervivencia fue el problema principal.`,
      `En partidas así, el coach recomienda simplificar: calentar en zona segura, evitar fights sin ventaja clara y entrar al top 15 con materiales/recursos. La consistencia semanal importa más que una mala partida aislada.`,
    );
    if (kills >= 2) pros.push('Sumaste eliminaciones pese a un lobby difícil.');
    cons.push('Demasiado desgaste temprano — revisá drop y primer rotate.');
    if (deaths >= 3) cons.push(`${deaths} muertes restaron tempo y recursos clave.`);
    if (kills <= 1) cons.push('Impacto ofensivo bajo — practicá fights en entrenamiento.');
    actionPlan.push('Próximas 3 partidas: objetivo top 15, no kills.');
    actionPlan.push('Drop más conservador hasta recuperar confianza.');
  }

  if (!roblox && kd >= 2 && placement != null && placement > 3) {
    pros.push('Mecánica sólida en duelos — el cuello de botella es conversión a placement.');
    cons.push('Post-kill: rotá antes de lootear. El placement te está costando más que el aim.');
  }

  if (recentSummary.matchCount >= 3) {
    if (placement != null && !Number.isNaN(avgPlacement) && placement < avgPlacement) {
      pros.push(`Mejor placement que tu promedio reciente (top ${recentSummary.avgPlacement}).`);
      narrative.push(
        `Comparado con tus últimas ${recentSummary.matchCount} partidas (promedio top ${recentSummary.avgPlacement}, win rate ${recentSummary.winRate}), esta fue una mejora clara en posicionamiento final.`,
      );
    } else if (placement != null && !Number.isNaN(avgPlacement) && placement > avgPlacement + 3) {
      cons.push(`Por debajo de tu media reciente (top ${recentSummary.avgPlacement}).`);
      narrative.push(
        `Versus tu ventana reciente de ${recentSummary.matchCount} partidas, este resultado quedó por debajo del promedio (top ${recentSummary.avgPlacement}). No es tendencia todavía, pero conviene corregir en la siguiente.`,
      );
    } else if (recentSummary.matchCount >= 3) {
      const trendNote =
        placement != null &&
        recentSummary.bestPlacement != null &&
        placement <= recentSummary.bestPlacement
          ? 'rinde al nivel de tus mejores partidas recientes'
          : 'encaja con tu línea habitual';
      narrative.push(
        `En contexto: llevás ${recentSummary.matchCount} partidas recientes con win rate ${recentSummary.winRate} y K/D ${recentSummary.kd}. Esta partida ${trendNote}.`,
      );
    }
  }

  if (pros.length === 0) pros.push('Completaste la partida — cada match suma data al coach.');
  if (cons.length === 0) {
    cons.push(
      roblox
        ? 'Mantené consistencia en timing y selección de peleas dentro de la experiencia.'
        : 'Mantené consistencia en rotaciones y selección de fights.',
    );
  }
  if (actionPlan.length < 2) {
    actionPlan.push(
      roblox ? 'Repasá qué funcionó al final de la sesión.' : 'Revisá el replay mental de la última zona.',
    );
    actionPlan.push(
      roblox
        ? 'Definí 1 objetivo concreto antes de la próxima cola en la misma experiencia.'
        : 'Definí 1 objetivo concreto antes de la próxima cola.',
    );
  }

  const performanceScore = computePerformanceScore({ placement, kd, kills, deaths, verdict });
  const gradeLabel = scoreToGrade(performanceScore);

  const focusNext = roblox
    ? buildRobloxFocusNext(verdict)
    : buildFortniteFocusNext(verdict);

  return {
    headline,
    summary,
    narrative: narrative.slice(0, 3),
    verdict,
    performanceScore,
    gradeLabel,
    pros: pros.slice(0, 5),
    cons: cons.slice(0, 5),
    focusNext,
    actionPlan: actionPlan.slice(0, 4),
    keyMetrics: buildKeyMetrics({
      match,
      placement,
      kdLabel,
      kills,
      deaths,
      assists,
      recentSummary,
      outcomeLabel: outcome.label,
    }),
    comparisonRows: buildComparisonRows({
      match,
      kills,
      kd,
      placement,
      assists,
      avgKills,
      avgKd,
      avgPlacement,
      avgAssists,
      avgCs,
      avgVision,
      recentCount: recentSummary.matchCount,
    }),
    communityBenchmarkRows: [],
    communityPercentiles: [],
    radarAxes: buildMatchRadarAxes({
      match,
      kills,
      deaths,
      placement,
      assists,
      kd,
      verdict,
    }),
    recentKillsTrend: buildRecentKillsTrend(input.recentMatches ?? [], match.matchId),
    recentKdTrend: buildRecentKdTrend(input.recentMatches ?? [], match.matchId),
    economyTimeline: buildLolEconomyTimeline(match),
    resilienceScorecard: buildResilienceScorecard({
      match,
      kills,
      deaths,
      assists,
      kd,
      recentSummary,
      avgKills,
      avgKd,
      avgAssists,
      avgCs,
    }),
    structuredSections: [],
    isPreview: true,
  };
}

function computePerformanceScore(input: {
  placement: number | null;
  kd: number;
  kills: number;
  deaths: number;
  verdict: MatchAnalysisReport['verdict'];
}): number {
  let score = 35;

  if (input.placement != null) {
    score += Math.max(0, 40 - input.placement * 0.35);
  } else {
    score += 15;
  }

  score += Math.min(25, input.kd * 10);
  score += Math.min(15, input.kills * 2);
  score -= Math.min(15, input.deaths * 3);

  if (input.verdict === 'victory') score += 10;
  if (input.verdict === 'podium') score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToGrade(score: number): string {
  if (score >= 92) return 'S';
  if (score >= 85) return 'A';
  if (score >= 78) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 62) return 'B';
  if (score >= 54) return 'C+';
  if (score >= 46) return 'C';
  return 'D';
}

function buildKeyMetrics(input: {
  match: MatchUpdateView;
  placement: number | null;
  kdLabel: string;
  kills: number;
  deaths: number;
  assists: number;
  recentSummary: ReturnType<typeof aggregateMatchStats>;
  outcomeLabel: string;
}): MatchAnalysisMetric[] {
  const stats = input.match.stats ?? {};
  const platform = input.match.platform.toLowerCase();
  const metrics: MatchAnalysisMetric[] = [
    {
      label: 'Resultado',
      value: input.outcomeLabel,
      accent: isMatchWin(stats) ? 'lime' : 'default',
    },
    { label: 'K/D/A', value: `${input.kills}/${input.deaths}/${input.assists}`, accent: 'cyan' },
    { label: 'K/D', value: input.kdLabel, accent: 'cyan' },
  ];

  if (platform === 'league_of_legends') {
    if (stats.champion) metrics.push({ label: 'Campeón', value: String(stats.champion), accent: 'lime' });
    if (stats.role) metrics.push({ label: 'Rol', value: String(stats.role) });
    if (stats.cs != null) {
      const durationSec = Number(stats.durationSec ?? 0);
      const csMin =
        durationSec > 0 ? (Number(stats.cs) / (durationSec / 60)).toFixed(1) : null;
      metrics.push({
        label: 'CS',
        value: String(stats.cs),
        hint: csMin ? `${csMin}/min` : undefined,
        accent: 'cyan',
      });
    }
    if (stats.goldEarned != null) {
      const durationSec = Number(stats.durationSec ?? 0);
      const goldMin =
        durationSec > 0
          ? Math.round(Number(stats.goldEarned) / (durationSec / 60))
          : null;
      metrics.push({
        label: 'Gold',
        value: String(stats.goldEarned),
        hint: goldMin != null ? `${goldMin}/min` : undefined,
        accent: 'lime',
      });
    }
    if (stats.visionScore != null) {
      metrics.push({ label: 'Visión', value: String(stats.visionScore) });
    }
    if (stats.champLevel != null) {
      metrics.push({ label: 'Nivel', value: String(stats.champLevel) });
    }
  } else if (platform === 'valorant') {
    if (stats.agent) metrics.push({ label: 'Agente', value: String(stats.agent), accent: 'lime' });
    if (stats.headshotPct != null) {
      metrics.push({ label: 'HS%', value: `${stats.headshotPct}%`, accent: 'cyan' });
    }
    if (stats.score != null) metrics.push({ label: 'Score', value: String(stats.score) });
  } else if (input.placement != null) {
    metrics.push({
      label: 'Placement',
      value: `#${input.placement}`,
      accent: input.placement <= 3 ? 'lime' : 'cyan',
    });
  }

  if (input.recentSummary.matchCount >= 3) {
    metrics.push({
      label: 'Win rate reciente',
      value: input.recentSummary.winRate,
      hint: `${input.recentSummary.matchCount} partidas`,
    });
  }

  return metrics.slice(0, 8);
}

function buildComparisonRows(input: {
  match: MatchUpdateView;
  kills: number;
  kd: number;
  placement: number | null;
  assists: number;
  avgKills: number;
  avgKd: number;
  avgPlacement: number;
  avgAssists: number;
  avgCs: number | null;
  avgVision: number | null;
  recentCount: number;
}): MatchAnalysisComparisonRow[] {
  if (input.recentCount < 1) return [];

  const stats = input.match.stats ?? {};
  const platform = input.match.platform.toLowerCase();
  const rows: MatchAnalysisComparisonRow[] = [
    {
      label: 'Kills',
      matchValue: input.kills,
      averageValue: Number(input.avgKills.toFixed(1)),
      format: 'decimal',
    },
    {
      label: 'K/D',
      matchValue: Number(input.kd.toFixed(2)),
      averageValue: Number(input.avgKd.toFixed(2)),
      format: 'decimal',
    },
    {
      label: 'Assists',
      matchValue: input.assists,
      averageValue: Number(input.avgAssists.toFixed(1)),
      format: 'decimal',
    },
  ];

  if (platform === 'league_of_legends') {
    if (stats.cs != null && input.avgCs != null) {
      rows.push({
        label: 'CS',
        matchValue: Number(stats.cs),
        averageValue: Number(input.avgCs.toFixed(0)),
        format: 'int',
      });
    }
    if (stats.visionScore != null && input.avgVision != null) {
      rows.push({
        label: 'Visión',
        matchValue: Number(stats.visionScore),
        averageValue: Number(input.avgVision.toFixed(0)),
        format: 'int',
      });
    }
  } else if (input.placement != null && !Number.isNaN(input.avgPlacement)) {
    rows.push({
      label: 'Placement',
      matchValue: input.placement,
      averageValue: Number(input.avgPlacement.toFixed(1)),
      format: 'placement',
    });
  }

  return rows;
}

function buildMatchRadarAxes(input: {
  match: MatchUpdateView;
  kills: number;
  deaths: number;
  placement: number | null;
  assists: number;
  kd: number;
  verdict: MatchAnalysisReport['verdict'];
}): MatchAnalysisRadarAxis[] {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const stats = input.match.stats ?? {};
  const platform = input.match.platform.toLowerCase();
  const impact =
    input.verdict === 'victory'
      ? 95
      : input.verdict === 'podium'
        ? 78
        : input.verdict === 'solid'
          ? 62
          : 45;

  if (platform === 'league_of_legends') {
    const durationMin = Number(stats.durationSec ?? 0) / 60;
    const cs = Number(stats.cs ?? 0);
    const csPerMin = durationMin > 0 ? cs / durationMin : cs / 28;
    const vision = Number(stats.visionScore ?? 0);
    return [
      { name: 'Combate', value: clamp((input.kd / 3) * 100) },
      { name: 'Farm', value: clamp((csPerMin / 8) * 100) },
      { name: 'Visión', value: clamp((vision / 50) * 100) },
      { name: 'Supervivencia', value: clamp(100 - input.deaths * 14) },
      { name: 'Teamplay', value: clamp((input.assists / 10) * 100) },
      { name: 'Impacto', value: impact },
    ];
  }

  if (platform === 'valorant') {
    const hs = Number(stats.headshotPct ?? 0);
    const score = Number(stats.score ?? 0);
    return [
      { name: 'Aim', value: clamp(hs * 2.2) },
      { name: 'Frageo', value: clamp((input.kills / 20) * 100) },
      { name: 'Supervivencia', value: clamp(100 - input.deaths * 5) },
      { name: 'ACS', value: clamp((score / 300) * 100) },
      { name: 'Teamplay', value: clamp((input.assists / 8) * 100) },
      { name: 'Impacto', value: impact },
    ];
  }

  return [
    { name: 'Frageo', value: clamp((input.kills / 8) * 100) },
    { name: 'Supervivencia', value: clamp(100 - input.deaths * 18) },
    {
      name: 'Placement',
      value: input.placement != null ? clamp(100 - input.placement * 0.9) : 40,
    },
    { name: 'K/D', value: clamp((input.kd / 2.5) * 100) },
    { name: 'Teamplay', value: clamp((input.assists / 5) * 100) },
    { name: 'Impacto', value: impact },
  ];
}

function buildRecentKillsTrend(
  recentMatches: MatchUpdateView[],
  currentMatchId: string,
): TrendChartPoint[] {
  return buildRecentMetricTrend(recentMatches, currentMatchId, (m) => m.stats?.kills ?? 0);
}

function buildRecentKdTrend(
  recentMatches: MatchUpdateView[],
  currentMatchId: string,
): TrendChartPoint[] {
  return buildRecentMetricTrend(recentMatches, currentMatchId, (m) => {
    const kills = m.stats?.kills ?? 0;
    const deaths = m.stats?.deaths ?? 0;
    return deaths === 0 ? kills : Number((kills / Math.max(deaths, 1)).toFixed(2));
  });
}

function buildRecentMetricTrend(
  recentMatches: MatchUpdateView[],
  currentMatchId: string,
  valueOf: (match: MatchUpdateView) => number,
): TrendChartPoint[] {
  const ordered = [...recentMatches]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
    .reverse();

  const currentInList = ordered.some((m) => m.matchId === currentMatchId);
  const pool = currentInList
    ? ordered
    : [...ordered, ...recentMatches.filter((m) => m.matchId === currentMatchId)].slice(-8);

  return pool.map((m, index) => ({
    label: m.matchId === currentMatchId ? 'Esta' : `-${pool.length - index}`,
    value: valueOf(m),
  }));
}

function averageStat(
  matches: MatchUpdateView[],
  key: 'cs' | 'visionScore',
): number | null {
  const values = matches
    .map((m) => m.stats?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Sintetiza curva CS/Gold acumulada desde totales de fin de partida.
 * No hay frames Riot timeline todavía — se etiqueta como estimado.
 */
function buildLolEconomyTimeline(match: MatchUpdateView): MatchAnalysisEconomyTimeline | null {
  if (match.platform.toLowerCase() !== 'league_of_legends') return null;

  const stats = match.stats ?? {};
  const durationSec = Number(stats.durationSec ?? 0);
  const cs = Number(stats.cs ?? 0);
  if (!(durationSec > 0) || !(cs > 0 || Number(stats.goldEarned ?? 0) > 0)) {
    return null;
  }

  const durationMin = durationSec / 60;
  const goldEarned =
    Number(stats.goldEarned ?? 0) > 0
      ? Number(stats.goldEarned)
      : estimateGoldFromCombat({
          cs,
          kills: Number(stats.kills ?? 0),
          assists: Number(stats.assists ?? 0),
          won: isMatchWin(stats),
        });

  const role = String(stats.role ?? '').toUpperCase();
  const minutes = Math.max(8, Math.round(durationMin));
  const step = minutes <= 20 ? 2 : minutes <= 35 ? 3 : 5;
  const checkpoints: number[] = [];
  for (let m = step; m < minutes; m += step) checkpoints.push(m);
  if (checkpoints[checkpoints.length - 1] !== minutes) checkpoints.push(minutes);

  const progressAt = (minute: number): number => {
    const t = Math.min(1, Math.max(0, minute / minutes));
    if (role === 'UTILITY' || role === 'SUPPORT') return Math.pow(t, 1.18);
    if (role === 'JUNGLE') return 0.12 * t + 0.88 * Math.pow(t, 0.88);
    return Math.pow(t, 0.94);
  };

  const csTrend = checkpoints.map((minute) => ({
    label: `${minute}'`,
    value: Math.round(cs * progressAt(minute)),
  }));
  const goldTrend = checkpoints.map((minute) => ({
    label: `${minute}'`,
    value: Math.round(goldEarned * progressAt(minute)),
  }));

  return {
    estimated: true,
    csTrend,
    goldTrend,
    csPerMin: Number((cs / durationMin).toFixed(1)),
    goldPerMin: Math.round(goldEarned / durationMin),
  };
}

function estimateGoldFromCombat(input: {
  cs: number;
  kills: number;
  assists: number;
  won: boolean;
}): number {
  return Math.round(
    input.cs * 21 + input.kills * 300 + input.assists * 150 + (input.won ? 400 : 0) + 500,
  );
}

function buildResilienceScorecard(input: {
  match: MatchUpdateView;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  recentSummary: ReturnType<typeof aggregateMatchStats>;
  avgKills: number;
  avgKd: number;
  avgAssists: number;
  avgCs: number | null;
}): MatchAnalysisResilienceScorecard {
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const stats = input.match.stats ?? {};
  const platform = input.match.platform.toLowerCase();
  const durationSec = Number(stats.durationSec ?? 0);
  const durationMin = durationSec > 0 ? durationSec / 60 : 28;
  const deathRate = input.deaths / Math.max(durationMin, 1);
  const won = isMatchWin(stats);
  const assistShare = input.assists / Math.max(input.kills + input.assists, 1);
  const cs = Number(stats.cs ?? 0);
  const csMin = durationSec > 0 && cs > 0 ? cs / durationMin : null;
  const vision = Number(stats.visionScore ?? 0);
  const objectives =
    Number(stats.teamBarons ?? 0) * 12 +
    Number(stats.teamDragons ?? 0) * 8 +
    Number(stats.teamTowers ?? 0) * 4;

  let stress = 72 - deathRate * 110 - input.deaths * 5;
  if (input.kd >= 1.4) stress += 14;
  else if (input.kd >= 1) stress += 8;
  if (!won && input.kd >= 1.1) stress += 6; // pelea bien pese a derrota
  if (csMin != null && csMin >= roleCsBenchmark(String(stats.role ?? ''))) stress += 8;
  if (platform === 'valorant' && Number(stats.headshotPct ?? 0) >= 24) stress += 6;

  let decision = assistShare * 48 + Math.min(28, objectives);
  if (won) decision += 16;
  else if (input.kd >= 1.2) decision += 8;
  if (vision > 0) {
    const visionBench = roleVisionBenchmark(String(stats.role ?? ''));
    decision += Math.min(18, (vision / visionBench) * 14);
  }
  if (platform === 'valorant') {
    decision += Math.min(12, Number(stats.assists ?? 0) * 2);
  }
  if (stats.placement != null && stats.placement <= 3) decision += 10;

  let consistency = 50;
  if (input.recentSummary.matchCount >= 2) {
    const avgDeaths =
      input.recentSummary.matchCount > 0
        ? input.recentSummary.totalDeaths / input.recentSummary.matchCount
        : input.deaths;
    consistency += (avgDeaths - input.deaths) * 7;
    consistency += (input.kd - input.avgKd) * 14;
    consistency += (input.assists - input.avgAssists) * 1.5;
    if (csMin != null && input.avgCs != null && durationMin > 0) {
      const avgCsMin = input.avgCs / durationMin;
      consistency += (csMin - avgCsMin) * 5;
    }
  } else {
    consistency += input.kd * 10 - input.deaths * 4;
  }

  const stressScore = clamp(stress);
  const decisionScore = clamp(decision);
  const consistencyScore = clamp(consistency);
  const overall = clamp((stressScore + decisionScore + consistencyScore) / 3);

  return {
    overall,
    gradeLabel: scoreToGrade(overall),
    dimensions: [
      {
        key: 'stress',
        label: 'Resiliencia al estrés',
        score: stressScore,
        hint:
          deathRate <= 0.2
            ? 'Baja tasa de muertes bajo presión.'
            : 'Las muertes se acumulan rápido — priorizá reset y spacing.',
      },
      {
        key: 'decision',
        label: 'Velocidad de decisión',
        score: decisionScore,
        hint:
          assistShare >= 0.45 || objectives >= 16
            ? 'Buena conversión a impacto colectivo / objetivos.'
            : 'Falta presencia en fights o toma de objetivos.',
      },
      {
        key: 'consistency',
        label: 'Consistencia bajo presión',
        score: consistencyScore,
        hint:
          input.recentSummary.matchCount >= 2
            ? 'Comparado con tu promedio reciente inmediato.'
            : 'Baseline estimado con esta partida sola.',
      },
    ],
  };
}

function roleCsBenchmark(role: string): number {
  const r = role.toUpperCase();
  if (r === 'UTILITY' || r === 'SUPPORT') return 1.2;
  if (r === 'JUNGLE') return 5.2;
  if (r === 'TOP') return 6.8;
  if (r === 'MIDDLE') return 7.2;
  return 7.5; // ADC / BOTTOM
}

function roleVisionBenchmark(role: string): number {
  const r = role.toUpperCase();
  if (r === 'UTILITY' || r === 'SUPPORT') return 55;
  if (r === 'JUNGLE') return 35;
  return 22;
}

export function formatMatchDetailMeta(match: MatchUpdateView): string {
  const parsed = parseMatchSummary(match.platform, match.summary);
  const context =
    isRobloxPlatform(match.platform) && parsed.experienceName
      ? `${parsed.experienceName} · `
      : '';
  return `${context}${formatMatchRelativeTime(match.updatedAt)} · ${match.matchId}`;
}

function buildFortniteFocusNext(verdict: MatchAnalysisReport['verdict']): string {
  if (verdict === 'victory') {
    return 'Objetivo: repetir el mismo criterio de cierre en 2 ranked seguidas.';
  }
  if (verdict === 'podium') {
    return 'Objetivo: convertir el próximo podio en victoria con rotación anticipada.';
  }
  if (verdict === 'solid') {
    return 'Objetivo: top 5 en la próxima partida priorizando posición.';
  }
  return 'Objetivo: top 15 con supervivencia — olvidate del frageo por ahora.';
}

function buildRobloxFocusNext(verdict: MatchAnalysisReport['verdict']): string {
  if (verdict === 'victory') {
    return 'Objetivo: repetir el mismo ritmo en la próxima sesión de esta experiencia.';
  }
  if (verdict === 'podium') {
    return 'Objetivo: cerrar la próxima sesión en #1 con mejor timing en rondas finales.';
  }
  if (verdict === 'solid') {
    return 'Objetivo: mejorar placement/K-D en la misma experiencia antes de saltar a otra.';
  }
  return 'Objetivo: sesión corta enfocada en supervivencia y menos riesgos innecesarios.';
}

interface RobloxVerdictInput {
  placement: number | null;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  kdLabel: string;
  avgKills: number;
  sessionContext: string;
  pros: string[];
  cons: string[];
  narrative: string[];
  actionPlan: string[];
  setVerdict: (verdict: MatchAnalysisReport['verdict']) => void;
  setHeadline: (headline: string) => void;
}

function applyRobloxVerdict(input: RobloxVerdictInput): void {
  const {
    placement,
    kills,
    deaths,
    assists,
    kd,
    kdLabel,
    avgKills,
    sessionContext,
    pros,
    cons,
    narrative,
    actionPlan,
    setVerdict,
    setHeadline,
  } = input;

  if (placement === 1) {
    setVerdict('victory');
    setHeadline('Victoria en la experiencia — cerraste la sesión arriba');
    narrative.push(
      `Ganaste la sesión ${sessionContext} con placement #1. En Roblox cada experiencia tiene reglas distintas; este resultado confirma que leíste bien el objetivo de esta en particular.`,
      `Con ${kills} eliminaciones y K/D ${kdLabel}, ${kd >= 1.5 ? 'tu impacto en combate fue decisivo' : 'priorizaste el win condition de la experiencia sobre stats secundarias'}. ${assists >= 2 ? `${assists} asistencias suman valor en modos de equipo.` : 'La clave es repetir el mismo criterio en la próxima sesión.'}`,
    );
    pros.push('Placement #1: cumpliste el objetivo principal de la experiencia.');
    if (kd >= 1.2) pros.push(`K/D ${kdLabel} — dominaste los duelos clave.`);
    if (assists >= 2) pros.push(`${assists} asistencias: buen aporte en fights compartidos.`);
    if (deaths <= 1) pros.push('Pocas muertes — buena gestión de respawns/vidas.');
    cons.push('Anotá qué estrategia usaste para replicarla en la misma experiencia.');
    actionPlan.push('Jugá otra sesión en la misma experiencia antes de cambiar de juego.');
    actionPlan.push('Identificá el momento exacto en que cerraste la victoria.');
    return;
  }

  if (placement != null && placement <= 3) {
    setVerdict('podium');
    setHeadline('Podio en la experiencia — a un paso del #1');
    narrative.push(
      `Quedaste #${placement} ${sessionContext}. Estás en la franja alta del lobby de esa experiencia, lo que indica que entendés su loop aunque te faltó cerrar la sesión.`,
      `Registraste ${kills} kills con K/D ${kdLabel}. ${kills >= avgKills ? 'Tu output ofensivo superó tu media reciente en Roblox.' : 'El frageo fue moderado; quizá priorizaste objetivos de la experiencia sobre eliminaciones.'} La diferencia entre podio y victoria suele estar en el timing de la ronda final o en un duelo forzado sin ventaja.`,
    );
    pros.push(`Top ${placement} en esta experiencia — rendimiento alto para el lobby.`);
    if (kills >= 4) pros.push('Buen volumen de eliminaciones en la sesión.');
    if (kd >= 1) pros.push(`K/D positivo (${kdLabel}) bajo presión.`);
    cons.push('Revisá la fase final: ¿entraste sin recursos o sin posición?');
    if (deaths >= 2) cons.push(`${deaths} muertes — cada respawn te restó tempo en el cierre.`);
    actionPlan.push('En la próxima sesión, conservá recursos para la ronda final.');
    actionPlan.push('Evitá pelear de frente cuando podés reagrupar o flanquear.');
    return;
  }

  if (placement != null && placement <= 10) {
    setVerdict('solid');
    setHeadline('Sesión sólida — margen para escalar en la experiencia');
    narrative.push(
      `Terminaste #${placement} ${sessionContext} con ${kills} kills y K/D ${kdLabel}. Rendís en la mitad superior del lobby de esa experiencia, señal de que el loop básico te queda claro.`,
      `${kd >= 1.2 ? 'Tu mecánica en duelos es un activo.' : 'Conviene elegir mejor cuándo pelear según las reglas de esta experiencia.'} Para subir a podio, enfocate en llegar a las fases finales con recursos y evitar desgaste innecesario al inicio.`,
    );
    if (kills >= 3) pros.push('Generás presión ofensiva cuando te buscás pelea.');
    if (placement <= 7) pros.push('Top 7: estás cerca del podio en esta experiencia.');
    cons.push('Reducí riesgos tempranos que no aportan al objetivo de la experiencia.');
    if (deaths >= 2) cons.push('Demasiadas muertes antes del cierre — jugá más conservador.');
    actionPlan.push('Próximas 2 sesiones: priorizá placement sobre kills.');
    actionPlan.push('Antes de cada fight: ¿suma al objetivo de la experiencia?');
    return;
  }

  setVerdict('rough');
  setHeadline('Sesión difícil — reset y foco en lo básico de la experiencia');
  narrative.push(
    placement != null
      ? `El placement #${placement} ${sessionContext} indica que la sesión se complicó antes del cierre. Con ${kills} kills y K/D ${kdLabel}, ${kills <= 1 ? 'hubo poco impacto ofensivo' : 'hubo frags pero no se tradujeron en posición final'}.`
      : `Sin placement registrado ${sessionContext}, pero el K/D ${kdLabel} y ${kills} kills muestran una sesión donde costó mantener ritmo.`,
    `En Roblox conviene dominar una experiencia a la vez: aprendé su loop, evitá pelear sin ventaja y buscá consistencia antes de saltar a otro juego dentro de la plataforma.`,
  );
  if (kills >= 2) pros.push('Sumaste eliminaciones pese a un lobby exigente.');
  cons.push('Demasiado desgaste temprano — repasá las reglas/objetivos de la experiencia.');
  if (deaths >= 3) cons.push(`${deaths} muertes restaron tempo y recursos.`);
  if (kills <= 1) cons.push('Impacto ofensivo bajo — practicá combate en esta experiencia.');
  actionPlan.push('Próximas sesiones: objetivo conservador, sin forzar plays.');
  actionPlan.push('Quedate en la misma experiencia hasta estabilizar resultados.');
}
