import type { TrendChartPoint } from '../core/charts/chart.types';
import type { MatchUpdateView } from '../services/match.service';
import { isRobloxPlatform, matchSessionContext, parseMatchSummary } from './match-display.util';
import {
  aggregateMatchStats,
  computeKdRatio,
  formatMatchRelativeTime,
  getMatchOutcome,
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

export interface MatchAnalysisReport {
  headline: string;
  summary: string;
  narrative: string[];
  verdict: 'victory' | 'podium' | 'solid' | 'rough';
  performanceScore: number;
  gradeLabel: string;
  pros: string[];
  cons: string[];
  focusNext: string;
  actionPlan: string[];
  keyMetrics: MatchAnalysisMetric[];
  comparisonRows: MatchAnalysisComparisonRow[];
  radarAxes: MatchAnalysisRadarAxis[];
  recentKillsTrend: TrendChartPoint[];
  isPreview: boolean;
}

export interface BuildMatchAnalysisInput {
  match: MatchUpdateView;
  recentMatches?: MatchUpdateView[];
}

export function matchDetailRoute(matchId: string): string {
  return `/tabs/matches/${encodeURIComponent(matchId)}`;
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
      placement,
      kdLabel,
      kills,
      deaths,
      assists,
      recentSummary,
      outcomeLabel: outcome.label,
    }),
    comparisonRows: buildComparisonRows({
      kills,
      kd,
      placement,
      avgKills,
      avgKd,
      avgPlacement,
      recentCount: recentSummary.matchCount,
    }),
    radarAxes: buildMatchRadarAxes({ kills, deaths, placement, assists, kd, verdict }),
    recentKillsTrend: buildRecentKillsTrend(input.recentMatches ?? [], match.matchId),
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
  placement: number | null;
  kdLabel: string;
  kills: number;
  deaths: number;
  assists: number;
  recentSummary: ReturnType<typeof aggregateMatchStats>;
  outcomeLabel: string;
}): MatchAnalysisMetric[] {
  const metrics: MatchAnalysisMetric[] = [
    {
      label: 'Resultado',
      value: input.outcomeLabel,
      accent: input.placement === 1 ? 'lime' : 'default',
    },
    {
      label: 'Placement',
      value: input.placement != null ? `#${input.placement}` : '—',
      accent: input.placement != null && input.placement <= 3 ? 'lime' : 'cyan',
    },
    { label: 'K/D', value: input.kdLabel, accent: 'cyan' },
    { label: 'Kills', value: String(input.kills) },
    { label: 'Deaths', value: String(input.deaths) },
  ];

  if (input.assists > 0) {
    metrics.push({ label: 'Assists', value: String(input.assists) });
  }

  if (input.recentSummary.matchCount >= 3) {
    metrics.push({
      label: 'Win rate reciente',
      value: input.recentSummary.winRate,
      hint: `${input.recentSummary.matchCount} partidas`,
    });
  }

  return metrics;
}

function buildComparisonRows(input: {
  kills: number;
  kd: number;
  placement: number | null;
  avgKills: number;
  avgKd: number;
  avgPlacement: number;
  recentCount: number;
}): MatchAnalysisComparisonRow[] {
  if (input.recentCount < 1) return [];

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
  ];

  if (input.placement != null && !Number.isNaN(input.avgPlacement)) {
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
  kills: number;
  deaths: number;
  placement: number | null;
  assists: number;
  kd: number;
  verdict: MatchAnalysisReport['verdict'];
}): MatchAnalysisRadarAxis[] {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  return [
    { name: 'Frageo', value: clamp((input.kills / 8) * 100) },
    { name: 'Supervivencia', value: clamp(100 - input.deaths * 18) },
    {
      name: 'Placement',
      value: input.placement != null ? clamp(100 - input.placement * 0.9) : 40,
    },
    { name: 'K/D', value: clamp((input.kd / 2.5) * 100) },
    { name: 'Teamplay', value: clamp((input.assists / 5) * 100) },
    {
      name: 'Impacto',
      value:
        input.verdict === 'victory' ? 95 : input.verdict === 'podium' ? 78 : input.verdict === 'solid' ? 62 : 45,
    },
  ];
}

function buildRecentKillsTrend(
  recentMatches: MatchUpdateView[],
  currentMatchId: string,
): TrendChartPoint[] {
  const ordered = [...recentMatches]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 7)
    .reverse();

  const currentInList = ordered.some((m) => m.matchId === currentMatchId);
  const pool = currentInList
    ? ordered
    : [
        ...ordered,
        ...recentMatches.filter((m) => m.matchId === currentMatchId),
      ].slice(-8);

  return pool.map((m, index) => ({
    label: m.matchId === currentMatchId ? 'Esta' : `-${pool.length - index}`,
    value: m.stats?.kills ?? 0,
  }));
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
