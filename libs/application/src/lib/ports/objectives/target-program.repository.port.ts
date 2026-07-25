import type {
  ActualExecutionDto,
  ProgramTargetDto,
  TargetProgramDto,
} from '../../dto/objectives/objectives.dto';

export interface ITargetProgramRepository {
  saveProgram(program: Omit<TargetProgramDto, 'targets'>): Promise<void>;
  setActivePointer(userId: string, programId: string): Promise<void>;
  clearActivePointer(userId: string): Promise<void>;
  getActiveProgramId(userId: string): Promise<string | null>;
  getProgram(userId: string, programId: string): Promise<Omit<TargetProgramDto, 'targets'> | null>;
  listPrograms(userId: string): Promise<Array<Omit<TargetProgramDto, 'targets'>>>;
  replaceTargets(userId: string, programId: string, targets: ProgramTargetDto[]): Promise<void>;
  listTargets(userId: string, programId: string): Promise<ProgramTargetDto[]>;
  upsertExecution(execution: ActualExecutionDto): Promise<void>;
  listExecutions(userId: string, programId: string): Promise<ActualExecutionDto[]>;
}
