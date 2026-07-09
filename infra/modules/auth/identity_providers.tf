resource "aws_cognito_identity_provider" "google" {
  count = var.enable_google_idp ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "openid email profile"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
    picture  = "picture"
  }
}

resource "aws_cognito_identity_provider" "apple" {
  count = var.enable_apple_idp ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "SignInWithApple"
  provider_type = "SignInWithApple"

  provider_details = {
    authorize_scopes = "email name"
    client_id        = var.apple_client_id
    team_id          = var.apple_team_id
    key_id           = var.apple_key_id
    private_key      = var.apple_private_key
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "name"
  }
}

resource "aws_cognito_identity_provider" "discord" {
  count = var.enable_discord_idp ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.this.id
  provider_name = "Discord"
  provider_type = "OIDC"

  provider_details = {
    client_id                 = var.discord_client_id
    client_secret             = var.discord_client_secret
    authorize_scopes          = "identify email"
    attributes_request_method = "GET"
    oidc_issuer               = "https://discord.com/api/oauth2"
    authorize_url             = "https://discord.com/api/oauth2/authorize"
    token_url                 = "https://discord.com/api/oauth2/token"
    attributes_url            = "https://discord.com/api/users/@me"
    jwks_uri                  = "https://discord.com/api/oauth2/jwks"
  }

  attribute_mapping = {
    email    = "email"
    username = "sub"
    name     = "username"
    picture  = "picture"
  }
}
