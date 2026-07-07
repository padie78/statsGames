import { ProcessMatchFromQueueUseCase } from '@stats-games/application';
import {
  AppSyncMatchUpdatePublisherAdapter,
  ConsoleLogger,
  DynamoDbMatchRepository,
  DynamoDbStatsSummaryRepository,
} from '@stats-games/infrastructure';

let cachedUseCase: ProcessMatchFromQueueUseCase | undefined;

export function buildProcessMatchFromQueueUseCase(): ProcessMatchFromQueueUseCase {
  if (cachedUseCase) return cachedUseCase;

  const matchRepository = new DynamoDbMatchRepository();

  cachedUseCase = new ProcessMatchFromQueueUseCase({
    matchWriter: matchRepository,
    matchEventNotifier: new AppSyncMatchUpdatePublisherAdapter(),
    statsSummaryRepository: new DynamoDbStatsSummaryRepository(),
    logger: new ConsoleLogger({ source: 'game_processor' }),
  });

  return cachedUseCase;
}
