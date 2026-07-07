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

module "auth" {
  source      = "./modules/auth"
  name_prefix = local.name_prefix
}

module "queues" {
  source      = "./modules/queues"
  name_prefix = local.name_prefix
  tags        = local.event_tags
}

module "lambdas" {
  source      = "./modules/lambdas"
  name_prefix = local.name_prefix

  table_name               = module.database.table_name
  table_arn                = module.database.table_arn
  game_ingestion_queue_url = module.queues.game_ingestion_queue_url
  game_ingestion_queue_arn = module.queues.game_ingestion_queue_arn
  game_ingestion_dlq_arn   = module.queues.dlq_arns["game_ingestion"]
  webhook_secret           = var.webhook_secret
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
