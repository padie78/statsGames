import { OBJECTIVE_METRIC_TYPES } from '@stats-games/common';

export class ListObjectiveMetricTypesUseCase {
  execute(): Array<{
    id: string;
    label: string;
    unit: string;
    description: string;
    higherIsBetter: boolean;
    domain: string;
  }> {
    return OBJECTIVE_METRIC_TYPES.map((m) => ({ ...m }));
  }
}
