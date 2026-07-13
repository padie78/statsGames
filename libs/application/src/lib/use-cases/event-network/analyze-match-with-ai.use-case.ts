import type { Match } from '@stats-games/domain';
import { MatchAiAnalysisQueueMessageSchema } from '../../dto/event-network/match-ai-report.dto';
import type {
  IMatchAiReadyNotifier,
  IMatchAiReportRepository,
  IMatchReader,
  MatchAiReportRecord,
} from '../../ports/event-network/match.port';
import type { ILogger } from '../../ports/shared/logger.port';

export interface AnalyzeMatchAiDeps {
  matchReader: IMatchReader;
  reportRepository: IMatchAiReportRepository;
  notifier: IMatchAiReadyNotifier;
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

export class AnalyzeMatchWithAiUseCase {
  constructor(private readonly deps: AnalyzeMatchAiDeps) {}

  async execute(raw: unknown): Promise<{ matchId: string; status: string }> {
    const message = MatchAiAnalysisQueueMessageSchema.parse(raw);
    const match = await this.loadMatch(message.userId, message.matchId);
    if (!match) {
      throw new Error(`Match no encontrado: ${message.matchId}`);
    }

    const stats = match.stats.toRecord();
    const prompt = buildValorantPrompt(match, stats);

    let report: MatchAiReportRecord;
    try {
      const rawModel = await this.deps.invokeModel(prompt);
      const parsed = parseModelJson(rawModel);
      report = toReport(match, parsed, 'ready');
    } catch (error) {
      this.deps.logger?.error('Bedrock analyze falló', {
        matchId: message.matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      report = toReport(
        match,
        {
          headline: 'Análisis no disponible',
          summary: 'No se pudo generar el coaching con Bedrock. Reintentá más tarde.',
          markdown: '## Error\n\nEl análisis IA falló. Las stats de la partida siguen disponibles.',
          performanceScore: 50,
          gradeLabel: 'N/A',
          verdict: 'solid',
          pros: [],
          cons: ['El proveedor de IA no respondió correctamente.'],
          actionPlan: ['Revisá KDA y HS% manualmente hasta el próximo análisis.'],
        },
        'failed',
      );
    }

    await this.deps.reportRepository.save(report);
    await this.deps.notifier.publishMatchAiReady({
      userId: report.userId,
      matchId: report.matchId,
      platform: report.platform,
      headline: report.headline,
      summary: report.summary,
      performanceScore: report.performanceScore,
      gradeLabel: report.gradeLabel,
      verdict: report.verdict,
      status: report.status,
      createdAt: report.createdAt,
    });

    return { matchId: report.matchId, status: report.status };
  }

  private async loadMatch(userId: string, matchId: string): Promise<Match | null> {
    if (this.deps.matchReader.getByUserAndMatchId) {
      return this.deps.matchReader.getByUserAndMatchId(userId, matchId);
    }
    const recent = await this.deps.matchReader.listByUser(userId, { limit: 100 });
    return recent.find((m) => m.matchId === matchId) ?? null;
  }
}

function buildValorantPrompt(match: Match, stats: Record<string, unknown>): string {
  return `Sos el AI Coach de StatsGames para jugadores de Valorant (rol Jugador / micro post-partida).
Respondé SOLO con un JSON válido (sin markdown fences) con esta forma:
{
  "headline": string,
  "summary": string (1-2 oraciones),
  "markdown": string (markdown breve: contexto, lo que salió bien/mal, foco),
  "performanceScore": number 0-100,
  "gradeLabel": string (ej. S, A, B, C),
  "verdict": "victory" | "podium" | "solid" | "rough",
  "pros": string[],
  "cons": string[],
  "actionPlan": string[] (3 pasos concretos)
}

Glosario Valorant a usar cuando aplique: aim/HS%, trades, utility usage, site execute, retake, clutch, eco/anti-eco, mid-round calls, first blood, entry, lurk, support.
Tono: directo, motivador, sin humo. Español rioplatense neutro.

Datos de la partida:
matchId: ${match.matchId}
platform: ${match.platform}
occurredAt: ${match.occurredAtIso}
summary: ${match.summary()}
statsJson: ${JSON.stringify(stats)}`;
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
  match: Match,
  parsed: BedrockAnalysisJson,
  status: 'ready' | 'failed',
): MatchAiReportRecord {
  const score = clampScore(parsed.performanceScore ?? 55);
  return {
    userId: match.userId,
    matchId: match.matchId,
    platform: match.platform,
    headline: (parsed.headline ?? 'Análisis de partida').slice(0, 160),
    summary: (parsed.summary ?? match.summary()).slice(0, 400),
    markdown: parsed.markdown ?? `## Análisis\n\n${parsed.summary ?? match.summary()}`,
    performanceScore: score,
    gradeLabel: (parsed.gradeLabel ?? gradeFromScore(score)).slice(0, 8),
    verdict: normalizeVerdict(parsed.verdict),
    pros: asStringList(parsed.pros),
    cons: asStringList(parsed.cons),
    actionPlan: asStringList(parsed.actionPlan).slice(0, 5),
    status,
    createdAt: new Date().toISOString(),
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function normalizeVerdict(raw?: string): string {
  const v = (raw ?? 'solid').toLowerCase();
  if (v === 'victory' || v === 'podium' || v === 'solid' || v === 'rough') return v;
  return 'solid';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 8);
}
