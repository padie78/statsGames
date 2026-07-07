export interface MatchStatsProps {
  readonly values: Readonly<Record<string, unknown>>;
}

export class MatchStats {
  private constructor(private readonly props: MatchStatsProps) {}

  static fromRecord(values: Record<string, unknown> = {}): MatchStats {
    return new MatchStats({ values: { ...values } });
  }

  toRecord(): Record<string, unknown> {
    return { ...this.props.values };
  }

  toJson(): string {
    return JSON.stringify(this.props.values);
  }
}
