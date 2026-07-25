/**
 * Deriva valores reales de objetivos a partir de telemetría de partidas.
 * Usado por auto_sync (source) cuando la métrica declara `autoSource`.
 */

export interface MatchTelemetrySlice {
  occurredAtIso: string;
  stats: Record<string, unknown>;
}

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function durationSec(stats: Record<string, unknown>): number | null {
  return (
    toNum(stats['durationSec']) ??
    toNum(stats['gameDuration']) ??
    toNum(stats['duration'])
  );
}

function isWin(stats: Record<string, unknown>): boolean | null {
  const won = stats['won'];
  if (typeof won === 'boolean') return won;
  if (won === 'true' || won === 1 || won === '1') return true;
  if (won === 'false' || won === 0 || won === '0') return false;
  const result = String(stats['result'] ?? '').toLowerCase();
  if (result === 'win' || result === 'victory') return true;
  if (result === 'loss' || result === 'defeat') return false;
  if (result === 'draw' || result === 'tie') return null;
  return null;
}

function isDraw(stats: Record<string, unknown>): boolean {
  const result = String(stats['result'] ?? '').toLowerCase();
  return result === 'draw' || result === 'tie' || stats['draw'] === true;
}

function hourUtc(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCHours();
}

function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return values.length === 1 ? 0 : null;
  const mean = avg(values)!;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function kdaOf(stats: Record<string, unknown>): number | null {
  const k = toNum(stats['kills']) ?? 0;
  const d = toNum(stats['deaths']) ?? 0;
  const a = toNum(stats['assists']) ?? 0;
  return (k + a) / Math.max(d, 1);
}

function collectStat(
  matches: MatchTelemetrySlice[],
  field: string,
  op: 'sum' | 'avg' | 'max',
): number | null {
  const values: number[] = [];
  for (const m of matches) {
    const n =
      toNum(m.stats[field]) ??
      (field === 'kills' ? toNum(m.stats['eliminations']) : null) ??
      (field === 'placement' ? toNum(m.stats['rank']) : null) ??
      (field === 'headshotPct'
        ? toNum(m.stats['headshotPercentage']) ?? toNum(m.stats['hsPct'])
        : null) ??
      (field === 'visionScore' ? toNum(m.stats['vision']) : null);
    if (n != null) values.push(n);
  }
  if (!values.length) return null;
  if (op === 'sum') return round1(values.reduce((s, v) => s + v, 0));
  if (op === 'max') return round1(Math.max(...values));
  return round2(avg(values)!);
}

function deriveWins(matches: MatchTelemetrySlice[]): number {
  return matches.filter((m) => isWin(m.stats) === true).length;
}

function deriveLosses(matches: MatchTelemetrySlice[]): number {
  return matches.filter((m) => isWin(m.stats) === false && !isDraw(m.stats)).length;
}

