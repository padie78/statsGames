variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "table_name" {
  type        = string
  description = "DynamoDB core table for post-confirmation profile bootstrap."
}

variable "table_arn" {
  type = string
}

variable "domain_prefix" {
  type = string
}

variable "oauth_callback_urls" {
  type = list(string)
}

variable "oauth_logout_urls" {
  type = list(string)
}

variable "enable_google_idp" {
  type    = bool
  default = false
}

variable "google_client_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "enable_apple_idp" {
  type    = bool
  default = false
}

variable "apple_client_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "apple_team_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "apple_key_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "apple_private_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "enable_discord_idp" {
  type    = bool
  default = false
}

variable "discord_client_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "discord_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}
