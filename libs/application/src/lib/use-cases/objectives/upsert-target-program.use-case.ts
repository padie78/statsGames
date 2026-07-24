import {
  UpsertTargetProgramInputSchema,
  type TargetProgramDto,
} from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';
import { assertValidMetricTypeIds } from './objective-evolution.util';

function newProgramId(): string {
  return `prog-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class UpsertTargetProgramUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(raw: unknown): Promise<TargetProgramDto> {
    const input = UpsertTargetProgramInputSchema.parse(raw);
    assertValidMetricTypeIds(input.targets.map((t) => t.metricTypeId));

    const now = new Date().toISOString();
    const programId = input.programId?.trim() || newProgramId();

    const existing = await this.repo.getProgram(input.userId, programId);
    const program = {
      programId,
      userId: input.userId,
      title: input.title.trim(),
      cadence: input.cadence,
      status: input.status,
      platform: input.platform,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.repo.saveProgram(program);

    if (input.status === 'active') {
      await this.repo.setActivePointer(input.userId, programId);
    }

    const targets = input.targets.map((t) => ({
      programId,
      metricTypeId: t.metricTypeId,
      periodId: t.periodId,
      plannedValue: t.plannedValue,
      notes: t.notes,
      createdAt: now,
    }));

    await this.repo.replaceTargets(input.userId, programId, targets);

    return { ...program, targets };
  }
}
