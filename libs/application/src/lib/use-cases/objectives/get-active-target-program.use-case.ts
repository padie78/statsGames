import type { TargetProgramDto } from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';

export class GetActiveTargetProgramUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(input: { userId: string }): Promise<TargetProgramDto | null> {
    if (!input.userId?.trim()) throw new Error('userId requerido.');

    const userId = input.userId.trim();
    const pointedId = await this.repo.getActiveProgramId(userId);

    if (pointedId) {
      const pointed = await this.repo.getProgram(userId, pointedId);
      if (pointed) {
        const targets = await this.repo.listTargets(userId, pointedId);
        return { ...pointed, targets };
      }
    }

    // Fallback: puntero perdido o huérfano → recuperar el activo más reciente.
    const actives = (await this.repo.listPrograms(userId))
      .filter((p) => p.status === 'active')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const fallback = actives[0];
    if (!fallback) return null;

    await this.repo.setActivePointer(userId, fallback.programId);
    const targets = await this.repo.listTargets(userId, fallback.programId);
    return { ...fallback, targets };
  }
}
