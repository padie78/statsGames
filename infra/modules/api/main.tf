data "aws_region" "current" {}

locals {
  api_datasource_name = "api"
}

resource "aws_appsync_graphql_api" "this" {
  name                = var.graphql_api_name
  authentication_type = "API_KEY"
  schema              = file("${path.module}/schema.graphql")

  additional_authentication_provider {
    authentication_type = "AMAZON_COGNITO_USER_POOLS"
    user_pool_config {
      user_pool_id = var.cognito_user_pool_id
      aws_region   = data.aws_region.current.name
    }
  }

  log_config {
    cloudwatch_logs_role_arn = aws_iam_role.appsync_logs.arn
    field_log_level          = "ERROR"
  }

  xray_enabled = true
}

resource "aws_appsync_api_key" "this" {
  api_id  = aws_appsync_graphql_api.this.id
  expires = timeadd(timestamp(), "8760h")
  lifecycle {
    ignore_changes = [expires]
  }
}

data "aws_iam_policy_document" "appsync_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["appsync.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "appsync_invoke" {
  name               = "${var.name_prefix}-appsync-invoke"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

data "aws_iam_policy_document" "appsync_invoke_policy" {
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [var.appsync_api_arn]
  }
}

resource "aws_iam_role_policy" "appsync_invoke" {
  name   = "${var.name_prefix}-appsync-invoke"
  role   = aws_iam_role.appsync_invoke.id
  policy = data.aws_iam_policy_document.appsync_invoke_policy.json
}

resource "aws_iam_role" "appsync_logs" {
  name               = "${var.name_prefix}-appsync-logs"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

resource "aws_iam_role_policy_attachment" "appsync_logs" {
  role       = aws_iam_role.appsync_logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs"
}

resource "aws_appsync_datasource" "api" {
  api_id           = aws_appsync_graphql_api.this.id
  name             = local.api_datasource_name
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_invoke.arn

  lambda_config {
    function_arn = var.appsync_api_arn
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_appsync_datasource" "none" {
  api_id = aws_appsync_graphql_api.this.id
  name   = "none"
  type   = "NONE"
}

locals {
  direct_lambda_request_template  = <<-EOT
    {
      "version": "2018-05-29",
      "operation": "Invoke",
      "payload": $util.toJson($context)
    }
  EOT
  direct_lambda_response_template = <<-EOT
    #if($context.error)
      $util.error($context.error.message, $context.error.type)
    #end
    $util.toJson($context.result)
  EOT
}

resource "terraform_data" "appsync_datasources_ready" {
  depends_on = [aws_appsync_datasource.api]
}

# ─────────── NONE resolvers (health + subscription trigger) ───────────

resource "aws_appsync_resolver" "health" {
  api_id      = aws_appsync_graphql_api.this.id
  type        = "Query"
  field       = "health"
  data_source = aws_appsync_datasource.none.name

  request_template  = <<-VTPL
    {
      "version": "2018-05-29",
      "payload": {}
    }
  VTPL
  response_template = <<-VTPL
    $util.toJson("ok")
  VTPL
}

resource "aws_appsync_resolver" "publish_match_update" {
  api_id      = aws_appsync_graphql_api.this.id
  type        = "Mutation"
  field       = "publishMatchUpdate"
  data_source = aws_appsync_datasource.none.name

  request_template  = <<-VTPL
    {
      "version": "2018-05-29",
      "payload": $util.toJson($ctx.args.input)
    }
  VTPL
  response_template = <<-VTPL
    $util.toJson($ctx.result)
  VTPL
}

# ─────────── API Lambda resolvers ───────────

resource "aws_appsync_resolver" "get_player_profile" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "getPlayerProfile"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "get_profile_by_gamer_tag" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "getProfileByGamerTag"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "search_players" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "searchPlayers"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "list_player_matches" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listPlayerMatches"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "list_player_stats_rollups" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listPlayerStatsRollups"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "list_player_daily_trend" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listPlayerDailyTrend"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "get_community_benchmarks" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "getCommunityBenchmarks"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "list_weekly_leaderboard" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listWeeklyLeaderboard"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "upsert_player_profile" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "upsertPlayerProfile"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "link_platform_account" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "linkPlatformAccount"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "ping" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "ping"
  data_source       = aws_appsync_datasource.api.name
  depends_on        = [terraform_data.appsync_datasources_ready]
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}
