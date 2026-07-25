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
  metric_type_id  TEXT PRIMARY KEY,          -- ej: kilometers, training_hours, accuracy_pct
  label           TEXT NOT NULL,
  unit            TEXT NOT NULL,             -- km, kg, h, %
  description     TEXT,
  higher_is_better BOOLEAN NOT NULL DEFAULT TRUE
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

-- Seed métricas atleta / jugador
INSERT INTO metric_types (metric_type_id, label, unit, description, higher_is_better) VALUES
  ('kilometers',      'Kilómetros recorridos', 'km', 'Volumen de desplazamiento / cardio', TRUE),
  ('weight_lifted',   'Peso levantado',        'kg', 'Carga acumulada en fuerza', TRUE),
  ('training_hours',  'Horas de entrenamiento','h',  'Tiempo efectivo de práctica', TRUE),
  ('sessions_count',  'Sesiones de práctica',  'n',  'Cantidad de sesiones', TRUE),
  ('accuracy_pct',    'Porcentaje de acierto', '%',  'Precisión en drills / aiming', TRUE),
  ('wins',            'Victorias',             'n',  'Partidas ganadas', TRUE),
  ('losses',          'Derrotas',              'n',  'Partidas perdidas (tope)', FALSE),
  ('draws',           'Empates',               'n',  'Partidas empatadas', FALSE),
  ('matches_played',  'Partidas jugadas',      'n',  'Volumen de matches', TRUE),
  ('win_rate',        'Win rate',              '%',  'Ratio de victorias', TRUE),
  ('win_streak',      'Racha de victorias',    'n',  'Mejor racha del período', TRUE),
  ('kills',           'Kills totales',         'n',  'Eliminaciones acumuladas', TRUE),
  ('deaths',          'Muertes totales',       'n',  'Muertes acumuladas (tope)', FALSE),
  ('assists',         'Asistencias totales',   'n',  'Asistencias acumuladas', TRUE),
  ('kills_avg',       'Kills promedio',        'n',  'Eliminaciones por partida', TRUE),
  ('deaths_avg',      'Muertes promedio',      'n',  'Muertes por partida (tope)', FALSE),
  ('assists_avg',     'Asistencias promedio',  'n',  'Asistencias por partida', TRUE),
  ('kd_ratio',        'K/D',                   'x',  'Ratio kills/deaths', TRUE),
  ('kda_ratio',       'KDA',                   'x',  'Ratio (K+A)/D', TRUE),
  ('headshot_pct',    'Headshot %',            '%',  'Porcentaje de headshots', TRUE),
  ('adr',             'ADR',                   'n',  'Daño promedio por ronda', TRUE),
  ('placement_avg',   'Placement promedio',    'n',  'Posición media (más bajo mejor)', FALSE),
  ('cs_avg',          'CS promedio',           'n',  'Farm / minions (LoL)', TRUE),
  ('vision_avg',      'Visión promedio',       'n',  'Vision score (LoL)', TRUE),
  ('goals',           'Goles',                 'n',  'Goles (Rocket League)', TRUE),
  ('saves',           'Saves',                 'n',  'Atajadas', TRUE);

-- =============================================================================
-- Mapping DynamoDB single-table (PK = USER#<userId>)
--   SK = TARGET_PROGRAM#<programId>
--   SK = TARGET_PROGRAM#ACTIVE                 → puntero al programa activo
--   SK = PROGRAM_TARGET#<programId>#<metric>#<periodId>
--   SK = ACTUAL_EXEC#<programId>#<metric>#<periodId>
-- Unicidad por período = clave SK (equivalente a UNIQUE SQL).
-- =============================================================================
