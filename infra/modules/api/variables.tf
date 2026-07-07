variable "name_prefix" {
  type = string
}

variable "graphql_api_name" {
  type        = string
  description = "Nombre visible de la API GraphQL en la consola AppSync."
}

variable "cognito_user_pool_id" {
  type        = string
  description = "Cognito User Pool usado como auth provider adicional de AppSync."
}

variable "appsync_api_arn" {
  type        = string
  description = "ARN de la Lambda api que resuelve queries/mutations GraphQL."
}
