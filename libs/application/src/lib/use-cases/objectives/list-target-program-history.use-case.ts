import type { TargetProgramHistoryItemDto } from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';
import {
  buildObjectiveEvolution,
  classifyProgramOutcome,
} from './objective-evolution.util';

export class ListTargetProgramHistoryUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(input: {
    userId: string;
    limit?: number;
  }): Promise<TargetProgramHistoryItemDto[]> {
    if (!input.userId?.trim()) throw new Error('userId requerido.');

    const userId = input.userId.trim();
    const limit = Math.min(50, Math.max(1, input.limit ?? 20));
    const [programs, activeId] = await Promise.all([
      this.repo.listPrograms(userId),
      this.repo.getActiveProgramId(userId),
    ]);

    const sorted = [...programs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const slice = sorted.slice(0, limit);

    const items: TargetProgramHistoryItemDto[] = [];
    for (const program of slice) {
      const [targets, executions] = await Promise.all([
        this.repo.listTargets(userId, program.programId),
        this.repo.listExecutions(userId, program.programId),
      ]);
      const evolution = buildObjectiveEvolution({ program, targets, executions });
      const { outcome, outcomeLabel } = classifyProgramOutcome({
        status: program.status,
        globalCompliancePct: evolution.globalCompliancePct,
      });

      items.push({
        programId: program.programId,
        userId: program.userId,
        title: program.title,
        cadence: program.cadence,
        status: program.status,
        platform: program.platform,
        startsAt: program.startsAt,
        endsAt: program.endsAt,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        targetCount: targets.length,
        executionCount: executions.length,
        globalCompliancePct: evolution.globalCompliancePct,
        outcome,
        outcomeLabel,
        isActive: activeId === program.programId && program.status === 'active',
      });
    }

    return items;
  }
}
