/**
 * Catálogo de métricas para Plan vs Realidad (atleta + jugador competitivo).
 */

export interface ObjectiveMetricType {
  id: string;
  label: string;
  unit: string;
  description: string;
  higherIsBetter: boolean;
  /** Ámbito sugerido en UI. */
  domain: 'athlete' | 'competitive';
}

export const OBJECTIVE_METRIC_TYPES: readonly ObjectiveMetricType[] = [
  // ── Atleta / hábitos ──
  {
    id: 'kilometers',
    label: 'Kilómetros recorridos',
    unit: 'km',
    description: 'Volumen de desplazamiento / cardio',
    higherIsBetter: true,
    domain: 'athlete',
  },
  {
    id: 'weight_lifted',
    label: 'Peso levantado',
    unit: 'kg',
    description: 'Carga acumulada en fuerza',
    higherIsBetter: true,
    domain: 'athlete',
  },
  {
    id: 'training_hours',
    label: 'Horas de entrenamiento',
    unit: 'h',
    description: 'Tiempo efectivo de práctica',
    higherIsBetter: true,
    domain: 'athlete',
  },
  {
    id: 'sessions_count',
    label: 'Sesiones de práctica',
    unit: 'n',
    description: 'Cantidad de sesiones en el período',
    higherIsBetter: true,
    domain: 'athlete',
  },
  {
    id: 'accuracy_pct',
    label: 'Porcentaje de acierto',
    unit: '%',
    description: 'Precisión en drills / aiming',
    higherIsBetter: true,
    domain: 'athlete',
  },
  // ── Competitivo / partidas ──
  {
    id: 'wins',
    label: 'Victorias',
    unit: 'n',
    description: 'Partidas ganadas en el período',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'losses',
    label: 'Derrotas',
    unit: 'n',
    description: 'Partidas perdidas (meta = tope máximo)',
    higherIsBetter: false,
    domain: 'competitive',
  },
  {
    id: 'draws',
    label: 'Empates',
    unit: 'n',
    description: 'Partidas empatadas',
    higherIsBetter: false,
    domain: 'competitive',
  },
  {
    id: 'matches_played',
    label: 'Partidas jugadas',
    unit: 'n',
    description: 'Volumen total de matches',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'win_rate',
    label: 'Win rate',
    unit: '%',
    description: 'Ratio de victorias',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'win_streak',
    label: 'Racha de victorias',
    unit: 'n',
    description: 'Mejor racha consecutiva del período',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'kills',
    label: 'Kills totales',
    unit: 'n',
    description: 'Eliminaciones acumuladas',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'deaths',
    label: 'Muertes totales',
    unit: 'n',
    description: 'Muertes acumuladas (meta = tope máximo)',
    higherIsBetter: false,
    domain: 'competitive',
  },
  {
    id: 'assists',
    label: 'Asistencias totales',
    unit: 'n',
    description: 'Asistencias acumuladas',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'kills_avg',
    label: 'Kills promedio',
    unit: 'n',
    description: 'Eliminaciones por partida',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'deaths_avg',
    label: 'Muertes promedio',
    unit: 'n',
    description: 'Muertes por partida (meta = tope máximo)',
    higherIsBetter: false,
    domain: 'competitive',
  },
  {
    id: 'assists_avg',
    label: 'Asistencias promedio',
    unit: 'n',
    description: 'Asistencias por partida',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'kd_ratio',
    label: 'K/D',
    unit: 'x',
    description: 'Ratio kills/deaths',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'kda_ratio',
    label: 'KDA',
    unit: 'x',
    description: 'Ratio (kills+assists)/deaths',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'headshot_pct',
    label: 'Headshot %',
    unit: '%',
    description: 'Porcentaje de headshots',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'adr',
    label: 'ADR / daño por ronda',
    unit: 'n',
    description: 'Average damage per round',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'placement_avg',
    label: 'Placement promedio',
    unit: 'n',
    description: 'Posición media (más bajo = mejor)',
    higherIsBetter: false,
    domain: 'competitive',
  },
  {
    id: 'cs_avg',
    label: 'CS promedio',
    unit: 'n',
    description: 'Farm / minions',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'vision_avg',
    label: 'Visión promedio',
    unit: 'n',
    description: 'Vision score',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'goals',
    label: 'Goles',
    unit: 'n',
    description: 'Goles acumulados (Rocket League)',
    higherIsBetter: true,
    domain: 'competitive',
  },
  {
    id: 'saves',
    label: 'Saves',
    unit: 'n',
    description: 'Atajadas acumuladas',
    higherIsBetter: true,
    domain: 'competitive',
  },
] as const;

export function getObjectiveMetricType(id: string): ObjectiveMetricType | undefined {
  return OBJECTIVE_METRIC_TYPES.find((m) => m.id === id);
}

export function isObjectiveMetricTypeId(id: string): boolean {
  return OBJECTIVE_METRIC_TYPES.some((m) => m.id === id);
}
