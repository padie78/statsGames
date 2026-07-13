import { AnalyzeMatchWithAiUseCase } from '@stats-games/application';
import {
  AppSyncMatchAiReadyPublisherAdapter,
  BedrockClaudeInvoker,
  ConsoleLogger,
  DynamoDbMatchAiReportRepository,
  DynamoDbMatchRepository,
} from '@stats-games/infrastructure';

let cached: AnalyzeMatchWithAiUseCase | undefined;

export function buildAnalyzeMatchWithAiUseCase(): AnalyzeMatchWithAiUseCase {
  if (cached) return cached;

  const invoker = new BedrockClaudeInvoker();
  cached = new AnalyzeMatchWithAiUseCase({
    matchReader: new DynamoDbMatchRepository(),
    reportRepository: new DynamoDbMatchAiReportRepository(),
    notifier: new AppSyncMatchAiReadyPublisherAdapter(),
    invokeModel: (prompt) => invoker.invoke(prompt),
    logger: new ConsoleLogger({ source: 'match_ai_analyzer' }),
  });

  return cached;
}
