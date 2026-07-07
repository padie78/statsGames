variable "project_name" {
  type        = string
  description = "Nombre del proyecto (prefijo de recursos)."
  default     = "stats-games"
}

variable "environment" {
  type        = string
  description = "Entorno de despliegue (dev, staging, prod)."
  default     = "dev"
}

variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "appsync_graphql_api_name" {
  type        = string
  default     = "api"
  description = "Nombre visible de la API GraphQL en la consola AppSync (independiente del prefijo de recursos)."
}

variable "webhook_secret" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Secreto compartido para validar webhooks de Fortnite/Roblox."
}

variable "tags" {
  type        = map(string)
  description = "Tags adicionales propagados a todos los recursos."
  default     = {}
}
