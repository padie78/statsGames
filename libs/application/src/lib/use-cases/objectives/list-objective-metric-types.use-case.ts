import { OBJECTIVE_METRIC_TYPES } from '@stats-games/common';

export class ListObjectiveMetricTypesUseCase {
  execute(): Array<{
    id: string;
    label: string;
    unit: string;
    description: string;
    higherIsBetter: boolean;
    goalKind: string;
    aggregation: string;
    domain: string;
    autoSource: string | null;
  }> {
    return OBJECTIVE_METRIC_TYPES.map((m) => ({
      id: m.id,
      label: m.label,
      unit: m.unit,
      description: m.description,
      higherIsBetter: m.higherIsBetter,
      goalKind: m.goalKind,
      aggregation: m.aggregation,
      domain: m.domain,
      autoSource: m.autoSource,
    }));
  }
}
