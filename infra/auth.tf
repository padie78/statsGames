# =============================================================================
# Cognito OAuth / Federated Identity — configuración de capa auth
# Variables y locals consumidos por module.auth en main.tf
# =============================================================================

variable "cognito_domain_prefix" {
  type        = string
  description = "Prefijo del dominio Hosted UI de Cognito ({prefix}.auth.{region}.amazoncognito.com)."
  default     = ""
}

variable "cognito_oauth_callback_urls" {
  type        = list(string)
  description = "URLs de redirección OAuth tras login federado (además de localhost dev)."
  default     = []
}

variable "cognito_oauth_logout_urls" {
  type        = list(string)
  description = "URLs de redirección tras logout federado."
  default     = []
}

variable "enable_google_idp" {
  type        = bool
  description = "Habilita Google como Identity Provider en Cognito."
  default     = false
}

variable "google_client_id" {
  type        = string
  description = "Google OAuth Client ID."
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  type        = string
  description = "Google OAuth Client Secret."
  default     = ""
  sensitive   = true
}

variable "enable_apple_idp" {
  type        = bool
  description = "Habilita Sign in with Apple."
  default     = false
}

variable "apple_client_id" {
  type        = string
  description = "Apple Services ID (client_id)."
  default     = ""
  sensitive   = true
}

variable "apple_team_id" {
  type        = string
  description = "Apple Team ID."
  default     = ""
  sensitive   = true
}

variable "apple_key_id" {
  type        = string
  description = "Apple Sign in Key ID."
  default     = ""
  sensitive   = true
}

variable "apple_private_key" {
  type        = string
  description = "Apple Sign in private key (.p8 contents)."
  default     = ""
  sensitive   = true
}

variable "enable_discord_idp" {
  type        = bool
  description = "Habilita Discord vía OIDC personalizado."
  default     = false
}

variable "discord_client_id" {
  type        = string
  description = "Discord Application Client ID."
  default     = ""
  sensitive   = true
}

variable "discord_client_secret" {
  type        = string
  description = "Discord Application Client Secret."
  default     = ""
  sensitive   = true
}

locals {
  cognito_domain_prefix = var.cognito_domain_prefix != "" ? var.cognito_domain_prefix : local.name_prefix

  cognito_oauth_callback_urls = distinct(concat(
    var.cognito_oauth_callback_urls,
    [
      "http://localhost:4200/auth/callback",
      "https://${module.frontend_hosting.distribution_domain}/auth/callback",
    ],
  ))

  cognito_oauth_logout_urls = distinct(concat(
    var.cognito_oauth_logout_urls,
    [
      "http://localhost:4200/login",
      "https://${module.frontend_hosting.distribution_domain}/login",
    ],
  ))
}
