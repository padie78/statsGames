# Terraform crea las funciones con un handler bootstrap mínimo. El código real
# se publica después desde `.github/workflows/deploy-lambdas.yml`, que compila
# cada Lambda y ejecuta `aws lambda update-function-code`.
data "archive_file" "bootstrap" {
  type        = "zip"
  output_path = "${path.module}/.artifacts/bootstrap.zip"

  source {
    filename = "index.js"
    content  = <<-EOT
      exports.handler = async () => ({
        statusCode: 503,
        body: JSON.stringify({
          message: "Lambda bootstrap deployed. Real code is published by deploy-lambdas workflow."
        })
      });
    EOT
  }
}

# ─────────── AppSync API Lambda (GraphQL resolvers) ───────────

resource "aws_lambda_function" "appsync_api" {
  function_name    = "${var.name_prefix}-appsync-api"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 15
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME = var.table_name
      LOG_LEVEL  = "INFO"
    }
  }
}

# ─────────── Webhook HTTP → SQS (Route A: ingesta de juegos) ───────────

resource "aws_lambda_function" "game_ingestion" {
  function_name    = "${var.name_prefix}-game-ingestion"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 15
  memory_size      = 256
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME               = var.table_name
      GAME_INGESTION_QUEUE_URL = var.game_ingestion_queue_url
      WEBHOOK_SECRET           = var.webhook_secret
      LOG_LEVEL                = "INFO"
    }
  }
}

resource "aws_apigatewayv2_api" "webhooks" {
  name          = "${var.name_prefix}-webhooks"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type", "x-webhook-secret"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 3600
  }

  tags = {
    Layer = "event-network"
  }
}

resource "aws_apigatewayv2_integration" "game_ingestion" {
  api_id                 = aws_apigatewayv2_api.webhooks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.game_ingestion.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "game_webhook" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "POST /webhooks/{platform}"
  target    = "integrations/${aws_apigatewayv2_integration.game_ingestion.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.webhooks.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_game_ingestion" {
  statement_id  = "AllowAPIGatewayInvokeGameIngestion"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.game_ingestion.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhooks.execution_arn}/*/*"
}

# ─────────── Media proxy (Fortnite shop/cosmetics → CORS-safe GET) ───────────

resource "aws_lambda_function" "media_proxy" {
  function_name    = "${var.name_prefix}-media-proxy"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 20
  memory_size      = 256
  architectures    = ["arm64"]

  environment {
    variables = {
      LOG_LEVEL = "INFO"
    }
  }
}

resource "aws_apigatewayv2_integration" "media_proxy" {
  api_id                 = aws_apigatewayv2_api.webhooks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.media_proxy.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "media_fortnite_shop" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "GET /media/fortnite/shop"
  target    = "integrations/${aws_apigatewayv2_integration.media_proxy.id}"
}

resource "aws_apigatewayv2_route" "media_fortnite_cosmetic" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "GET /media/fortnite/cosmetics/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.media_proxy.id}"
}

resource "aws_apigatewayv2_route" "media_fortnite_news" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "GET /media/fortnite/news"
  target    = "integrations/${aws_apigatewayv2_integration.media_proxy.id}"
}

resource "aws_apigatewayv2_route" "media_fortnite_map" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "GET /media/fortnite/map"
  target    = "integrations/${aws_apigatewayv2_integration.media_proxy.id}"
}

resource "aws_lambda_permission" "apigw_media_proxy" {
  statement_id  = "AllowAPIGatewayInvokeMediaProxy"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.media_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhooks.execution_arn}/*/*"
}

# ─────────── SQS → DynamoDB + AppSync (procesador de partidas) ───────────

resource "aws_lambda_function" "game_processor" {
  function_name    = "${var.name_prefix}-game-processor"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 60
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME       = var.table_name
      APPSYNC_ENDPOINT = "https://placeholder-will-be-patched"
      APPSYNC_API_KEY  = "placeholder-will-be-patched"
      LOG_LEVEL        = "INFO"
    }
  }
}

resource "aws_lambda_event_source_mapping" "game_processor" {
  event_source_arn                   = var.game_ingestion_queue_arn
  function_name                      = aws_lambda_function.game_processor.arn
  batch_size                         = 5
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]
}

# ─────────── Fortnite Route B: poll stats → SQS (sin webhook de Epic) ───────────

resource "aws_lambda_function" "fortnite_stats_poller" {
  function_name    = "${var.name_prefix}-fortnite-stats-poller"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 120
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME               = var.table_name
      GAME_INGESTION_QUEUE_URL = var.game_ingestion_queue_url
      FORTNITE_API_KEY         = var.fortnite_api_key
      LOG_LEVEL                = "INFO"
    }
  }
}

