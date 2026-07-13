import { ProcessMatchFromQueueUseCase } from '@stats-games/application';
import {
  AppSyncMatchUpdatePublisherAdapter,
  ConsoleLogger,
  DynamoDbMatchRepository,
  DynamoDbStatsSummaryRepository,
  SqsMatchAiAnalysisQueuePublisherAdapter,
} from '@stats-games/infrastructure';

let cachedUseCase: ProcessMatchFromQueueUseCase | undefined;

export function buildProcessMatchFromQueueUseCase(): ProcessMatchFromQueueUseCase {
  if (cachedUseCase) return cachedUseCase;

  const matchRepository = new DynamoDbMatchRepository();
  const matchAiPublisher = process.env['MATCH_AI_ANALYSIS_QUEUE_URL']
    ? new SqsMatchAiAnalysisQueuePublisherAdapter()
    : undefined;

  cachedUseCase = new ProcessMatchFromQueueUseCase({
    matchWriter: matchRepository,
    matchEventNotifier: new AppSyncMatchUpdatePublisherAdapter(),
    statsSummaryRepository: new DynamoDbStatsSummaryRepository(),
    matchAiAnalysisPublisher: matchAiPublisher,
    logger: new ConsoleLogger({ source: 'game_processor' }),
  });

  return cachedUseCase;
}
