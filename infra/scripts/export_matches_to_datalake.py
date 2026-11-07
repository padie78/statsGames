#!/usr/bin/env python3
"""Exporta partidas DynamoDB (entityType=MATCH) al Data Lake S3 (JSON Hive).

Rutas alineadas con Glue (`infra/modules/analytics/main.tf`):
  s3://{bucket}/platform={platform}/anho={YYYY}/mes={MM}/{matchId}.json
  s3://{bucket}/bronze/matches/date={YYYY-MM-DD}/{matchId}.json

Uso:
  AWS_DEFAULT_REGION=eu-central-1 \\
  python3 infra/scripts/export_matches_to_datalake.py \\
    --table stats-games-dev-core \\
    --bucket stats-games-dev-data-lake-parquet-473959757331
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import boto3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", required=True, help="Tabla DynamoDB single-table")
    parser.add_argument("--bucket", required=True, help="Bucket data lake")
    parser.add_argument("--region", default=None, help="AWS region (default: env/SDK)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo cuenta y muestra keys; no escribe en S3",
    )
    return parser.parse_args()


def scan_matches(ddb: Any, table: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    start_key = None
    while True:
        kwargs: dict[str, Any] = {
            "TableName": table,
            "FilterExpression": "entityType = :e",
            "ExpressionAttributeValues": {":e": {"S": "MATCH"}},
        }
        if start_key:
            kwargs["ExclusiveStartKey"] = start_key
        resp = ddb.scan(**kwargs)
        for raw in resp.get("Items", []):
            items.append(
                {
                    "user_id": raw.get("userId", {}).get("S", ""),
                    "match_id": raw.get("matchId", {}).get("S", ""),
                    "platform": raw.get("platform", {}).get("S", ""),
                    "played_at_iso": raw.get("occurredAtIso", {}).get("S", ""),
                    "occurred_at_iso": raw.get("occurredAtIso", {}).get("S", ""),
                    "correlation_id": raw.get("correlationId", {}).get("S", ""),
                    "stats_json": raw.get("statsJson", {}).get("S", "{}"),
                    "payload_json": raw.get("statsJson", {}).get("S", "{}"),
                }
            )
        start_key = resp.get("LastEvaluatedKey")
        if not start_key:
            break
    return items


def partition_fields(iso: str) -> tuple[str, str, str]:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        dt = datetime.now(timezone.utc)
    return f"{dt.year:04d}", f"{dt.month:02d}", dt.strftime("%Y-%m-%d")


def main() -> int:
    args = parse_args()
    session = boto3.session.Session(region_name=args.region)
    ddb = session.client("dynamodb")
    s3 = session.client("s3")

    matches = scan_matches(ddb, args.table)
    by_platform: dict[str, int] = defaultdict(int)
    for m in matches:
        by_platform[m["platform"] or "?"] += 1

    print(f"MATCH exportables: {len(matches)}")
    for platform, count in sorted(by_platform.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {platform}: {count}")

    if args.dry_run:
        for m in matches[:5]:
            anho, mes, day = partition_fields(m["played_at_iso"])
            print(
                f"  dry-run → platform={m['platform']}/anho={anho}/mes={mes}/{m['match_id']}.json"
            )
            print(f"           bronze/matches/date={day}/{m['match_id']}.json")
        return 0

    uploaded = 0
    for m in matches:
        if not m["match_id"] or not m["platform"] or not m["user_id"]:
            continue
        anho, mes, day = partition_fields(m["played_at_iso"])

        history_body = {
            "user_id": m["user_id"],
            "match_id": m["match_id"],
            "played_at_iso": m["played_at_iso"],
            "stats_json": m["stats_json"],
        }
        # user_id en el key: evita colisiones cuando varios jugadores comparten matchId (mocks).
        object_name = f"{m['user_id']}__{m['match_id']}.json"
        history_key = f"platform={m['platform']}/anho={anho}/mes={mes}/{object_name}"
        s3.put_object(
            Bucket=args.bucket,
            Key=history_key,
            Body=json.dumps(history_body, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )

        bronze_body = {
            "user_id": m["user_id"],
            "match_id": m["match_id"],
            "platform": m["platform"],
            "correlation_id": m["correlation_id"],
            "occurred_at_iso": m["occurred_at_iso"],
            "payload_json": m["payload_json"],
        }
        bronze_key = f"bronze/matches/date={day}/{object_name}"
        s3.put_object(
            Bucket=args.bucket,
            Key=bronze_key,
            Body=json.dumps(bronze_body, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
        uploaded += 1

    print(f"Subidos a s3://{args.bucket}/ → {uploaded} partidas (×2 objetos)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
