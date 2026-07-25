import {
  CloseTargetProgramInputSchema,
  type TargetProgramDto,
} from '../../dto/objectives/objectives.dto';
import type { ITargetProgramRepository } from '../../ports/objectives/target-program.repository.port';

export class CloseTargetProgramUseCase {
  constructor(private readonly repo: ITargetProgramRepository) {}

  async execute(raw: unknown): Promise<TargetProgramDto> {
    const input = CloseTargetProgramInputSchema.parse(raw);
    const program = await this.repo.getProgram(input.userId, input.programId);
    if (!program) {
      throw new Error('Programa no encontrado.');
    }

    const now = new Date().toISOString();
    const endsAt = input.endsAt?.trim() || now.slice(0, 10);
    const closed = {
      ...program,
      status: 'archived' as const,
      endsAt,
      updatedAt: now,
    };

    await this.repo.saveProgram(closed);

    const activeId = await this.repo.getActiveProgramId(input.userId);
    if (activeId === input.programId) {
      const others = (await this.repo.listPrograms(input.userId)).filter(
        (p) => p.status === 'active' && p.programId !== input.programId,
      );
      if (others.length) {
        const next = [...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        await this.repo.setActivePointer(input.userId, next.programId);
      } else {
        await this.repo.clearActivePointer(input.userId);
      }
    }

    const targets = await this.repo.listTargets(input.userId, input.programId);
    return { ...closed, targets };
  }
}
