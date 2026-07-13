locals {
  name_prefix = "${var.project_name}-${var.environment}"
  event_tags = {
    Layer = "event-network"
  }
}

module "database" {
  source      = "./modules/database"
  name_prefix = local.name_prefix
}

module "storage" {
  source      = "./modules/storage"
  name_prefix = local.name_prefix
}

module "analytics" {
  source                = "./modules/analytics"
  name_prefix           = local.name_prefix
  data_lake_bucket_name = module.storage.data_lake_bucket_name
  data_lake_bucket_arn  = module.storage.data_lake_bucket_arn
}

module "queues" {
  source      = "./modules/queues"
  name_prefix = local.name_prefix
  tags        = local.event_tags
}

module "lambdas" {
  source      = "./modules/lambdas"
  name_prefix = local.name_prefix

  table_name                  = module.database.table_name
  table_arn                   = module.database.table_arn
  game_ingestion_queue_url    = module.queues.game_ingestion_queue_url
  game_ingestion_queue_arn    = module.queues.game_ingestion_queue_arn
  game_ingestion_dlq_arn      = module.queues.dlq_arns["game_ingestion"]
  match_ai_analysis_queue_url = module.queues.match_ai_analysis_queue_url
  match_ai_analysis_queue_arn = module.queues.match_ai_analysis_queue_arn
  match_ai_analysis_dlq_arn   = try(module.queues.dlq_arns["match_ai_analysis"], "")
  webhook_secret              = var.webhook_secret
  fortnite_api_key            = var.fortnite_api_key
  riot_api_key                = var.riot_api_key
  valorant_region             = var.valorant_region
  valorant_shard              = var.valorant_shard
  ballchasing_api_key         = var.ballchasing_api_key
  lol_region                  = var.lol_region
  steam_web_api_key           = var.steam_web_api_key
}

module "api" {
  source               = "./modules/api"
  name_prefix          = local.name_prefix
  graphql_api_name     = var.appsync_graphql_api_name
  cognito_user_pool_id = module.auth.user_pool_id
  appsync_api_arn      = module.lambdas.appsync_api_arn
}

module "frontend_hosting" {
  source      = "./modules/frontend_hosting"
  name_prefix = local.name_prefix
}

module "auth" {
  source      = "./modules/auth"
  name_prefix = local.name_prefix
  aws_region  = var.aws_region

  table_name = module.database.table_name
  table_arn  = module.database.table_arn

  domain_prefix       = local.cognito_domain_prefix
  oauth_callback_urls = local.cognito_oauth_callback_urls
  oauth_logout_urls   = local.cognito_oauth_logout_urls

  enable_google_idp     = var.enable_google_idp
  google_client_id      = var.google_client_id
  google_client_secret  = var.google_client_secret
  enable_apple_idp      = var.enable_apple_idp
  apple_client_id       = var.apple_client_id
  apple_team_id         = var.apple_team_id
  apple_key_id          = var.apple_key_id
  apple_private_key     = var.apple_private_key
  enable_discord_idp    = var.enable_discord_idp
  discord_client_id     = var.discord_client_id
  discord_client_secret = var.discord_client_secret
}
