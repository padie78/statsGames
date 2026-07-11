output "appsync_endpoint" {
  value = module.api.graphql_endpoint
}

output "appsync_realtime_endpoint" {
  value = module.api.realtime_endpoint
}

output "appsync_api_id" {
  description = "ID de la API GraphQL AppSync (útil para diagnóstico en consola AWS)."
  value       = module.api.api_id
}

output "appsync_graphql_api_name" {
  description = "Nombre visible de la API en consola AppSync."
  value       = module.api.graphql_api_name
}

output "appsync_api_key" {
  value     = module.api.api_key
  sensitive = true
}

output "profiles_bucket" {
  value = module.storage.profiles_bucket_name
}

output "data_lake_bucket" {
  value = module.storage.data_lake_bucket_name
}

output "table_name" {
  description = "Tabla operativa single-table ({prefix}-core)."
  value       = module.database.table_name
}

output "core_table_name" {
  value = module.database.core_table_name
}

output "cognito_user_pool_id" {
  value = module.auth.user_pool_id
}

output "cognito_web_client_id" {
  value = module.auth.web_client_id
}

output "cognito_domain" {
  value = module.auth.cognito_domain
}

output "cognito_hosted_ui_base_url" {
  value = module.auth.cognito_hosted_ui_base_url
}

output "post_confirmation_name" {
  value = module.auth.post_confirmation_name
}

output "glue_database_name" {
  value = module.analytics.glue_database_name
}

output "athena_workgroup_name" {
  description = "Workgroup Athena para consultas analíticas sobre el Data Lake."
  value       = module.analytics.athena_workgroup_name
}

output "game_ingestion_queue_url" {
  value = module.queues.game_ingestion_queue_url
}

output "game_ingestion_queue_arn" {
  value = module.queues.game_ingestion_queue_arn
}

output "game_ingestion_name" {
  value = module.lambdas.game_ingestion_name
}

output "fortnite_stats_poller_name" {
  value = module.lambdas.fortnite_stats_poller_name
}

output "valorant_match_poller_name" {
  value = module.lambdas.valorant_match_poller_name
}

output "rocket_league_match_poller_name" {
  value = module.lambdas.rocket_league_match_poller_name
}

output "roblox_experience_poller_name" {
  value = module.lambdas.roblox_experience_poller_name
}

output "game_processor_name" {
  value = module.lambdas.game_processor_name
}

output "appsync_api_name" {
  value = module.lambdas.appsync_api_name
}

output "webhook_api_endpoint" {
  value = module.lambdas.webhook_api_endpoint
}

output "webhook_url_pattern" {
  value = module.lambdas.webhook_url_pattern
}

output "media_proxy_name" {
  value = module.lambdas.media_proxy_name
}

output "media_proxy_base_url" {
  value = module.lambdas.media_proxy_base_url
}

output "frontend_bucket" {
  value = module.frontend_hosting.bucket_name
}

output "frontend_cloudfront_id" {
  value = module.frontend_hosting.distribution_id
}

output "frontend_url" {
  value = "https://${module.frontend_hosting.distribution_domain}"
}
