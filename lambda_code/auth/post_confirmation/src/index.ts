import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { PostConfirmationTriggerHandler } from 'aws-lambda';

const TABLE_NAME = process.env['TABLE_NAME'] ?? '';

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const KEY_PREFIX = {
  user: 'USER#',
  profile: 'PROFILE',
} as const;

function userPk(userId: string): string {
  return `${KEY_PREFIX.user}${userId}`;
}

function profileSk(): string {
  return KEY_PREFIX.profile;
}

function deriveGamerTag(attrs: Record<string, string>): string {
  const preferred =
    attrs['preferred_username'] ||
    attrs['name'] ||
    attrs['nickname'] ||
    attrs['email']?.split('@')[0];

  if (!preferred) return 'Player';
  return preferred.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'Player';
}

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (!TABLE_NAME) {
    throw new Error('TABLE_NAME no configurado.');
  }

  const attrs = event.request.userAttributes;
  const userId = attrs['sub'];
  if (!userId) {
    console.warn('PostConfirmation sin sub; se omite bootstrap de perfil.');
    return event;
  }

  const existing = await doc.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userPk(userId), SK: profileSk() },
    }),
  );

  if (existing.Item) {
    console.info('Perfil ya existe; idempotente.', { userId });
    return event;
  }

  const now = new Date().toISOString();
  const email = attrs['email'] ?? '';
  const gamerTag = deriveGamerTag(attrs);

  await doc.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: userPk(userId),
        SK: profileSk(),
        entityType: 'PLAYER',
        userId,
        email,
        gamerTag,
        primaryPlatform: 'roblox',
        avatarUrl: attrs['picture'] ?? null,
        telemetryStatus: 'PENDING_ONBOARDING',
        createdAtIso: now,
        updatedAtIso: now,
        versionId: 1,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );

  console.info('Perfil bootstrap creado', { userId, telemetryStatus: 'PENDING_ONBOARDING' });
  return event;
};
