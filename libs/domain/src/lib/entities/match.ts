import type { GamePlatform } from '../value-objects/platform';
import { MatchStats } from '../value-objects/match-stats';

export interface MatchProps {
  userId: string;
  matchId: string;
  platform: GamePlatform;
  stats: MatchStats;
  occurredAtIso: string;
  correlationId: string;
  versionId: number;
}

export class Match {
  private constructor(private readonly props: MatchProps) {}

  static create(input: {
    userId: string;
    matchId: string;
    platform: GamePlatform;
    stats?: Record<string, unknown>;
    occurredAtIso: string;
    correlationId: string;
  }): Match {
    return new Match({
      userId: input.userId,
      matchId: input.matchId,
      platform: input.platform,
      stats: MatchStats.fromRecord(input.stats ?? {}),
      occurredAtIso: input.occurredAtIso,
      correlationId: input.correlationId,
      versionId: 1,
    });
  }

  static reconstitute(props: MatchProps): Match {
    return new Match(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get matchId(): string {
    return this.props.matchId;
  }

  get platform(): GamePlatform {
    return this.props.platform;
  }

  get stats(): MatchStats {
    return this.props.stats;
  }

  get occurredAtIso(): string {
    return this.props.occurredAtIso;
  }

  get correlationId(): string {
    return this.props.correlationId;
  }

  get versionId(): number {
    return this.props.versionId;
  }

  summary(): string {
    const record = this.props.stats.toRecord();
    const custom = typeof record['summary'] === 'string' ? record['summary'].trim() : '';
    if (custom) return custom;

    const experience =
      (typeof record['experienceName'] === 'string' && record['experienceName'].trim()) ||
      (typeof record['placeName'] === 'string' && record['placeName'].trim()) ||
      '';
    const mode = typeof record['mode'] === 'string' ? record['mode'].trim() : '';
    const map = typeof record['map'] === 'string' ? record['map'].trim() : '';
    const kills = Number(record['kills'] ?? record['eliminations'] ?? NaN);
    const placement = Number(record['placement'] ?? record['rank'] ?? NaN);
    const durationSec = Number(record['durationSec'] ?? NaN);

    const bits: string[] = [
      experience || (this.props.platform === 'fortnite' ? 'Fortnite' : 'Roblox'),
    ];
    if (mode && mode !== experience) bits.push(mode);
    if (map) bits.push(map);
    if (Number.isFinite(placement) && placement > 0) bits.push(`Top ${Math.trunc(placement)}`);
    if (Number.isFinite(kills) && kills >= 0) bits.push(`${Math.trunc(kills)} kills`);
    if (Number.isFinite(durationSec) && durationSec > 0) {
      const mins = Math.floor(durationSec / 60);
      const secs = Math.trunc(durationSec) % 60;
      bits.push(mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`);
    }

    if (bits.length > 1) return bits.join(' · ');
    return `${this.props.platform} match ${this.props.matchId} processed`;
  }
}
