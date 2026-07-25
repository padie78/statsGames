import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  ActualExecutionDto,
  ITargetProgramRepository,
  ProgramTargetDto,
  TargetProgramDto,
} from '@stats-games/application';
import { DynamoKeys, EntityType } from '@stats-games/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

type ProgramRow = Omit<TargetProgramDto, 'targets'>;

export class DynamoDbTargetProgramRepository implements ITargetProgramRepository {
  private readonly tableName: string;

  constructor(tableName = process.env['TABLE_NAME'] ?? '') {
    if (!tableName) {
      throw new Error('DynamoDbTargetProgramRepository: TABLE_NAME no configurado.');
    }
    this.tableName = tableName;
  }

  async saveProgram(program: ProgramRow): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(program.userId),
          SK: DynamoKeys.targetProgramSk(program.programId),
          entityType: EntityType.TargetProgram,
          ...program,
        },
      }),
    );
  }

  async setActivePointer(userId: string, programId: string): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.targetProgramActiveSk(),
          entityType: EntityType.TargetProgramActive,
          userId,
          programId,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }

  async clearActivePointer(userId: string): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.targetProgramActiveSk(),
        },
      }),
    );
  }

  async getActiveProgramId(userId: string): Promise<string | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.targetProgramActiveSk(),
        },
      }),
    );
    const id = result.Item?.['programId'];
    return typeof id === 'string' && id.length > 0 ? id : null;
  }

  async getProgram(userId: string, programId: string): Promise<ProgramRow | null> {
    const client = getDocumentClient();
    const result = await client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.userPk(userId),
          SK: DynamoKeys.targetProgramSk(programId),
        },
      }),
    );
    if (!result.Item) return null;
    return mapProgram(result.Item);
  }

  async listPrograms(userId: string): Promise<ProgramRow[]> {
    const client = getDocumentClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.userPk(userId),
          ':skPrefix': DynamoKeys.targetProgramSkPrefix(),
        },
      }),
    );
    return (result.Items ?? [])
      .filter((item) => item['SK'] !== DynamoKeys.targetProgramActiveSk())
      .map(mapProgram);
  }

  async replaceTargets(
    userId: string,
    programId: string,
    targets: ProgramTargetDto[],
  ): Promise<void> {
    const client = getDocumentClient();
    const existing = await this.listTargets(userId, programId);

    for (const old of existing) {
      await client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: DynamoKeys.userPk(userId),
            SK: DynamoKeys.programTargetSk(programId, old.metricTypeId, old.periodId),
          },
        }),
      );
    }

    for (const target of targets) {
      await client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: DynamoKeys.userPk(userId),
            SK: DynamoKeys.programTargetSk(
              programId,
              target.metricTypeId,
              target.periodId,
            ),
            entityType: EntityType.ProgramTarget,
            userId,
            ...target,
          },
        }),
      );
    }
  }

  async listTargets(userId: string, programId: string): Promise<ProgramTargetDto[]> {
    const client = getDocumentClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.userPk(userId),
          ':skPrefix': DynamoKeys.programTargetSkPrefix(programId),
        },
      }),
    );
    return (result.Items ?? []).map(mapTarget);
  }

  async upsertExecution(execution: ActualExecutionDto): Promise<void> {
    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: DynamoKeys.userPk(execution.userId),
          SK: DynamoKeys.actualExecutionSk(
            execution.programId,
            execution.metricTypeId,
            execution.periodId,
          ),
          entityType: EntityType.ActualExecution,
          ...execution,
        },
      }),
    );
  }

  async listExecutions(userId: string, programId: string): Promise<ActualExecutionDto[]> {
    const client = getDocumentClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.userPk(userId),
          ':skPrefix': DynamoKeys.actualExecutionSkPrefix(programId),
        },
      }),
    );
    return (result.Items ?? []).map(mapExecution);
  }
}

function mapProgram(item: Record<string, unknown>): ProgramRow {
  return {
    programId: String(item['programId']),
    userId: String(item['userId']),
    title: String(item['title'] ?? ''),
    cadence: item['cadence'] as ProgramRow['cadence'],
    status: item['status'] as ProgramRow['status'],
    platform: item['platform'] ? String(item['platform']) : undefined,
    startsAt: String(item['startsAt'] ?? ''),
    endsAt: item['endsAt'] ? String(item['endsAt']) : undefined,
    createdAt: String(item['createdAt'] ?? ''),
    updatedAt: String(item['updatedAt'] ?? ''),
  };
}

function mapTarget(item: Record<string, unknown>): ProgramTargetDto {
  return {
    programId: String(item['programId']),
    metricTypeId: String(item['metricTypeId']),
    periodId: String(item['periodId']),
    plannedValue: Number(item['plannedValue'] ?? 0),
    notes: item['notes'] ? String(item['notes']) : undefined,
    createdAt: String(item['createdAt'] ?? ''),
  };
}

function mapExecution(item: Record<string, unknown>): ActualExecutionDto {
  return {
    programId: String(item['programId']),
    userId: String(item['userId']),
    metricTypeId: String(item['metricTypeId']),
    periodId: String(item['periodId']),
    actualValue: Number(item['actualValue'] ?? 0),
    recordedAt: String(item['recordedAt'] ?? ''),
    source: (item['source'] as ActualExecutionDto['source']) ?? 'manual',
    notes: item['notes'] ? String(item['notes']) : undefined,
  };
}
