import type { GamePlatform } from '@stats-games/domain';
import type { Match } from '@stats-games/domain';

export interface IMatchWriter {
  save(match: Match): Promise<void>;
}

export interface IMatchReader {
  listByUser(
    userId: string,
    options?: { platform?: GamePlatform; limit?: number },
  ): Promise<Match[]>;
  getByUserAndMatchId?(userId: string, matchId: string): Promise<Match | null>;
}

export interface IMatchEventNotifier {
  publishMatchUpdate(match: Match): Promise<void>;
}

export interface MatchAiAnalysisMessage {
  userId: string;
  matchId: string;
  platform: GamePlatform;
}

export interface IMatchAiAnalysisQueuePublisher {
  enqueue(message: MatchAiAnalysisMessage): Promise<void>;
}

export interface MatchAiReportRecord {
  userId: string;
  matchId: string;
  platform: GamePlatform;
  headline: string;
  summary: string;
  markdown: string;
  performanceScore: number;
  gradeLabel: string;
  verdict: string;
  pros: string[];
  cons: string[];
  actionPlan: string[];
  status: 'ready' | 'failed';
  createdAt: string;
}

export interface MatchAiReadyEvent {
  userId: string;
  matchId: string;
  platform: string;
  headline: string;
  summary: string;
  performanceScore?: number;
  gradeLabel?: string;
  verdict?: string;
  status: string;
  createdAt: string;
}

export interface IMatchAiReportRepository {
  save(report: MatchAiReportRecord): Promise<void>;
  getByMatch(userId: string, matchId: string): Promise<MatchAiReportRecord | null>;
  listByUser(
    userId: string,
    options?: { platform?: GamePlatform; limit?: number },
  ): Promise<MatchAiReportRecord[]>;
}

export interface IMatchAiReadyNotifier {
  publishMatchAiReady(event: MatchAiReadyEvent): Promise<void>;
}
