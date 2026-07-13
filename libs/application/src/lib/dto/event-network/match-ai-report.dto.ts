import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const MatchAiAnalysisQueueMessageSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
});

export type MatchAiAnalysisQueueMessage = z.infer<typeof MatchAiAnalysisQueueMessageSchema>;

export const MatchAiReportDtoSchema = z.object({
  userId: z.string().min(1),
  matchId: z.string().min(1),
  platform: GamePlatformSchema,
  headline: z.string().min(1),
  summary: z.string().min(1),
  markdown: z.string(),
  performanceScore: z.number().int().min(0).max(100),
  gradeLabel: z.string().min(1),
  verdict: z.string().min(1),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  actionPlan: z.array(z.string()),
  status: z.enum(['ready', 'failed']),
  createdAt: z.string().min(1),
});

export type MatchAiReportDto = z.infer<typeof MatchAiReportDtoSchema>;
