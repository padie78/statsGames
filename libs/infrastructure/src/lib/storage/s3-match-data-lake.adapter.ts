import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { IMatchDataLakeWriter } from '@stats-games/application';
import type { Match } from '@stats-games/domain';

/**
 * Dual-write de partidas al Data Lake (JSON Hive) para Athena.
 * Keys:
 *   platform={platform}/anho={YYYY}/mes={MM}/{matchId}.json
 *   bronze/matches/date={YYYY-MM-DD}/{matchId}.json
 */
export class S3MatchDataLakeAdapter implements IMatchDataLakeWriter {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(
    bucket = process.env['DATA_LAKE_BUCKET'] ?? '',
    client?: S3Client,
  ) {
    this.bucket = bucket.trim();
    this.client = client ?? new S3Client({});
  }

  async write(match: Match): Promise<void> {
    if (!this.bucket) {
      return;
    }

    const playedAt = parseUtc(match.occurredAtIso);
    const anho = String(playedAt.getUTCFullYear()).padStart(4, '0');
    const mes = String(playedAt.getUTCMonth() + 1).padStart(2, '0');
    const date = match.occurredAtIso.slice(0, 10);
    const statsJson = match.stats.toJson();

    const historyBody = JSON.stringify({
      user_id: match.userId,
      match_id: match.matchId,
      played_at_iso: match.occurredAtIso,
      stats_json: statsJson,
    });

    const bronzeBody = JSON.stringify({
      user_id: match.userId,
      match_id: match.matchId,
      platform: match.platform,
      correlation_id: match.correlationId,
      occurred_at_iso: match.occurredAtIso,
      payload_json: statsJson,
    });

    // Prefijo userId: evita colisiones cuando varios jugadores comparten matchId.
    const objectName = `${match.userId}__${match.matchId}.json`;
    const historyKey = `platform=${match.platform}/anho=${anho}/mes=${mes}/${objectName}`;
    const bronzeKey = `bronze/matches/date=${date}/${objectName}`;

    await Promise.all([
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: historyKey,
          Body: historyBody,
          ContentType: 'application/json',
        }),
      ),
      this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: bronzeKey,
          Body: bronzeBody,
          ContentType: 'application/json',
        }),
      ),
    ]);
  }
}

function parseUtc(iso: string): Date {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return new Date();
  }
  return dt;
}
