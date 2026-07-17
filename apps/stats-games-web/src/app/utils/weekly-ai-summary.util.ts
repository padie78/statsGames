import type { TrendChartPoint } from '../core/charts/chart.types';
import type { SelectedGame } from '../core/game/selected-game';
import type { CommunityBenchmarks } from '../data/community-mock.data';
import type { MatchAiReportView } from '../services/match-ai.service';
import type { MatchUpdateView } from '../services/match.service';
import type { StatsComparisonRow } from '../ui/molecules/stats-comparison-chart/stats-comparison-chart.component';
import {
  buildCommunityComparison,
  parsePlayerKdForCommunity,
  parsePlayerWinRateForCommunity,
  type CommunityComparisonItem,
} from './community-stats.util';
import {
  aggregateMatchStats,
  computeBestKills,
  computeKdRatio,
  isMatchWin,
} from './match-stats.util';

export interface WeeklyCoachMetricCard {
  label: string;
  value: string;
  hint?: string;
  tone: 'lime' | 'cyan' | 'gold' | 'danger' | 'muted';
}

export interface WeeklyCoachDeltaRow {
  label: string;
  earlyValue: string;
  lateValue: string;
  deltaLabel: string;
  direction: 'up' | 'down' | 'flat';
  note: string;
}

export interface WeeklyAiCoachSummary {
  headline: string;
  body: string;
  narrative: string[];
  strengths: string[];
  improvements: string[];
  regressions: string[];
  focusNext: string | null;
  matchCount: number;
  winCount: number;
  lossCount: number;
  winRate: string;
  kdLabel: string;
  kd: string;
  metricCards: WeeklyCoachMetricCard[];
  communityRows: StatsComparisonRow[];
  communityItems: CommunityComparisonItem[];
  halfWeekRows: WeeklyCoachDeltaRow[];
  killsTrend: TrendChartPoint[];
  kdTrend: TrendChartPoint[];
  resultTrend: TrendChartPoint[];
}

/**
 * Resumen semanal de coaching enriquecido para el jugador.
 */
