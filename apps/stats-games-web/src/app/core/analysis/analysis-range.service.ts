import { Injectable, computed, signal } from '@angular/core';
import {
  ANALYSIS_RANGE_OPTIONS,
  getAnalysisRangeMeta,
  isAnalysisRangeId,
  todayPeriodId,
  type AnalysisRangeId,
  type AnalysisRangeMeta,
} from './analysis-range';

const STORAGE_KEY = 'sg.analysisRange';
const DAY_STORAGE_KEY = 'sg.analysisDay';

@Injectable({ providedIn: 'root' })
export class AnalysisRangeService {
  private readonly rangeSignal = signal<AnalysisRangeId>(readStoredRange());
  private readonly daySignal = signal<string>(readStoredDay());

  readonly range = this.rangeSignal.asReadonly();
  readonly selectedDayIso = this.daySignal.asReadonly();

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
    if (id === 'day' && !this.daySignal()) {
      this.setDay(todayPeriodId());
    }
  }

  setDay(dayIso: string): void {
    const normalized = normalizeDayIso(dayIso);
    if (!normalized || this.daySignal() === normalized) return;
    this.daySignal.set(normalized);
    try {
      localStorage.setItem(DAY_STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
    if (this.rangeSignal() !== 'day') {
      this.setRange('day');
    }
  }
}

function normalizeDayIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  const today = todayPeriodId();
  if (value.trim() > today) return today;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function readStoredRange(): AnalysisRangeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Migración: "7d" era rolling y confundía con la semana ISO.
    if (raw === '7d') return 'week';
    if (isAnalysisRangeId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'week';
}

function readStoredDay(): string {
  try {
    const raw = localStorage.getItem(DAY_STORAGE_KEY);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return todayPeriodId();
}
