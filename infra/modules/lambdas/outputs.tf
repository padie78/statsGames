output "appsync_api_arn" {
  value = aws_lambda_function.appsync_api.arn
}

output "appsync_api_name" {
  value = aws_lambda_function.appsync_api.function_name
}

output "game_ingestion_arn" {
  value = aws_lambda_function.game_ingestion.arn
}

output "game_ingestion_name" {
  value = aws_lambda_function.game_ingestion.function_name
}

output "game_processor_arn" {
  value = aws_lambda_function.game_processor.arn
}

output "game_processor_name" {
  value = aws_lambda_function.game_processor.function_name
}

output "webhook_api_endpoint" {
  value = aws_apigatewayv2_api.webhooks.api_endpoint
}

output "webhook_url_pattern" {
  value = "${aws_apigatewayv2_api.webhooks.api_endpoint}/webhooks/{platform}"
}