export function buildWeeklyAiCoachSummary(input: {
  platform: SelectedGame;
  weekMatches: MatchUpdateView[];
  latestAiReport?: MatchAiReportView | null;
  communityBenchmarks?: CommunityBenchmarks | null;
  kdLabel?: string;
}): WeeklyAiCoachSummary {
  const matches = orderedMatches(input.weekMatches);
  const summary = aggregateMatchStats(matches);
  const matchCount = summary.matchCount;
  const winCount = summary.winCount;
  const lossCount = Math.max(0, matchCount - winCount);
  const kdLabel = input.kdLabel ?? (isMobaLike(input.platform) ? 'KDA' : 'K/D');
  const empty = emptySummary(kdLabel);

  if (matchCount === 0) return empty;

  const kd = computeKdRatio(summary.totalKills, summary.totalDeaths);
  const kdNumeric =
    summary.totalDeaths === 0
      ? summary.totalKills
      : summary.totalKills / Math.max(summary.totalDeaths, 1);
  const bestKills = computeBestKills(matches);
  const avgKills = summary.totalKills / matchCount;
  const avgDeaths = summary.totalDeaths / matchCount;
  const avgAssists = summary.totalAssists / matchCount;
  const formBand = formScore({ winCount, lossCount, kdNumeric, matchCount });
  const headline = headlineForForm(formBand, winCount, lossCount, matchCount);

  const strengths = buildStrengths({
    platform: input.platform,
    matches,
    winCount,
    lossCount,
    matchCount,
    kd,
    kdNumeric,
    kdLabel,
    avgKills,
    avgDeaths,
    bestKills,
    latestAiReport: input.latestAiReport,
    communityBenchmarks: input.communityBenchmarks,
    winRate: summary.winRate,
  });

  const improvements = buildImprovements({
    platform: input.platform,
    matches,
    winCount,
    lossCount,
    matchCount,
    kdNumeric,
    avgDeaths,
    formBand,
    latestAiReport: input.latestAiReport,
  });

  const half = splitHalfWeek(matches);
  const halfWeekRows = buildHalfWeekDeltas(half.early, half.late, kdLabel);
  const regressions = buildRegressions(halfWeekRows, input.latestAiReport);

  const focusFromAi =
    input.latestAiReport?.status === 'ready'
      ? input.latestAiReport.actionPlan?.[0]?.trim() || null
      : null;
  const focusNext = focusFromAi ?? improvements[0] ?? null;

  const communityItems = input.communityBenchmarks
    ? buildCommunityComparison({
        benchmarks: input.communityBenchmarks,
        winRate: summary.winRate,
        winRateNumeric: parsePlayerWinRateForCommunity(summary.winRate),
        kd,
        kdNumeric: parsePlayerKdForCommunity(kd),
        kills: summary.totalKills,
        matchCount,
        kdLabel,
        killsLabel: input.platform === 'rocket_league' ? 'Goles / semana' : 'Kills / semana',
      })
    : [];

  const communityRows = buildCommunityChartRows({
    summary,
    kdNumeric,
    avgKills,
    matchCount,
    benchmarks: input.communityBenchmarks ?? null,
    kdLabel,
    platform: input.platform,
  });

  const narrative = buildNarrative({
    formBand,
    matchCount,
    winCount,
    lossCount,
    winRate: summary.winRate,
    kdLabel,
    kd,
    avgKills,
    avgDeaths,
    avgAssists,
    bestKills,
    strengths,
    improvements,
    regressions,
    focusNext,
    focusFromAi,
    platform: input.platform,
    matches,
  });

  const body = narrative.slice(0, 2).join(' ');

  const metricCards: WeeklyCoachMetricCard[] = [
    {
      label: 'Record',
      value: `${winCount}W-${lossCount}L`,
      hint: `${summary.winRate} WR`,
      tone: winCount >= lossCount ? 'lime' : 'danger',
    },
    {
      label: kdLabel,
      value: kd,
      hint: `${avgKills.toFixed(1)} / ${avgDeaths.toFixed(1)} / ${avgAssists.toFixed(1)} avg`,
      tone: kdNumeric >= 1.2 ? 'cyan' : kdNumeric >= 1 ? 'gold' : 'danger',
    },
    {
      label: 'Partidas',
      value: String(matchCount),
      hint: `Mejor: ${bestKills} kills`,
      tone: 'muted',
    },
    {
      label: 'Forma',
      value: formBandLabel(formBand),
      hint: halfWeekRows[0]?.deltaLabel ?? 'Sin split mid-week',
      tone:
        formBand === 'hot' || formBand === 'solid'
          ? 'lime'
          : formBand === 'mixed'
            ? 'gold'
            : 'danger',
    },
  ];

  const lolCs = lolAverageCsPerMin(matches);
  if (lolCs != null) {
    metricCards.push({
      label: 'CS/min',
      value: lolCs.toFixed(1),
      hint: lolCs >= 7 ? 'Economía OK' : 'Farm a mejorar',
      tone: lolCs >= 7 ? 'lime' : 'gold',
    });
  }

  return {
    headline,
    body,
    narrative,
    strengths: strengths.slice(0, 5),
    improvements: improvements.slice(0, 5),
    regressions: regressions.slice(0, 4),
    focusNext,
    matchCount,
    winCount,
    lossCount,
    winRate: summary.winRate,
    kdLabel,
    kd,
    metricCards: metricCards.slice(0, 5),
    communityRows,
    communityItems,
    halfWeekRows,
    killsTrend: buildMatchMetricTrend(matches, (m) => m.stats?.kills ?? 0),
    kdTrend: buildMatchMetricTrend(matches, (m) => {
      const kills = m.stats?.kills ?? 0;
      const deaths = m.stats?.deaths ?? 0;
      return deaths === 0 ? kills : Number((kills / Math.max(deaths, 1)).toFixed(2));
    }),
    resultTrend: buildMatchMetricTrend(matches, (m) => (isMatchWin(m.stats) ? 1 : 0)),
  };
}

