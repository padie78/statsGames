import {
  UpsertActualExecutionInputSchema,
  type ActualExecutionDto,
} from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';
import { assertValidMetricTypeIds } from './objective-evolution.util';

export class UpsertActualExecutionUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(raw: unknown): Promise<ActualExecutionDto> {
    const input = UpsertActualExecutionInputSchema.parse(raw);
    assertValidMetricTypeIds([input.metricTypeId]);

    const program = await this.repo.getProgram(input.userId, input.programId);
    if (!program) {
      throw new Error('Programa no encontrado.');
    }

    const execution: ActualExecutionDto = {
      programId: input.programId,
      userId: input.userId,
      metricTypeId: input.metricTypeId,
      periodId: input.periodId,
      actualValue: input.actualValue,
      recordedAt: new Date().toISOString(),
      source: input.source ?? 'manual',
      notes: input.notes,
    };

    await this.repo.upsertExecution(execution);
    return execution;
  }
}
