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
    allow_headers = ["content-type"]
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
