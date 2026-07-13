import type { GamePlatform } from '@stats-games/domain';
import type { IMatchAiReportRepository } from '../../ports/event-network/match.port';
import type { MatchAiReportDto } from '../../dto/event-network/match-ai-report.dto';

export class GetMatchAiReportUseCase {
  constructor(private readonly repository: IMatchAiReportRepository) {}

  async execute(input: {
    userId: string;
    matchId: string;
  }): Promise<MatchAiReportDto | null> {
    if (!input.userId?.trim() || !input.matchId?.trim()) {
      throw new Error('userId y matchId son requeridos.');
    }
    return this.repository.getByMatch(input.userId.trim(), input.matchId.trim());
  }
}

export class ListMatchAiReportsUseCase {
  constructor(private readonly repository: IMatchAiReportRepository) {}

  async execute(input: {
    userId: string;
    platform?: GamePlatform;
    limit?: number;
  }): Promise<MatchAiReportDto[]> {
    if (!input.userId?.trim()) {
      throw new Error('userId requerido.');
    }
    return this.repository.listByUser(input.userId.trim(), {
      platform: input.platform,
      limit: input.limit ?? 20,
    });
  }
}
