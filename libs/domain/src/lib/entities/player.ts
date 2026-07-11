import type { GamePlatform } from '../value-objects/platform';

export interface PlayerProfileProps {
  userId: string;
  gamerTag: string;
  primaryPlatform: GamePlatform;
  fortniteId?: string;
  robloxId?: string;
  valorantId?: string;
  rocketLeagueId?: string;
  avatarUrl?: string;
  createdAtIso: string;
  updatedAtIso: string;
  versionId: number;
}

export class PlayerProfile {
  private constructor(private readonly props: PlayerProfileProps) {}

  static create(input: {
    userId: string;
    gamerTag: string;
    primaryPlatform: GamePlatform;
    fortniteId?: string;
    robloxId?: string;
    valorantId?: string;
    rocketLeagueId?: string;
    avatarUrl?: string;
    nowIso?: string;
  }): PlayerProfile {
    const now = input.nowIso ?? new Date().toISOString();
    return new PlayerProfile({
      userId: input.userId,
      gamerTag: input.gamerTag,
      primaryPlatform: input.primaryPlatform,
      fortniteId: input.fortniteId,
      robloxId: input.robloxId,
      valorantId: input.valorantId,
      rocketLeagueId: input.rocketLeagueId,
      avatarUrl: input.avatarUrl,
      createdAtIso: now,
      updatedAtIso: now,
      versionId: 1,
    });
  }

  static reconstitute(props: PlayerProfileProps): PlayerProfile {
    return new PlayerProfile(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get gamerTag(): string {
    return this.props.gamerTag;
  }

  get primaryPlatform(): GamePlatform {
    return this.props.primaryPlatform;
  }

  get fortniteId(): string | undefined {
    return this.props.fortniteId;
  }

  get robloxId(): string | undefined {
    return this.props.robloxId;
  }

  get valorantId(): string | undefined {
    return this.props.valorantId;
  }

  get rocketLeagueId(): string | undefined {
    return this.props.rocketLeagueId;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get createdAtIso(): string {
    return this.props.createdAtIso;
  }

  get updatedAtIso(): string {
    return this.props.updatedAtIso;
  }

  get versionId(): number {
    return this.props.versionId;
  }

  update(input: {
    gamerTag?: string;
    primaryPlatform?: GamePlatform;
    fortniteId?: string;
    robloxId?: string;
    valorantId?: string;
    rocketLeagueId?: string;
    avatarUrl?: string;
    nowIso?: string;
  }): PlayerProfile {
    return new PlayerProfile({
      ...this.props,
      gamerTag: input.gamerTag ?? this.props.gamerTag,
      primaryPlatform: input.primaryPlatform ?? this.props.primaryPlatform,
      fortniteId: input.fortniteId ?? this.props.fortniteId,
      robloxId: input.robloxId ?? this.props.robloxId,
      valorantId: input.valorantId ?? this.props.valorantId,
      rocketLeagueId: input.rocketLeagueId ?? this.props.rocketLeagueId,
      avatarUrl: input.avatarUrl ?? this.props.avatarUrl,
      updatedAtIso: input.nowIso ?? new Date().toISOString(),
      versionId: this.props.versionId + 1,
    });
  }

  linkPlatform(platform: GamePlatform, externalId: string): PlayerProfile {
    switch (platform) {
      case 'fortnite':
        return this.update({ fortniteId: externalId, primaryPlatform: platform });
      case 'roblox':
        return this.update({ robloxId: externalId, primaryPlatform: platform });
      case 'valorant':
        return this.update({ valorantId: externalId, primaryPlatform: platform });
      case 'rocket_league':
        return this.update({ rocketLeagueId: externalId, primaryPlatform: platform });
      default: {
        const _exhaustive: never = platform;
        return _exhaustive;
      }
    }
  }
}
