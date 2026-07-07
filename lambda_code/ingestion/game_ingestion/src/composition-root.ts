import { EnqueueGameEventUseCase } from '@stats-games/application';
import {
  ConsoleLogger,
  DynamoDbPlatformAccountResolver,
  SqsGameIngestionQueuePublisherAdapter,
} from '@stats-games/infrastructure';

let cachedUseCase: EnqueueGameEventUseCase | undefined;

export function buildEnqueueGameEventUseCase(): EnqueueGameEventUseCase {
  if (cachedUseCase) return cachedUseCase;

  cachedUseCase = new EnqueueGameEventUseCase({
    queuePublisher: new SqsGameIngestionQueuePublisherAdapter(),
    platformAccountResolver: new DynamoDbPlatformAccountResolver(),
    webhookSecret: process.env['WEBHOOK_SECRET'],
    logger: new ConsoleLogger({ source: 'game_ingestion' }),
  });

  return cachedUseCase;
}
