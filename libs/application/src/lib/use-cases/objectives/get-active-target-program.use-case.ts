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
        // Si quedó archivado por el upsert viejo (1 solo activo), reactivar al leer.
        if (pointed.status !== 'active') {
          const now = new Date().toISOString();
          const revived = { ...pointed, status: 'active' as const, updatedAt: now };
          await this.repo.saveProgram(revived);
          await this.repo.setActivePointer(userId, revived.programId);
          const targets = await this.repo.listTargets(userId, revived.programId);
          return { ...revived, targets };
        }
        const targets = await this.repo.listTargets(userId, pointedId);
        return { ...pointed, targets };
      }
    }

    const programs = (await this.repo.listPrograms(userId)).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const fallback =
      programs.find((p) => p.status === 'active') ?? programs[0] ?? null;
    if (!fallback) return null;

    const now = new Date().toISOString();
    const revived =
      fallback.status === 'active'
        ? fallback
        : { ...fallback, status: 'active' as const, updatedAt: now };
    if (revived !== fallback) {
      await this.repo.saveProgram(revived);
    }
    await this.repo.setActivePointer(userId, revived.programId);
    const targets = await this.repo.listTargets(userId, revived.programId);
    return { ...revived, targets };
  }
}
