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

variable "riot_rso_client_id" {
  type        = string
  default     = ""
  description = "Client ID Riot Sign-On (RSO). Requiere app de producción aprobada."
}

variable "riot_rso_client_secret" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Client secret Riot Sign-On (solo Lambda; no va al frontend)."
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

variable "dota2_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key alternativa para Dota 2; si está vacía se usa steam_web_api_key."
}

variable "dota2_poll_schedule" {
  type    = string
  default = "rate(5 minutes)"
}

variable "overwatch2_api_url" {
  type        = string
  default     = ""
  description = "Base URL de API partner/bridge para Overwatch 2."
}

variable "overwatch2_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token opcional para OVERWATCH2_API_URL."
}

variable "overwatch2_poll_schedule" {
  type    = string
  default = "rate(5 minutes)"
}

variable "supercell_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token Supercell para Clash Royale y Brawl Stars."
}

variable "clash_royale_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Token específico Clash Royale; si está vacío se usa supercell_api_key."
}

variable "clash_royale_poll_schedule" {
  type    = string
  default = "rate(5 minutes)"
}

variable "brawl_stars_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Token específico Brawl Stars; si está vacío se usa supercell_api_key."
}

variable "brawl_stars_poll_schedule" {
  type    = string
  default = "rate(5 minutes)"
}

variable "tags" {
  type        = map(string)
  description = "Tags adicionales propagados a todos los recursos."
  default     = {}
}
