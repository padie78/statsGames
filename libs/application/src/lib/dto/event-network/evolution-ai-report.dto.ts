import { z } from 'zod';
import { GamePlatformSchema } from '../ingestion/game-webhook.dto';

export const EvolutionAiAnalysisQueueMessageSchema = z.object({
  kind: z.literal('evolution'),
  userId: z.string().min(1),
  platform: GamePlatformSchema,
  periodId: z.string().min(1),
});

export type EvolutionAiAnalysisQueueMessage = z.infer<
  typeof EvolutionAiAnalysisQueueMessageSchema
>;

export const EvolutionAiReportDtoSchema = z.object({
  userId: z.string().min(1),
  platform: GamePlatformSchema,
  periodId: z.string().min(1),
  headline: z.string().min(1),
  summary: z.string().min(1),
  markdown: z.string(),
  performanceScore: z.number().int().min(0).max(100),
  gradeLabel: z.string().min(1),
  verdict: z.string().min(1),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  actionPlan: z.array(z.string()),
  status: z.enum(['pending', 'ready', 'failed']),
  createdAt: z.string().min(1),
});

export type EvolutionAiReportDto = z.infer<typeof EvolutionAiReportDtoSchema>;

export const RequestEvolutionAiReportInputSchema = z.object({
  userId: z.string().min(1),
  platform: GamePlatformSchema,
  periodId: z.string().min(1),
  force: z.boolean().optional(),
});

export type RequestEvolutionAiReportInput = z.infer<
  typeof RequestEvolutionAiReportInputSchema
>;
