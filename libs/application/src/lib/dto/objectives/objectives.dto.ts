import { z } from 'zod';

export const ObjectiveCadenceSchema = z.enum(['weekly', 'monthly']);
export type ObjectiveCadence = z.infer<typeof ObjectiveCadenceSchema>;

export const ObjectiveProgramStatusSchema = z.enum(['draft', 'active', 'archived']);
export type ObjectiveProgramStatus = z.infer<typeof ObjectiveProgramStatusSchema>;

export const ObjectiveAlignmentSchema = z.enum(['aligned', 'above', 'critical']);
export type ObjectiveAlignment = z.infer<typeof ObjectiveAlignmentSchema>;

/** ISO week `2026-W30` o mes `2026-07`. */
export const PeriodIdSchema = z
  .string()
  .regex(/^(\d{4}-W\d{2}|\d{4}-(0[1-9]|1[0-2]))$/, 'periodId inválido (use 2026-W30 o 2026-07)');

export const ProgramTargetDtoSchema = z.object({
  programId: z.string().min(1),
  metricTypeId: z.string().min(1),
  periodId: PeriodIdSchema,
  plannedValue: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
  createdAt: z.string().min(1),
});
export type ProgramTargetDto = z.infer<typeof ProgramTargetDtoSchema>;

export const ActualExecutionDtoSchema = z.object({
  programId: z.string().min(1),
  userId: z.string().min(1),
  metricTypeId: z.string().min(1),
  periodId: PeriodIdSchema,
  actualValue: z.number().nonnegative(),
  recordedAt: z.string().min(1),
  source: z.enum(['manual', 'auto_sync']).default('manual'),
  notes: z.string().max(500).optional(),
});
export type ActualExecutionDto = z.infer<typeof ActualExecutionDtoSchema>;

export const TargetProgramDtoSchema = z.object({
  programId: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1).max(120),
  cadence: ObjectiveCadenceSchema,
  status: ObjectiveProgramStatusSchema,
  platform: z.string().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  targets: z.array(ProgramTargetDtoSchema).default([]),
});
export type TargetProgramDto = z.infer<typeof TargetProgramDtoSchema>;

export const UpsertTargetProgramInputSchema = z.object({
  userId: z.string().min(1),
  programId: z.string().min(1).optional(),
  title: z.string().min(1).max(120),
  cadence: ObjectiveCadenceSchema,
  status: ObjectiveProgramStatusSchema.default('active'),
  platform: z.string().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  targets: z
    .array(
      z.object({
        metricTypeId: z.string().min(1),
        periodId: PeriodIdSchema,
        plannedValue: z.number().nonnegative(),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1),
});
export type UpsertTargetProgramInput = z.infer<typeof UpsertTargetProgramInputSchema>;

export const UpsertActualExecutionInputSchema = z.object({
  userId: z.string().min(1),
  programId: z.string().min(1),
  metricTypeId: z.string().min(1),
  periodId: PeriodIdSchema,
  actualValue: z.number().nonnegative(),
  source: z.enum(['manual', 'auto_sync']).optional(),
  notes: z.string().max(500).optional(),
});
export type UpsertActualExecutionInput = z.infer<typeof UpsertActualExecutionInputSchema>;

export const ObjectiveEvolutionRowDtoSchema = z.object({
  metricTypeId: z.string(),
  metricLabel: z.string(),
  unit: z.string(),
  periodId: z.string(),
  plannedValue: z.number(),
  actualValue: z.number().nullable(),
  compliancePct: z.number().nullable(),
  deviationPct: z.number().nullable(),
  status: ObjectiveAlignmentSchema,
  statusLabel: z.string(),
});
export type ObjectiveEvolutionRowDto = z.infer<typeof ObjectiveEvolutionRowDtoSchema>;

export const ObjectiveEvolutionDtoSchema = z.object({
  programId: z.string(),
  userId: z.string(),
  title: z.string(),
  cadence: ObjectiveCadenceSchema,
  globalCompliancePct: z.number().nullable(),
  alignedCount: z.number().int().nonnegative(),
  aboveCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  rows: z.array(ObjectiveEvolutionRowDtoSchema),
  byMetric: z.array(
    z.object({
      metricTypeId: z.string(),
      metricLabel: z.string(),
      unit: z.string(),
      plannedTotal: z.number(),
      actualTotal: z.number(),
      compliancePct: z.number().nullable(),
      status: ObjectiveAlignmentSchema,
      statusLabel: z.string(),
    }),
  ),
});
export type ObjectiveEvolutionDto = z.infer<typeof ObjectiveEvolutionDtoSchema>;
