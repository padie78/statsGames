import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type {
  GameIngestionWorkMessage,
  IGameIngestionQueuePublisher,
} from '@stats-games/domain';

export interface SqsGameIngestionQueueConfig {
  queueUrl?: string;
  client?: SQSClient;
}

export class SqsGameIngestionQueuePublisherAdapter implements IGameIngestionQueuePublisher {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(config: SqsGameIngestionQueueConfig = {}) {
    this.client = config.client ?? new SQSClient({});
    this.queueUrl = config.queueUrl ?? process.env['GAME_INGESTION_QUEUE_URL'] ?? '';
    if (!this.queueUrl) {
      throw new Error('SqsGameIngestionQueuePublisherAdapter: GAME_INGESTION_QUEUE_URL no configurado.');
    }
  }

  async enqueue(message: GameIngestionWorkMessage): Promise<void> {
    if (!message.userId?.trim() || !message.matchId?.trim()) {
      throw new Error('enqueue: userId y matchId son obligatorios.');
    }

    const isFifo = this.queueUrl.endsWith('.fifo');

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          platform: { DataType: 'String', StringValue: message.platform },
          userId: { DataType: 'String', StringValue: message.userId },
        },
        ...(isFifo
          ? {
              MessageGroupId: message.userId,
              MessageDeduplicationId: `${message.matchId}#${message.occurredAtIso}`,
            }
          : {}),
      }),
    );
  }
}
