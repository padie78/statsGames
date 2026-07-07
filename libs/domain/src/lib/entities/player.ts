import type { GamePlatform } from '../value-objects/platform';

export interface PlayerProfileProps {
  userId: string;
  gamerTag: string;
  primaryPlatform: GamePlatform;
  fortniteId?: string;
  robloxId?: string;
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
    avatarUrl?: string;
    nowIso?: string;
  }): PlayerProfile {
    return new PlayerProfile({
      ...this.props,
      gamerTag: input.gamerTag ?? this.props.gamerTag,
      primaryPlatform: input.primaryPlatform ?? this.props.primaryPlatform,
      fortniteId: input.fortniteId ?? this.props.fortniteId,
      robloxId: input.robloxId ?? this.props.robloxId,
      avatarUrl: input.avatarUrl ?? this.props.avatarUrl,
      updatedAtIso: input.nowIso ?? new Date().toISOString(),
      versionId: this.props.versionId + 1,
    });
  }

  linkPlatform(platform: GamePlatform, externalId: string): PlayerProfile {
    if (platform === 'fortnite') {
      return this.update({ fortniteId: externalId, primaryPlatform: platform });
    }
    return this.update({ robloxId: externalId, primaryPlatform: platform });
  }
}
