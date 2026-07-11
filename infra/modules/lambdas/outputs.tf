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

output "media_proxy_name" {
  value = aws_lambda_function.media_proxy.function_name
}

output "media_proxy_base_url" {
  description = "Base HTTP API para GET /media/fortnite/* (mismo execute-api que webhooks)."
  value       = aws_apigatewayv2_api.webhooks.api_endpoint
}

output "fortnite_stats_poller_name" {
  value = aws_lambda_function.fortnite_stats_poller.function_name
}

output "valorant_match_poller_name" {
  value = aws_lambda_function.valorant_match_poller.function_name
}

output "rocket_league_match_poller_name" {
  value = aws_lambda_function.rocket_league_match_poller.function_name
}

output "roblox_experience_poller_name" {
  value = aws_lambda_function.roblox_experience_poller.function_name
}
