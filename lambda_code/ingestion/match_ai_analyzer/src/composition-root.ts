import {
  AnalyzeEvolutionWithAiUseCase,
  AnalyzeMatchWithAiUseCase,
} from '@stats-games/application';
import {
  AppSyncEvolutionAiReadyPublisherAdapter,
  AppSyncMatchAiReadyPublisherAdapter,
  BedrockClaudeInvoker,
  ConsoleLogger,
  DynamoDbCommunityStatsRepository,
  DynamoDbEvolutionAiReportRepository,
  DynamoDbMatchAiReportRepository,
  DynamoDbMatchRepository,
  DynamoDbPlayerProfileRepository,
  DynamoDbStatsSummaryRepository,
} from '@stats-games/infrastructure';

let cachedMatch: AnalyzeMatchWithAiUseCase | undefined;
let cachedEvolution: AnalyzeEvolutionWithAiUseCase | undefined;

export function buildAnalyzeMatchWithAiUseCase(): AnalyzeMatchWithAiUseCase {
  if (cachedMatch) return cachedMatch;

  const invoker = new BedrockClaudeInvoker();
  cachedMatch = new AnalyzeMatchWithAiUseCase({
    matchReader: new DynamoDbMatchRepository(),
    reportRepository: new DynamoDbMatchAiReportRepository(),
    notifier: new AppSyncMatchAiReadyPublisherAdapter(),
    invokeModel: (prompt) => invoker.invoke(prompt),
    logger: new ConsoleLogger({ source: 'match_ai_analyzer' }),
  });

  return cachedMatch;
}

export function buildAnalyzeEvolutionWithAiUseCase(): AnalyzeEvolutionWithAiUseCase {
  if (cachedEvolution) return cachedEvolution;

  const invoker = new BedrockClaudeInvoker();
  cachedEvolution = new AnalyzeEvolutionWithAiUseCase({
    matchReader: new DynamoDbMatchRepository(),
    rollupReader: new DynamoDbStatsSummaryRepository(),
    reportRepository: new DynamoDbEvolutionAiReportRepository(),
    profiles: new DynamoDbPlayerProfileRepository(),
    community: new DynamoDbCommunityStatsRepository(),
    notifier: new AppSyncEvolutionAiReadyPublisherAdapter(),
    invokeModel: (prompt) => invoker.invoke(prompt),
    logger: new ConsoleLogger({ source: 'evolution_ai_analyzer' }),
  });

  return cachedEvolution;
}
