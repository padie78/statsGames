/**
 * Módulo Planificación vs Realidad — mapa de entregables.
 *
 * ## Capas
 * | Capa | Path |
 * |---|---|
 * | DDL SQL de referencia | `docs/objectives-plan-vs-reality.sql` |
 * | Catálogo métricas | `libs/common/src/lib/objectives/metric-types.ts` |
 * | DynamoKeys | `libs/common/src/lib/dynamodb/keys.ts` (`TARGET_PROGRAM#…`) |
 * | DTOs / Zod | `libs/application/src/lib/dto/objectives/` |
 * | Ports | `libs/application/src/lib/ports/objectives/` |
 * | Use cases + % cumplimiento | `libs/application/src/lib/use-cases/objectives/` |
 * | DynamoDB adapter | `libs/infrastructure/.../dynamodb-target-program.repository.ts` |
 * | GraphQL | `infra/modules/api/schema.graphql` |
 * | Resolvers TF | `infra/modules/api/main.tf` |
 * | API Lambda | `lambda_code/api/api/src/` |
 * | Angular service | `apps/stats-games-web/src/app/services/objectives.service.ts` |
 * | UI 3 tabs | `.../ui/molecules/objectives-plan-panel/` |
 * | Página / nav | `/tabs/objectives` — menú jugador **Objetivos** |
 * | Historial | `listTargetProgramHistory` + tab Historial (En curso / Cumplido / No cumplido) |
 *
 * ## GraphQL (equiv. REST)
 * - `listObjectiveMetricTypes`
 * - `getActiveTargetProgram(userId)`
 * - `listTargetProgramHistory(userId, limit)`
 * - `upsertTargetProgram(input)`
 * - `closeTargetProgram(input)` — archiva y deja outcome histórico
 * - `upsertActualExecution(input)`
 * - `getObjectiveEvolution(userId, programId?)`  ← endpoint Evolución
 *
 * ## Cumplimiento
 * `% = (Real / Meta) × 100`
 * - Alineado: 90–115%
 * - Por encima: >115%
 * - Crítico: <90% o sin dato
 *
 * ## Outcome de programa (historial)
 * - En curso: `status = active|draft`
 * - Cumplido: cerrado (`archived`) y cumplimiento global ≥ 90%
 * - No cumplido: cerrado y < 90% o sin ejecución
 *
 * ## Deploy
 * 1. `terraform apply` (schema + resolvers AppSync)
 * 2. Redeploy Lambda `api`
 */

export {};
