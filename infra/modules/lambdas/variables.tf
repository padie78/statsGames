variable "name_prefix" {
  type = string
}

variable "table_name" {
  type = string
}

variable "table_arn" {
  type = string
}

variable "game_ingestion_queue_url" {
  type = string
}

variable "game_ingestion_queue_arn" {
  type = string
}

variable "game_ingestion_dlq_arn" {
  type    = string
  default = ""
}

variable "match_ai_analysis_queue_url" {
  type    = string
  default = ""
}

variable "match_ai_analysis_queue_arn" {
  type    = string
  default = ""
}

variable "match_ai_analysis_dlq_arn" {
  type    = string
  default = ""
}

variable "bedrock_model_id" {
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
  description = "Bedrock model ID for post-match AI analysis."
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
  description = "API key de fortnite-api.com para el poller de stats (Route B)."
}

variable "fortnite_poll_schedule" {
  type        = string
  default     = "rate(3 minutes)"
  description = "Schedule EventBridge del poller Fortnite."
}

variable "riot_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key Riot Games (Valorant match poller)."
}

variable "valorant_region" {
  type        = string
  default     = "americas"
  description = "Routing region Riot account-v1 (americas|europe|asia)."
}

variable "valorant_shard" {
  type        = string
  default     = "na"
  description = "Shard Valorant match-v1 (na|eu|ap|kr|latam|br)."
}

variable "valorant_poll_schedule" {
  type        = string
  default     = "rate(3 minutes)"
  description = "Schedule EventBridge del poller Valorant."
}

variable "ballchasing_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key ballchasing.com (Rocket League replay poller)."
}

variable "rocket_league_poll_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "Schedule EventBridge del poller Rocket League."
}

variable "roblox_experience_poll_schedule" {
  type        = string
  default     = "rate(10 minutes)"
  description = "Schedule EventBridge del poller BedWars/Arsenal (badges)."
}

variable "lol_region" {
  type        = string
  default     = "europe"
  description = "Routing region Riot for LoL match-v5 (americas|europe|asia|sea)."
}

variable "lol_poll_schedule" {
  type        = string
  default     = "rate(3 minutes)"
  description = "Schedule EventBridge del poller League of Legends."
}

variable "steam_web_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Steam Web API key (CS2 account validation poller)."
}

variable "cs2_poll_schedule" {
  type        = string
  default     = "rate(15 minutes)"
  description = "Schedule EventBridge del poller CS2 (validación Steam)."
}

variable "dota2_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "API key alternativa para Dota 2; si está vacía se usa steam_web_api_key."
}

variable "dota2_poll_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "Schedule EventBridge del poller Dota 2."
}

variable "overwatch2_api_url" {
  type        = string
  default     = ""
  description = "Base URL partner/bridge para Overwatch 2."
}

variable "overwatch2_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token opcional para Overwatch 2."
}

variable "overwatch2_poll_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "Schedule EventBridge del poller Overwatch 2."
}

variable "supercell_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token Supercell compartido."
}

variable "clash_royale_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token Clash Royale; fallback a supercell_api_key."
}

variable "clash_royale_poll_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "Schedule EventBridge del poller Clash Royale."
}

variable "brawl_stars_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Bearer token Brawl Stars; fallback a supercell_api_key."
}

variable "brawl_stars_poll_schedule" {
  type        = string
  default     = "rate(5 minutes)"
  description = "Schedule EventBridge del poller Brawl Stars."
}
