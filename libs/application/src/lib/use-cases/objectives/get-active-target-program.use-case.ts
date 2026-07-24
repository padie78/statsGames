import type { TargetProgramDto } from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';

export class GetActiveTargetProgramUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(input: { userId: string }): Promise<TargetProgramDto | null> {
    if (!input.userId?.trim()) throw new Error('userId requerido.');

    const programId = await this.repo.getActiveProgramId(input.userId.trim());
    if (!programId) return null;

    const program = await this.repo.getProgram(input.userId.trim(), programId);
    if (!program) return null;

    const targets = await this.repo.listTargets(input.userId.trim(), programId);
    return { ...program, targets };
  }
}