function emptySummary(kdLabel: string): WeeklyAiCoachSummary {
  return {
    headline: 'Todavía no hay semana para analizar',
    body: 'Cuando juegues partidas esta semana, acá vas a ver un resumen completo: record, forma, comparativas y qué mejorar.',
    narrative: [
      'Aún no hay suficientes partidas esta semana para armar el informe de coaching.',
      'Vinculá tu cuenta, jugá al menos 3 ranked y volvé: el coach resume wins/losses, tendencias y focos.',
    ],
    strengths: [],
    improvements: ['Cerrá al menos 3 partidas esta semana para desbloquear el resumen.'],
    regressions: [],
    focusNext: null,
    matchCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: '—',
    kdLabel,
    kd: '—',
    metricCards: [],
    communityRows: [],
    communityItems: [],
    halfWeekRows: [],
    killsTrend: [],
    kdTrend: [],
    resultTrend: [],
  };
}

type FormBand = 'hot' | 'solid' | 'mixed' | 'cold';

function formBandLabel(band: FormBand): string {
  if (band === 'hot') return 'Caliente';
  if (band === 'solid') return 'Sólida';
  if (band === 'mixed') return 'Mixta';
  return 'Fría';
}

function formScore(input: {
  winCount: number;
  lossCount: number;
  kdNumeric: number;
  matchCount: number;
}): FormBand {
  const wr = input.winCount / Math.max(input.matchCount, 1);
  if (wr >= 0.65 && input.kdNumeric >= 1.2) return 'hot';
  if (wr >= 0.5 || input.kdNumeric >= 1.4) return 'solid';
  if (wr >= 0.35) return 'mixed';
  return 'cold';
}

function headlineForForm(
  band: FormBand,
  winCount: number,
  lossCount: number,
  matchCount: number,
): string {
  if (band === 'hot') return `Semana caliente: ${winCount}W-${lossCount}L en ${matchCount}`;
  if (band === 'solid') return `Semana sólida: ${winCount}W-${lossCount}L — hay base para subir`;
  if (band === 'mixed') return `Semana mixta: ${winCount}W-${lossCount}L — toca cerrar detalles`;
  return `Semana dura: ${winCount}W-${lossCount}L — priorizá fundamentos`;
}

function buildNarrative(input: {
  formBand: FormBand;
  matchCount: number;
  winCount: number;
  lossCount: number;
  winRate: string;
  kdLabel: string;
  kd: string;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  bestKills: number;
  strengths: string[];
  improvements: string[];
  regressions: string[];
  focusNext: string | null;
  focusFromAi: string | null;
  platform: SelectedGame;
  matches: MatchUpdateView[];
}): string[] {
  const paragraphs: string[] = [];

  paragraphs.push(
    `Esta semana cerraste ${input.matchCount} partida${input.matchCount === 1 ? '' : 's'} con un record ${input.winCount}W-${input.lossCount}L (${input.winRate} WR). Tu ${input.kdLabel} semanal es ${input.kd}, con ${input.avgKills.toFixed(1)} kills, ${input.avgDeaths.toFixed(1)} deaths y ${input.avgAssists.toFixed(1)} assists de promedio.`,
  );

  if (input.formBand === 'hot') {
    paragraphs.push(
      `Estás en racha de conversión alta. El riesgo ahora no es “ganar más”: es no relajar fundamentals (visión, resets, selección de fights) cuando el scoreboard te invita a forzar.`,
    );
  } else if (input.formBand === 'cold') {
    paragraphs.push(
      `La semana está costando. Bajá el ego: priorizá partidas limpias (menos deaths, más farm/tempo) antes de pelear por highlight kills.`,
    );
  } else {
    paragraphs.push(
      `Hay señales buenas y puntos flojos. El salto de elo viene de estabilizar lo verde y atacar 1–2 errores repetidos, no de reinventar todo tu estilo.`,
    );
  }

  if (input.bestKills >= 8) {
    paragraphs.push(
      `Tu techo de impacto llegó a ${input.bestKills} kills en una partida: eso prueba ceiling mecánico. La pregunta del coach es cuántas veces por semana repetís ese nivel sin morir de más.`,
    );
  }

  const lolCs = lolAverageCsPerMin(input.matches);
  if (input.platform === 'league_of_legends' && lolCs != null) {
    paragraphs.push(
      `En LoL tu CS/min semanal ronda ${lolCs.toFixed(1)}. ${
        lolCs >= 8
          ? 'Eso es ritmo competitivo de oleadas.'
          : lolCs >= 7
            ? 'Es sólido; apuntá a sostenerlo en derrotas también.'
            : 'Ahí hay tempo económico perdido: cada 0.5 CS/min extra suma ítems más temprano.'
      }`,
    );
  }

  if (input.strengths[0]) {
    paragraphs.push(`Lo que mejoraste / estás haciendo bien: ${input.strengths.slice(0, 2).join('; ')}.`);
  }
  if (input.regressions[0]) {
    paragraphs.push(`Qué empeoró o se enfrió mid-week: ${input.regressions.slice(0, 2).join('; ')}.`);
  }
  if (input.improvements[0]) {
    paragraphs.push(`Plan inmediato: ${input.improvements[0]}.`);
  }
  if (input.focusFromAi && input.focusNext) {
    paragraphs.push(`Foco del último análisis Bedrock: ${input.focusNext}`);
  }

  return paragraphs;
}

