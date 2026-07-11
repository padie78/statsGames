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
