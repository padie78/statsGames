import type { GamePlatform, Match } from '@stats-games/domain';
import { EvolutionAiAnalysisQueueMessageSchema } from '../../dto/event-network/evolution-ai-report.dto';
import type {
  EvolutionAiReportRecord,
  IEvolutionAiReadyNotifier,
  IEvolutionAiReportRepository,
} from '../../ports/event-network/evolution-ai.port';
import type { IMatchReader } from '../../ports/event-network/match.port';
import type { IPlayerProfileRepository } from '../../ports/player/player-profile.repository.port';
import type { IStatsRollupReader } from '../../ports/event-network/stats-summary.repository.port';
import type { ICommunityStatsRepository } from '../../ports/event-network/community-stats.repository.port';
import type { ILogger } from '../../ports/shared/logger.port';
import {
  buildEvolutionAnalysisPrompt,
  type EvolutionPromptContext,
} from './evolution-analysis-prompt.registry';

export interface AnalyzeEvolutionAiDeps {
  matchReader: IMatchReader;
  rollupReader: IStatsRollupReader;
  reportRepository: IEvolutionAiReportRepository;
  profiles: IPlayerProfileRepository;
  community?: ICommunityStatsRepository;
  notifier: IEvolutionAiReadyNotifier;
  invokeModel: (prompt: string) => Promise<string>;
  logger?: ILogger;
}

interface BedrockAnalysisJson {
  headline?: string;
  summary?: string;
  markdown?: string;
  performanceScore?: number;
  gradeLabel?: string;
  verdict?: string;
  pros?: string[];
  cons?: string[];
  actionPlan?: string[];
}

export class AnalyzeEvolutionWithAiUseCase {
  constructor(private readonly deps: AnalyzeEvolutionAiDeps) {}

  async execute(raw: unknown): Promise<{ periodId: string; status: string }> {
    const message = EvolutionAiAnalysisQueueMessageSchema.parse(raw);
    const ctx = await this.buildContext(message);
    const prompt = buildEvolutionAnalysisPrompt(ctx);

    let report: EvolutionAiReportRecord;
    try {
      const rawModel = await this.deps.invokeModel(prompt);
      const parsed = parseModelJson(rawModel);
      report = toReport(message, parsed, 'ready');
    } catch (error) {
      this.deps.logger?.error('Bedrock evolution analyze falló', {
        periodId: message.periodId,
        platform: message.platform,
        error: error instanceof Error ? error.message : String(error),
      });
      report = toReport(
        message,
        {
          headline: 'Informe de evolución no disponible',
          summary: 'No se pudo generar el análisis con Bedrock. Reintentá más tarde.',
          markdown:
            '# Informe de evolución\n\n## Error\n\nEl análisis IA falló. Tus KPIs y gráficos siguen disponibles.',
          performanceScore: 50,
          gradeLabel: 'N/A',
          verdict: 'stable',
          pros: [],
          cons: ['El proveedor de IA no respondió correctamente.'],
          actionPlan: [
            'Revisá las tendencias diarias manualmente.',
            'Reintentá el informe cuando Bedrock esté disponible.',
            'Priorizá consistencia de volumen de partidas esta semana.',
          ],
        },
        'failed',
      );
    }

    await this.deps.reportRepository.save(report);
    await this.deps.notifier.publishEvolutionAiReady({
      userId: report.userId,
      platform: report.platform,
      periodId: report.periodId,
      headline: report.headline,
      summary: report.summary,
      performanceScore: report.performanceScore,
      gradeLabel: report.gradeLabel,
      verdict: report.verdict,
      status: report.status,
      createdAt: report.createdAt,
    });

    return { periodId: report.periodId, status: report.status };
  }

