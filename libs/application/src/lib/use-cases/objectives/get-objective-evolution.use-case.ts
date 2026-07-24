import type { ObjectiveEvolutionDto } from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';
import { buildObjectiveEvolution } from './objective-evolution.util';

export class GetObjectiveEvolutionUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(input: {
    userId: string;
    programId?: string;
  }): Promise<ObjectiveEvolutionDto | null> {
    if (!input.userId?.trim()) throw new Error('userId requerido.');

    const userId = input.userId.trim();
    let programId = input.programId?.trim();

    if (!programId) {
      programId = (await this.repo.getActiveProgramId(userId)) ?? undefined;
    }
    if (!programId) return null;

    const program = await this.repo.getProgram(userId, programId);
    if (!program) return null;

    const [targets, executions] = await Promise.all([
      this.repo.listTargets(userId, programId),
      this.repo.listExecutions(userId, programId),
    ]);

    return buildObjectiveEvolution({ program, targets, executions });
  }
}
