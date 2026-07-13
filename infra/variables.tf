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

variable "fortnite_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key de fortnite-api.com (poller Fortnite Route B)."
}

variable "riot_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key Riot Games (poller Valorant)."
}

variable "valorant_region" {
  type    = string
  default = "americas"
}

variable "valorant_shard" {
  type    = string
  default = "na"
}

variable "ballchasing_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key ballchasing.com (poller Rocket League)."
}

variable "lol_region" {
  type    = string
  default = "europe"
}

variable "steam_web_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Steam Web API key (poller CS2)."
}

variable "tags" {
  type        = map(string)
  description = "Tags adicionales propagados a todos los recursos."
  default     = {}
}