function buildCommunityChartRows(input: {
  summary: ReturnType<typeof aggregateMatchStats>;
  kdNumeric: number;
  avgKills: number;
  matchCount: number;
  benchmarks: CommunityBenchmarks | null;
  kdLabel: string;
  platform: SelectedGame;
}): StatsComparisonRow[] {
  if (!input.benchmarks) return [];
  const avgKillsPerMatch =
    input.benchmarks.avgMatchesPerWeek > 0
      ? input.benchmarks.avgKillsPerWeek / input.benchmarks.avgMatchesPerWeek
      : input.benchmarks.avgKillsPerWeek;
  const wr = parsePlayerWinRateForCommunity(input.summary.winRate) ?? 0;

  return [
    {
      label: 'Win %',
      you: Number(wr.toFixed(1)),
      benchmark: Number(input.benchmarks.avgWinRate.toFixed(1)),
    },
    {
      label: input.kdLabel,
      you: Number(input.kdNumeric.toFixed(2)),
      benchmark: Number(input.benchmarks.avgKd.toFixed(2)),
    },
    {
      label: input.platform === 'rocket_league' ? 'Goles/partida' : 'Kills/partida',
      you: Number(input.avgKills.toFixed(1)),
      benchmark: Number(avgKillsPerMatch.toFixed(1)),
    },
    {
      label: 'Partidas/sem',
      you: input.matchCount,
      benchmark: Number(input.benchmarks.avgMatchesPerWeek.toFixed(1)),
    },
  ];
}

function splitHalfWeek(matches: MatchUpdateView[]): {
  early: MatchUpdateView[];
  late: MatchUpdateView[];
} {
  if (matches.length < 4) {
    return { early: [], late: [] };
  }
  const mid = Math.floor(matches.length / 2);
  return {
    early: matches.slice(0, mid),
    late: matches.slice(mid),
  };
}

function buildHalfWeekDeltas(
  early: MatchUpdateView[],
  late: MatchUpdateView[],
  kdLabel: string,
): WeeklyCoachDeltaRow[] {
  if (early.length === 0 || late.length === 0) return [];

  const a = aggregateMatchStats(early);
  const b = aggregateMatchStats(late);
  const aKd = a.totalDeaths === 0 ? a.totalKills : a.totalKills / Math.max(a.totalDeaths, 1);
  const bKd = b.totalDeaths === 0 ? b.totalKills : b.totalKills / Math.max(b.totalDeaths, 1);
  const aWr = a.matchCount ? (a.winCount / a.matchCount) * 100 : 0;
  const bWr = b.matchCount ? (b.winCount / b.matchCount) * 100 : 0;
  const aKills = a.matchCount ? a.totalKills / a.matchCount : 0;
  const bKills = b.matchCount ? b.totalKills / b.matchCount : 0;
  const aDeaths = a.matchCount ? a.totalDeaths / a.matchCount : 0;
  const bDeaths = b.matchCount ? b.totalDeaths / b.matchCount : 0;

  return [
    deltaRow('Win rate', `${aWr.toFixed(0)}%`, `${bWr.toFixed(0)}%`, bWr - aWr, true, '%'),
    deltaRow(kdLabel, aKd.toFixed(2), bKd.toFixed(2), bKd - aKd, true),
    deltaRow('Kills/partida', aKills.toFixed(1), bKills.toFixed(1), bKills - aKills, true),
    deltaRow('Deaths/partida', aDeaths.toFixed(1), bDeaths.toFixed(1), bDeaths - aDeaths, false),
  ];
}