function deriveWinStreak(matches: MatchTelemetrySlice[]): number {
  const ordered = [...matches].sort((a, b) =>
    a.occurredAtIso.localeCompare(b.occurredAtIso),
  );
  let best = 0;
  let cur = 0;
  for (const m of ordered) {
    if (isWin(m.stats) === true) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

function deriveTiltMatches(matches: MatchTelemetrySlice[]): number {
  const ordered = [...matches].sort((a, b) =>
    a.occurredAtIso.localeCompare(b.occurredAtIso),
  );
  let lossStreak = 0;
  let tilt = 0;
  for (const m of ordered) {
    const win = isWin(m.stats);
    if (lossStreak >= 2) tilt += 1;
    if (win === false && !isDraw(m.stats)) lossStreak += 1;
    else lossStreak = 0;
  }
  return tilt;
}

function deriveBounceBackWinRate(matches: MatchTelemetrySlice[]): number | null {
  const ordered = [...matches].sort((a, b) =>
    a.occurredAtIso.localeCompare(b.occurredAtIso),
  );
  let afterLoss = 0;
  let winsAfter = 0;
  for (let i = 1; i < ordered.length; i++) {
    const prev = isWin(ordered[i - 1]!.stats);
    if (prev !== false) continue;
    afterLoss += 1;
    if (isWin(ordered[i]!.stats) === true) winsAfter += 1;
  }
  if (!afterLoss) return null;
  return round1((winsAfter / afterLoss) * 100);
}

function deriveMatchesPerDayMax(matches: MatchTelemetrySlice[]): number | null {
  const byDay = new Map<string, number>();
  for (const m of matches) {
    const key = dayKey(m.occurredAtIso);
    if (!key) continue;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  if (!byDay.size) return null;
  return Math.max(...byDay.values());
}

/**
 * Calcula el valor real de una métrica a partir de `autoSource` y partidas.
 * Retorna null si no hay datos suficientes.
 */
export function deriveObjectiveActualFromMatches(
  autoSource: string | null | undefined,
  matches: MatchTelemetrySlice[],
): number | null {
  if (!autoSource || !matches.length) return null;

  const statMatch = /^stat:([a-zA-Z0-9_]+):(sum|avg|max)$/.exec(autoSource);
  if (statMatch) {
    return collectStat(matches, statMatch[1]!, statMatch[2] as 'sum' | 'avg' | 'max');
  }

  if (!autoSource.startsWith('derived:')) return null;
  const id = autoSource.slice('derived:'.length);

  switch (id) {
    case 'wins':
      return deriveWins(matches);
    case 'losses':
      return deriveLosses(matches);
    case 'draws':
      return matches.filter((m) => isDraw(m.stats)).length;
    case 'matches_played':
      return matches.length;
    case 'win_rate': {
      const decided = matches.filter((m) => isWin(m.stats) !== null && !isDraw(m.stats));
      if (!decided.length) return null;
      return round1((deriveWins(decided) / decided.length) * 100);
    }
    case 'win_streak':
      return deriveWinStreak(matches);
    case 'kd_ratio': {
      const k = collectStat(matches, 'kills', 'sum') ?? 0;
      const d = collectStat(matches, 'deaths', 'sum') ?? 0;
      return round2(k / Math.max(d, 1));
    }
    case 'kda_ratio': {
      const k = collectStat(matches, 'kills', 'sum') ?? 0;
      const d = collectStat(matches, 'deaths', 'sum') ?? 0;
      const a = collectStat(matches, 'assists', 'sum') ?? 0;
      return round2((k + a) / Math.max(d, 1));
    }
    case 'play_hours': {
      const secs = matches
        .map((m) => durationSec(m.stats))
        .filter((n): n is number => n != null);
      if (!secs.length) return null;
      return round2(secs.reduce((s, v) => s + v, 0) / 3600);
    }
    case 'avg_match_duration_min': {
      const secs = matches
        .map((m) => durationSec(m.stats))
        .filter((n): n is number => n != null);
      if (!secs.length) return null;
      return round1(avg(secs)! / 60);
    }
    case 'max_match_duration_min': {
      const secs = matches
        .map((m) => durationSec(m.stats))
        .filter((n): n is number => n != null);
      if (!secs.length) return null;
      return round1(Math.max(...secs) / 60);
    }
    case 'matches_per_day_max':
      return deriveMatchesPerDayMax(matches);
    case 'late_night_matches':
      return matches.filter((m) => {
        const h = hourUtc(m.occurredAtIso);
        return h != null && h >= 2 && h < 6;
      }).length;
    case 'tilt_matches':
      return deriveTiltMatches(matches);
    case 'bounce_back_win_rate':
      return deriveBounceBackWinRate(matches);
    case 'kda_consistency': {
      const kdas = matches
        .map((m) => kdaOf(m.stats))
        .filter((n): n is number => n != null);
      const sd = stdDev(kdas);
      return sd == null ? null : round2(sd);
    }
    case 'remakes_ff':
      return matches.filter((m) => {
        if (m.stats['remake'] === true || m.stats['ff'] === true) return true;
        const sec = durationSec(m.stats);
        return sec != null && sec > 0 && sec < 900 && isWin(m.stats) === false;
      }).length;
    case 'mvp_count':
      return matches.filter(
        (m) => m.stats['mvp'] === true || m.stats['isMvp'] === true,
      ).length;
    case 'first_blood_pct': {
      const withFlag = matches.filter(
        (m) => m.stats['firstBlood'] != null || m.stats['firstBloodKill'] != null,
      );
      if (!withFlag.length) return null;
      const hits = withFlag.filter(
        (m) => m.stats['firstBlood'] === true || m.stats['firstBloodKill'] === true,
      ).length;
      return round1((hits / withFlag.length) * 100);
    }
    case 'first_death_pct': {
      const withFlag = matches.filter((m) => m.stats['firstDeath'] != null);
      if (!withFlag.length) return null;
      const hits = withFlag.filter((m) => m.stats['firstDeath'] === true).length;
      return round1((hits / withFlag.length) * 100);
    }
    case 'gold_per_min': {
      const rates: number[] = [];
      for (const m of matches) {
        const gold = toNum(m.stats['gold']) ?? toNum(m.stats['goldEarned']);
        const sec = durationSec(m.stats);
        if (gold == null || sec == null || sec <= 0) continue;
        rates.push(gold / (sec / 60));
      }
      return rates.length ? round1(avg(rates)!) : null;
    }
    case 'cs_per_min': {
      const rates: number[] = [];
      for (const m of matches) {
        const cs = toNum(m.stats['cs']) ?? toNum(m.stats['totalMinionsKilled']);
        const sec = durationSec(m.stats);
        if (cs == null || sec == null || sec <= 0) continue;
        rates.push(cs / (sec / 60));
      }
      return rates.length ? round2(avg(rates)!) : null;
    }
    case 'damage_per_death': {
      const ratios: number[] = [];
      for (const m of matches) {
        const dmg =
          toNum(m.stats['damage']) ??
          toNum(m.stats['totalDamageDealtToChampions']) ??
          toNum(m.stats['damageToChampions']);
        const deaths = Math.max(toNum(m.stats['deaths']) ?? 0, 1);
        if (dmg == null) continue;
        ratios.push(dmg / deaths);
      }
      return ratios.length ? round1(avg(ratios)!) : null;
    }
    case 'rank_lp_delta': {
      const deltas = matches
        .map((m) => toNum(m.stats['lpDelta']) ?? toNum(m.stats['eloDelta']))
        .filter((n): n is number => n != null);
      if (!deltas.length) return null;
      return round1(deltas.reduce((s, v) => s + v, 0));
    }
    default:
      return null;
  }
}
