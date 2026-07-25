-- =============================================================================
-- Planificación vs Realidad — modelo relacional de referencia
-- En producción StatsGames se materializa en DynamoDB single-table (ver mapping).
-- =============================================================================

CREATE TABLE players (
  user_id       UUID PRIMARY KEY,
  gamer_tag     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE metric_types (
  metric_type_id   TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  unit             TEXT NOT NULL,             -- km, kg, h, %, min, ms, n, x, σ
  description      TEXT,
  higher_is_better BOOLEAN NOT NULL DEFAULT TRUE, -- legacy; preferir goal_kind
  goal_kind        TEXT NOT NULL DEFAULT 'at_least'
                   CHECK (goal_kind IN ('at_least', 'at_most')),
  aggregation      TEXT NOT NULL DEFAULT 'sum'
                   CHECK (aggregation IN ('sum', 'avg', 'max', 'last')),
  domain           TEXT NOT NULL
                   CHECK (domain IN (
                     'athlete', 'competitive', 'discipline',
                     'mental', 'economy', 'technical', 'career'
                   )),
  auto_source      TEXT                          -- stat:<f>:<op> | derived:<id> | NULL
);

CREATE TABLE target_programs (
  program_id    UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  cadence       TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  status        TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  platform      TEXT,                        -- opcional: juego activo (league_of_legends, …)
  starts_at     DATE NOT NULL,
  ends_at       DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_target_programs_one_active
  ON target_programs (user_id)
  WHERE status = 'active';

CREATE INDEX idx_target_programs_user ON target_programs (user_id, status);

CREATE TABLE program_targets (
  target_id       UUID PRIMARY KEY,
  program_id      UUID NOT NULL REFERENCES target_programs(program_id) ON DELETE CASCADE,
  metric_type_id  TEXT NOT NULL REFERENCES metric_types(metric_type_id),
  period_id       TEXT NOT NULL,             -- ISO week 2026-W30 | month 2026-07
  planned_value   NUMERIC(12, 3) NOT NULL CHECK (planned_value >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, metric_type_id, period_id)
);

CREATE INDEX idx_program_targets_period ON program_targets (program_id, period_id);

CREATE TABLE actual_executions (
  execution_id    UUID PRIMARY KEY,
  program_id      UUID NOT NULL REFERENCES target_programs(program_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  metric_type_id  TEXT NOT NULL REFERENCES metric_types(metric_type_id),
  period_id       TEXT NOT NULL,
  actual_value    NUMERIC(12, 3) NOT NULL CHECK (actual_value >= 0),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT NOT NULL DEFAULT 'manual', -- manual | auto_sync
  notes           TEXT,
  UNIQUE (program_id, metric_type_id, period_id)
);

CREATE INDEX idx_actual_executions_user_period
  ON actual_executions (user_id, period_id);

-- Cumplimiento:
--   at_least → actual / planned * 100
--   at_most  → planned / actual * 100  (0 actual = overachieve)
-- Rollup byMetric usa aggregation (sum|avg|max|last), no sumar ratios a ciegas.

-- Seed: el catálogo canónico vive en libs/common/.../metric-types.ts
-- (~60 métricas en 7 dominios). Este SQL es referencia, no la fuente de verdad.

-- =============================================================================
-- Mapping DynamoDB single-table (PK = USER#<userId>)
--   SK = TARGET_PROGRAM#<programId>
--   SK = TARGET_PROGRAM#ACTIVE                 → puntero al programa activo
--   SK = PROGRAM_TARGET#<programId>#<metric>#<periodId>
--   SK = ACTUAL_EXEC#<programId>#<metric>#<periodId>
-- Unicidad por período = clave SK (equivalente a UNIQUE SQL).
-- =============================================================================
