# Capa analítica: Glue Catalog + Athena sobre el Data Lake Parquet de partidas.

resource "aws_glue_catalog_database" "analytics" {
  name        = replace("${var.name_prefix}_analytics_lake", "-", "_")
  description = "Catálogo Glue para consultas Athena sobre histórico de partidas en Parquet."
}

locals {
  data_lake_s3_root = "s3://${var.data_lake_bucket_name}/"
  # Alineado con libs/common platforms catalog (Fase 1 + 2).
  platforms = [
    "valorant",
    "league_of_legends",
    "cs2",
    "dota2",
    "overwatch2",
    "rocket_league",
    "fortnite",
    "clash_royale",
    "brawl_stars",
    "roblox",
  ]
}

resource "aws_glue_catalog_table" "match_history" {
  for_each = toset(local.platforms)

  database_name = aws_glue_catalog_database.analytics.name
  name          = "match_history_${each.key}"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    EXTERNAL       = "TRUE"
    classification = "json"
  }

  storage_descriptor {
    location      = "${local.data_lake_s3_root}platform=${each.key}/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      name                  = "JsonSerDe"
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "user_id"
      type = "string"
    }
    columns {
      name = "match_id"
      type = "string"
    }
    columns {
      name = "played_at_iso"
      type = "string"
    }
    columns {
      name = "stats_json"
      type = "string"
    }
  }

  partition_keys {
    name = "anho"
    type = "string"
  }

  partition_keys {
    name = "mes"
    type = "string"
  }
}

resource "aws_athena_workgroup" "analytics" {
  name = "${var.name_prefix}-gaming-analytics"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "${local.data_lake_s3_root}athena-results/"
    }
  }

  tags = {
    Purpose = "GamingAnalytics"
  }
}

resource "aws_glue_crawler" "data_lake" {
  name          = "${var.name_prefix}-data-lake-crawler"
  database_name = aws_glue_catalog_database.analytics.name
  role          = aws_iam_role.glue_crawler.arn

  # Solo prefixes de partidas; excluye athena-results/ para no crear tablas espurias.
  s3_target {
    path = "${local.data_lake_s3_root}platform="
    exclusions = [
      "athena-results/**",
    ]
  }

  s3_target {
    path = "${local.data_lake_s3_root}bronze/matches/"
    exclusions = [
      "athena-results/**",
    ]
  }

  schema_change_policy {
    delete_behavior = "LOG"
    update_behavior = "UPDATE_IN_DATABASE"
  }

  configuration = jsonencode({
    Version = 1.0
    CrawlerOutput = {
      Partitions = { AddOrUpdateBehavior = "InheritFromTable" }
    }
    Grouping = {
      TableGroupingPolicy = "CombineCompatibleSchemas"
    }
  })

  schedule = "cron(0 3 * * ? *)"
}

resource "aws_glue_catalog_table" "bronze_matches" {
  database_name = aws_glue_catalog_database.analytics.name
  name          = "bronze_matches"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    EXTERNAL       = "TRUE"
    classification = "json"
  }

  storage_descriptor {
    location      = "${local.data_lake_s3_root}bronze/matches/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      name                  = "JsonSerDe"
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "user_id"
      type = "string"
    }
    columns {
      name = "match_id"
      type = "string"
    }
    columns {
      name = "platform"
      type = "string"
    }
    columns {
      name = "correlation_id"
      type = "string"
    }
    columns {
      name = "occurred_at_iso"
      type = "string"
    }
    columns {
      name = "payload_json"
      type = "string"
    }
  }

  partition_keys {
    name = "date"
    type = "string"
  }
}

resource "aws_iam_role" "glue_crawler" {
  name = "${var.name_prefix}-glue-crawler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "glue.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue_crawler.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_iam_role_policy" "glue_s3" {
  name = "${var.name_prefix}-glue-s3-read"
  role = aws_iam_role.glue_crawler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:ListBucket",
      ]
      Resource = [
        var.data_lake_bucket_arn,
        "${var.data_lake_bucket_arn}/*",
      ]
    }]
  })
}