  private async buildContext(message: {
    userId: string;
    platform: GamePlatform;
    periodId: string;
  }): Promise<EvolutionPromptContext> {
    const profile = await this.deps.profiles.findByUserId(message.userId);
    const matches = await this.deps.matchReader.listByUser(message.userId, {
      platform: message.platform,
      limit: 40,
    });

    const weeklyRows = await this.deps.rollupReader.listByPlayerGranularity(
      message.userId,
      'WEEKLY',
      message.periodId,
      { platform: message.platform, limit: 5 },
    );
    const weekly =
      weeklyRows.find((r) => r.platform === message.platform) ?? weeklyRows[0] ?? null;

    const prevPeriod = previousWeeklyPeriodId(message.periodId);
    const previousWeeklyRows = prevPeriod
      ? await this.deps.rollupReader.listByPlayerGranularity(
          message.userId,
          'WEEKLY',
          prevPeriod,
          { platform: message.platform, limit: 5 },
        )
      : [];
    const previousWeekly =
      previousWeeklyRows.find((r) => r.platform === message.platform) ??
      previousWeeklyRows[0] ??
      null;

    const daily = await this.deps.rollupReader.listRecentDailyRollups(message.userId, {
      platform: message.platform,
      days: 7,
    });

    let community: EvolutionPromptContext['community'] = null;
    if (this.deps.community) {
      try {
        const board = await this.deps.community.listWeeklyLeaderboard(
          message.platform,
          message.periodId,
          40,
        );
        const you = board.find((row) => row.userId === message.userId);
        const bench = await this.deps.community.getCommunityBenchmarks(
          message.platform,
          message.periodId,
        );
        community = {
          yourRank: you?.rank ?? null,
          sampleSize: bench?.sampleSize ?? board.length,
          avgKd: bench?.avgKd ?? null,
          avgWinRate: bench?.avgWinRate ?? null,
        };
      } catch {
        community = null;
      }
    }

    const wins = matches.filter((m) => m.stats.toRecord()['won'] === true).length;
    const assists = matches.reduce((sum, m) => sum + Number(m.stats.toRecord()['assists'] ?? 0), 0);

    return {
      userId: message.userId,
      platform: message.platform,
      periodId: message.periodId,
      gamerTag: profile?.gamerTag,
      weekly: {
        matchCount: weekly?.kpis.match_count ?? matches.length,
        totalKills: weekly?.kpis.total_kills ?? sumStat(matches, 'kills'),
        totalDeaths: weekly?.kpis.total_deaths ?? sumStat(matches, 'deaths'),
        totalAssists: assists,
        winCount: wins,
        avgPlacement: weekly?.kpis.avg_placement,
      },
      previousWeekly: previousWeekly
        ? {
            matchCount: previousWeekly.kpis.match_count,
            totalKills: previousWeekly.kpis.total_kills,
            totalDeaths: previousWeekly.kpis.total_deaths,
          }
        : null,
      dailyTrend: daily
        .filter((d) => !d.platform || d.platform === message.platform)
        .map((d) => ({
          periodId: d.periodId,
          matchCount: d.kpis.match_count,
          totalKills: d.kpis.total_kills,
          totalDeaths: d.kpis.total_deaths,
        })),
      recentMatches: matches.slice(0, 12).map((m) => {
        const s = m.stats.toRecord();
        return {
          matchId: m.matchId,
          summary: m.summary(),
          won: typeof s['won'] === 'boolean' ? s['won'] : null,
          kills: numOrNull(s['kills']),
          deaths: numOrNull(s['deaths']),
          assists: numOrNull(s['assists']),
          champion: typeof s['champion'] === 'string' ? s['champion'] : null,
          placement: numOrNull(s['placement']),
        };
      }),
      community,
    };
  }
}

function previousWeeklyPeriodId(periodId: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(periodId);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week > 1) return `${year}-W${String(week - 1).padStart(2, '0')}`;
  return `${year - 1}-W52`;
}

function sumStat(matches: Match[], key: string): number {
  return matches.reduce((sum, m) => sum + Number(m.stats.toRecord()[key] ?? 0), 0);
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseModelJson(raw: string): BedrockAnalysisJson {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Respuesta Bedrock sin JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as BedrockAnalysisJson;
}

function toReport(
  message: { userId: string; platform: GamePlatform; periodId: string },
  parsed: BedrockAnalysisJson,
  status: 'ready' | 'failed',
): EvolutionAiReportRecord {
  const score = Math.max(0, Math.min(100, Math.round(parsed.performanceScore ?? 55)));
  return {
    userId: message.userId,
    platform: message.platform,
    periodId: message.periodId,
    headline: (parsed.headline ?? 'Informe de evolución').slice(0, 160),
    summary: (parsed.summary ?? 'Análisis semanal de tu evolución.').slice(0, 400),
    markdown: parsed.markdown ?? '',
    performanceScore: score,
    gradeLabel: (parsed.gradeLabel ?? 'B').slice(0, 8),
    verdict: (parsed.verdict ?? 'stable').slice(0, 32),
    pros: (parsed.pros ?? []).map(String).slice(0, 8),
    cons: (parsed.cons ?? []).map(String).slice(0, 8),
    actionPlan: (parsed.actionPlan ?? []).map(String).slice(0, 5),
    status,
    createdAt: new Date().toISOString(),
  };
}