resource "aws_cloudwatch_event_rule" "fortnite_stats_poller" {
  name                = "${var.name_prefix}-fortnite-stats-poller"
  description         = "Poll Fortnite career stats to infer new matches"
  schedule_expression = var.fortnite_poll_schedule
  state               = var.fortnite_api_key != "" ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "fortnite_stats_poller" {
  rule      = aws_cloudwatch_event_rule.fortnite_stats_poller.name
  target_id = "fortnite-stats-poller"
  arn       = aws_lambda_function.fortnite_stats_poller.arn
}

resource "aws_lambda_permission" "fortnite_stats_poller_events" {
  statement_id  = "AllowEventBridgeInvokeFortniteStatsPoller"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fortnite_stats_poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.fortnite_stats_poller.arn
}

# ─────────── Valorant Route A: Riot matchlist → SQS ───────────

resource "aws_lambda_function" "valorant_match_poller" {
  function_name    = "${var.name_prefix}-valorant-match-poller"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 120
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME               = var.table_name
      GAME_INGESTION_QUEUE_URL = var.game_ingestion_queue_url
      RIOT_API_KEY             = var.riot_api_key
      VALORANT_REGION          = var.valorant_region
      VALORANT_SHARD           = var.valorant_shard
      LOG_LEVEL                = "INFO"
    }
  }
}

resource "aws_cloudwatch_event_rule" "valorant_match_poller" {
  name                = "${var.name_prefix}-valorant-match-poller"
  description         = "Poll Valorant match history via Riot API"
  schedule_expression = var.valorant_poll_schedule
  state               = var.riot_api_key != "" ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "valorant_match_poller" {
  rule      = aws_cloudwatch_event_rule.valorant_match_poller.name
  target_id = "valorant-match-poller"
  arn       = aws_lambda_function.valorant_match_poller.arn
}

resource "aws_lambda_permission" "valorant_match_poller_events" {
  statement_id  = "AllowEventBridgeInvokeValorantMatchPoller"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.valorant_match_poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.valorant_match_poller.arn
}

# ─────────── Rocket League: ballchasing replays → SQS (opcional) ───────────

resource "aws_lambda_function" "rocket_league_match_poller" {
  function_name    = "${var.name_prefix}-rocket-league-match-poller"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 120
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME               = var.table_name
      GAME_INGESTION_QUEUE_URL = var.game_ingestion_queue_url
      BALLCHASING_API_KEY      = var.ballchasing_api_key
      LOG_LEVEL                = "INFO"
    }
  }
}

resource "aws_cloudwatch_event_rule" "rocket_league_match_poller" {
  name                = "${var.name_prefix}-rocket-league-match-poller"
  description         = "Poll Rocket League replays via ballchasing.com"
  schedule_expression = var.rocket_league_poll_schedule
  state               = var.ballchasing_api_key != "" ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "rocket_league_match_poller" {
  rule      = aws_cloudwatch_event_rule.rocket_league_match_poller.name
  target_id = "rocket-league-match-poller"
  arn       = aws_lambda_function.rocket_league_match_poller.arn
}

resource "aws_lambda_permission" "rocket_league_match_poller_events" {
  statement_id  = "AllowEventBridgeInvokeRocketLeagueMatchPoller"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rocket_league_match_poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rocket_league_match_poller.arn
}

# ─────────── Roblox BedWars + Arsenal: badge milestones → SQS ───────────

resource "aws_lambda_function" "roblox_experience_poller" {
  function_name    = "${var.name_prefix}-roblox-experience-poller"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 120
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      TABLE_NAME               = var.table_name
      GAME_INGESTION_QUEUE_URL = var.game_ingestion_queue_url
      LOG_LEVEL                = "INFO"
    }
  }
}

resource "aws_cloudwatch_event_rule" "roblox_experience_poller" {
  name                = "${var.name_prefix}-roblox-experience-poller"
  description         = "Poll Roblox BedWars + Arsenal badge milestones"
  schedule_expression = var.roblox_experience_poll_schedule
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "roblox_experience_poller" {
  rule      = aws_cloudwatch_event_rule.roblox_experience_poller.name
  target_id = "roblox-experience-poller"
  arn       = aws_lambda_function.roblox_experience_poller.arn
}

resource "aws_lambda_permission" "roblox_experience_poller_events" {
  statement_id  = "AllowEventBridgeInvokeRobloxExperiencePoller"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.roblox_experience_poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.roblox_experience_poller.arn
}