function deltaRow(
  label: string,
  earlyValue: string,
  lateValue: string,
  delta: number,
  higherIsBetter: boolean,
  suffix = '',
): WeeklyCoachDeltaRow {
  const improved = higherIsBetter ? delta > 0.05 : delta < -0.05;
  const worsened = higherIsBetter ? delta < -0.05 : delta > 0.05;
  const direction = improved ? 'up' : worsened ? 'down' : 'flat';
  const sign = delta > 0 ? '+' : '';
  return {
    label,
    earlyValue,
    lateValue,
    deltaLabel: `${sign}${delta.toFixed(2)}${suffix}`,
    direction,
    note: improved
      ? 'Mejoró en la 2ª mitad de la semana'
      : worsened
        ? 'Empeoró en la 2ª mitad de la semana'
        : 'Estable entre mitades',
  };
}

function buildRegressions(
  halfWeekRows: WeeklyCoachDeltaRow[],
  latestAiReport?: MatchAiReportView | null,
): string[] {
  const out: string[] = [];
  for (const row of halfWeekRows) {
    if (row.direction === 'down') {
      out.push(`${row.label}: ${row.earlyValue} → ${row.lateValue} (${row.deltaLabel})`);
    }
  }
  const cons =
    latestAiReport?.status === 'ready' ? latestAiReport.cons?.slice(0, 1) ?? [] : [];
  for (const con of cons) {
    if (con.trim()) out.push(con.trim());
  }
  if (!out.length && halfWeekRows.some((r) => r.direction === 'flat')) {
    out.push(
      'No hay caída clara mid-week, pero un 100% WR puede esconder overconfidence — revisá deaths en las últimas 3',
    );
  }
  return unique(out);
}

function buildMatchMetricTrend(
  matches: MatchUpdateView[],
  valueOf: (match: MatchUpdateView) => number,
): TrendChartPoint[] {
  return matches.slice(-12).map((match, index, arr) => ({
    label: index === arr.length - 1 ? 'Última' : `${index + 1}`,
    value: valueOf(match),
  }));
}

function orderedMatches(matches: MatchUpdateView[]): MatchUpdateView[] {
  return [...matches].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );
}

function buildStrengths(input: {
  platform: SelectedGame;
  matches: MatchUpdateView[];
  winCount: number;
  lossCount: number;
  matchCount: number;
  kd: string;
  kdNumeric: number;
  kdLabel: string;
  avgKills: number;
  avgDeaths: number;
  bestKills: number;
  latestAiReport?: MatchAiReportView | null;
  communityBenchmarks?: CommunityBenchmarks | null;
  winRate: string;
}): string[] {
  const out: string[] = [];

  if (input.winCount >= input.lossCount && input.winCount > 0) {
    out.push(
      `Conversión alta: ${input.winCount} victorias vs ${input.lossCount} derrotas esta semana`,
    );
  }
  if (input.lossCount === 0 && input.winCount >= 3) {
    out.push('Cierre perfecto (0 losses): estás eligiendo bien cuándo pelear y cuándo resetear');
  }
  if (input.kdNumeric >= 1.5) {
    out.push(`${input.kdLabel} ${input.kd} — control de riesgo fuerte en pelea`);
  } else if (input.kdNumeric >= 1.1) {
    out.push(`${input.kdLabel} positivo (${input.kd}): ganás más intercambios de los que perdés`);
  }
  if (input.avgDeaths <= 3 && input.matchCount >= 3) {
    out.push(`Pocas deaths/partida (~${input.avgDeaths.toFixed(1)}) — posicionamiento estable`);
  }
  if (input.bestKills >= 10) {
    out.push(`Pico de impacto con ${input.bestKills} kills en una sola partida`);
  }

  const lolFarm = lolAverageCsPerMin(input.matches);
  if (lolFarm != null && lolFarm >= 7) {
    out.push(`Farm sólido (~${lolFarm.toFixed(1)} CS/min) sosteniendo economía`);
  }

  const aiPros =
    input.latestAiReport?.status === 'ready' ? input.latestAiReport.pros ?? [] : [];
  for (const pro of aiPros.slice(0, 2)) {
    if (pro.trim()) out.push(pro.trim());
  }

  if (input.communityBenchmarks) {
    const community = buildCommunityComparison({
      benchmarks: input.communityBenchmarks,
      winRate: input.winRate,
      winRateNumeric: parsePlayerWinRateForCommunity(input.winRate),
      kd: input.kd,
      kdNumeric: parsePlayerKdForCommunity(input.kd),
      kills: input.matches.reduce((sum, m) => sum + (m.stats?.kills ?? 0), 0),
      matchCount: input.matchCount,
      kdLabel: input.kdLabel,
      killsLabel: input.platform === 'rocket_league' ? 'Goles / semana' : 'Kills / semana',
    });
    const wr = community.find((item) => item.label === 'Win rate');
    if (wr && wr.betterThanPct >= 60) {
      out.push(`${wr.topPercentLabel} en win rate vs la comunidad esta semana`);
    }
  }

  return unique(out);
}

