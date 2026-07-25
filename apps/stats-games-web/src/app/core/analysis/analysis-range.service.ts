import { Injectable, computed, signal } from '@angular/core';
import {
  ANALYSIS_RANGE_OPTIONS,
  getAnalysisRangeMeta,
  isAnalysisRangeId,
  type AnalysisRangeId,
  type AnalysisRangeMeta,
} from './analysis-range';

const STORAGE_KEY = 'sg.analysisRange';

@Injectable({ providedIn: 'root' })
export class AnalysisRangeService {
  private readonly rangeSignal = signal<AnalysisRangeId>(readStoredRange());

  readonly range = this.rangeSignal.asReadonly();

  readonly meta = computed((): AnalysisRangeMeta => getAnalysisRangeMeta(this.rangeSignal()));

  readonly options = ANALYSIS_RANGE_OPTIONS;

  setRange(id: AnalysisRangeId): void {
    if (this.rangeSignal() === id) return;
    this.rangeSignal.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
  }
}

function readStoredRange(): AnalysisRangeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isAnalysisRangeId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'week';
}
