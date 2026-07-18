import type { GamePlatform } from '@stats-games/domain';

export interface EvolutionAiReportRecord {
  userId: string;
  platform: GamePlatform;
  periodId: string;
  headline: string;
  summary: string;
  markdown: string;
  performanceScore: number;
  gradeLabel: string;
  verdict: string;
  pros: string[];
  cons: string[];
  actionPlan: string[];
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

export interface EvolutionAiReadyEvent {
  userId: string;
  platform: string;
  periodId: string;
  headline: string;
  summary: string;
  performanceScore?: number;
  gradeLabel?: string;
  verdict?: string;
  status: string;
  createdAt: string;
}

export interface IEvolutionAiReportRepository {
  save(report: EvolutionAiReportRecord): Promise<void>;
  getByPeriod(
    userId: string,
    platform: GamePlatform,
    periodId: string,
  ): Promise<EvolutionAiReportRecord | null>;
  listByUser(
    userId: string,
    options?: { platform?: GamePlatform; limit?: number },
  ): Promise<EvolutionAiReportRecord[]>;
}

export interface IEvolutionAiReadyNotifier {
  publishEvolutionAiReady(event: EvolutionAiReadyEvent): Promise<void>;
}

export interface EvolutionAiAnalysisMessage {
  kind: 'evolution';
  userId: string;
  platform: GamePlatform;
  periodId: string;
}

export interface IEvolutionAiAnalysisQueuePublisher {
  enqueue(message: EvolutionAiAnalysisMessage): Promise<void>;
}
