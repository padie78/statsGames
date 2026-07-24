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
    id: 'accuracy_pct',
    label: 'Porcentaje de acierto',
    unit: '%',
    description: 'Precisión en drills / aiming',
    higherIsBetter: true,
    domain: 'athlete',
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
    id: 'kills_avg',
    label: 'Kills promedio',
    unit: 'n',
    description: 'Eliminaciones por partida',
    higherIsBetter: true,
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
] as const;

export function getObjectiveMetricType(id: string): ObjectiveMetricType | undefined {
  return OBJECTIVE_METRIC_TYPES.find((m) => m.id === id);
}

export function isObjectiveMetricTypeId(id: string): boolean {
  return OBJECTIVE_METRIC_TYPES.some((m) => m.id === id);
}