function buildImprovements(input: {
  platform: SelectedGame;
  matches: MatchUpdateView[];
  winCount: number;
  lossCount: number;
  matchCount: number;
  kdNumeric: number;
  avgDeaths: number;
  formBand: FormBand;
  latestAiReport?: MatchAiReportView | null;
}): string[] {
  const out: string[] = [];

  if (input.lossCount > input.winCount) {
    out.push(
      `Cerrá mejor las derrotas (${input.lossCount} losses): priorizá resets y no chasees fights perdidas`,
    );
  }
  if (input.avgDeaths >= 5) {
    out.push(
      `Bajá deaths (promedio ${input.avgDeaths.toFixed(1)}): menos overextend, más map awareness`,
    );
  }
  if (input.kdNumeric < 1) {
    out.push(
      `${isMobaLike(input.platform) ? 'KDA' : 'K/D'} < 1.0 — pelear solo con ventaja de visión/números`,
    );
  }

  const streak = currentLossStreak(input.matches);
  if (streak >= 3) {
    out.push(
      `${streak} derrotas seguidas: cortá tilt con una ranked focus (farm + 0 deaths forzadas)`,
    );
  }

  const lolFarm = lolAverageCsPerMin(input.matches);
  if (lolFarm != null && lolFarm < 6.5) {
    out.push(
      `CS/min bajo (~${lolFarm.toFixed(1)}): wave management > fights mid-map sin prioridad`,
    );
  }

  const vision = averageVision(input.matches);
  if (vision != null && vision < 18 && input.platform === 'league_of_legends') {
    out.push(
      `Visión baja (~${vision.toFixed(0)}): Control Ward en cada recall con +75 oro`,
    );
  }

  if (input.formBand === 'hot' && input.lossCount === 0) {
    out.push(
      'Con 100% WR, forzá 1 hábito defensivo: no pelees sin visión en río aunque vayas ahead',
    );
    out.push(
      'Grabá 1 death (si la hubo) o el fight más caótico: auditar overconfidence es el drill de semanas perfectas',
    );
  }

  const aiCons =
    input.latestAiReport?.status === 'ready' ? input.latestAiReport.cons ?? [] : [];
  for (const con of aiCons.slice(0, 2)) {
    if (con.trim()) out.push(con.trim());
  }

  if (!out.length) {
    out.push(
      'Repetí lo que funcionó y sumá 1 hábito: revisar minimapa en cada cannon / objetivo',
    );
  }

  return unique(out);
}

function lolAverageCsPerMin(matches: MatchUpdateView[]): number | null {
  const samples = matches
    .filter((m) => m.platform.toLowerCase() === 'league_of_legends')
    .map((m) => {
      const cs = m.stats?.cs;
      const durationSec = m.stats?.durationSec;
      if (cs == null || durationSec == null || durationSec <= 0) return null;
      return Number(cs) / (Number(durationSec) / 60);
    })
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!samples.length) return null;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

function averageVision(matches: MatchUpdateView[]): number | null {
  const values = matches
    .map((m) => m.stats?.visionScore)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function currentLossStreak(matches: MatchUpdateView[]): number {
  const ordered = [...matches].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  let streak = 0;
  for (const match of ordered) {
    if (isMatchWin(match.stats)) break;
    streak += 1;
  }
  return streak;
}

function isMobaLike(platform: SelectedGame): boolean {
  return (
    platform === 'league_of_legends' ||
    platform === 'dota2' ||
    platform === 'valorant' ||
    platform === 'overwatch2'
  );
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
