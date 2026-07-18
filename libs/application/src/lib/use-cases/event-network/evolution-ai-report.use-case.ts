import type { GamePlatform } from '@stats-games/domain';
import { RequestEvolutionAiReportInputSchema } from '../../dto/event-network/evolution-ai-report.dto';
import type {
  EvolutionAiReportRecord,
  IEvolutionAiAnalysisQueuePublisher,
  IEvolutionAiReportRepository,
} from '../../ports/event-network/evolution-ai.port';

export class GetEvolutionAiReportUseCase {
  constructor(private readonly repository: IEvolutionAiReportRepository) {}

  execute(input: {
    userId: string;
    platform: GamePlatform;
    periodId: string;
  }): Promise<EvolutionAiReportRecord | null> {
    return this.repository.getByPeriod(input.userId, input.platform, input.periodId);
  }
}

export class ListEvolutionAiReportsUseCase {
  constructor(private readonly repository: IEvolutionAiReportRepository) {}

  execute(input: {
    userId: string;
    platform?: GamePlatform;
    limit?: number;
  }): Promise<EvolutionAiReportRecord[]> {
    return this.repository.listByUser(input.userId, {
      platform: input.platform,
      limit: input.limit,
    });
  }
}

export class RequestEvolutionAiReportUseCase {
  constructor(
    private readonly repository: IEvolutionAiReportRepository,
    private readonly queue: IEvolutionAiAnalysisQueuePublisher,
  ) {}

  async execute(raw: unknown): Promise<EvolutionAiReportRecord> {
    const input = RequestEvolutionAiReportInputSchema.parse(raw);
    const existing = await this.repository.getByPeriod(
      input.userId,
      input.platform,
      input.periodId,
    );

    if (existing?.status === 'ready' && !input.force) {
      return existing;
    }
    if (existing?.status === 'pending' && !input.force) {
      return existing;
    }

    const pending: EvolutionAiReportRecord = {
      userId: input.userId,
      platform: input.platform,
      periodId: input.periodId,
      headline: 'Generando informe de evolución…',
      summary: 'La IA está analizando tu tendencia semanal. Esto puede demorar unos segundos.',
      markdown: '',
      performanceScore: 0,
      gradeLabel: '…',
      verdict: 'stable',
      pros: [],
      cons: [],
      actionPlan: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.repository.save(pending);
    await this.queue.enqueue({
      kind: 'evolution',
      userId: input.userId,
      platform: input.platform,
      periodId: input.periodId,
    });

    return pending;
  }
}
