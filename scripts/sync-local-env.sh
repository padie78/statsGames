#!/usr/bin/env bash
# Genera apps/stats-games-web/src/environments/environment.ts desde outputs de Terraform.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"
ENV_FILE="${ROOT_DIR}/apps/stats-games-web/src/environments/environment.ts"
AWS_REGION="${AWS_REGION:-eu-central-1}"

if ! command -v terraform >/dev/null 2>&1; then
  echo "Error: terraform no está instalado." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq no está instalado." >&2
  exit 1
fi

cd "${INFRA_DIR}"

if [ ! -d .terraform ]; then
  echo "Error: ejecutá 'terraform init' en infra/ antes de sync-local-env." >&2
  exit 1
fi

OUTPUTS="$(terraform output -json 2>/dev/null || true)"
if [ -z "${OUTPUTS}" ] || [ "${OUTPUTS}" = "{}" ]; then
  echo "Error: no hay outputs de Terraform. Ejecutá 'terraform apply' en infra/." >&2
  exit 1
fi

APPSYNC_ENDPOINT="$(echo "${OUTPUTS}" | jq -r '.appsync_endpoint.value // empty')"
APPSYNC_API_KEY="$(echo "${OUTPUTS}" | jq -r '.appsync_api_key.value // empty')"
COGNITO_POOL="$(echo "${OUTPUTS}" | jq -r '.cognito_user_pool_id.value // empty')"
COGNITO_CLIENT="$(echo "${OUTPUTS}" | jq -r '.cognito_web_client_id.value // empty')"
COGNITO_DOMAIN="$(echo "${OUTPUTS}" | jq -r '.cognito_domain.value // empty')"
WEBHOOK_PATTERN="$(echo "${OUTPUTS}" | jq -r '.webhook_url_pattern.value // empty')"
MEDIA_PROXY_BASE="$(echo "${OUTPUTS}" | jq -r '.media_proxy_base_url.value // empty')"
RIOT_CLIENT_ID="$(echo "${OUTPUTS}" | jq -r '.riot_rso_client_id.value // empty')"
RIOT_EXCHANGE_URL="$(echo "${OUTPUTS}" | jq -r '.riot_rso_exchange_url.value // empty')"

if [ -z "${APPSYNC_ENDPOINT}" ] || [ -z "${APPSYNC_API_KEY}" ] || [ -z "${COGNITO_POOL}" ] || [ -z "${COGNITO_CLIENT}" ]; then
  echo "Error: faltan outputs requeridos (appsync_endpoint, appsync_api_key, cognito_user_pool_id, cognito_web_client_id)." >&2
  exit 1
fi

# Escapar comillas simples para el heredoc TypeScript.
escape_ts() {
  printf '%s' "${1:-}" | sed "s/'/\\\\'/g"
}

APPSYNC_ENDPOINT_E="$(escape_ts "${APPSYNC_ENDPOINT}")"
APPSYNC_API_KEY_E="$(escape_ts "${APPSYNC_API_KEY}")"
COGNITO_POOL_E="$(escape_ts "${COGNITO_POOL}")"
COGNITO_CLIENT_E="$(escape_ts "${COGNITO_CLIENT}")"
COGNITO_DOMAIN_E="$(escape_ts "${COGNITO_DOMAIN}")"
WEBHOOK_PATTERN_E="$(escape_ts "${WEBHOOK_PATTERN}")"
MEDIA_PROXY_BASE_E="$(escape_ts "${MEDIA_PROXY_BASE}")"
RIOT_CLIENT_ID_E="$(escape_ts "${RIOT_CLIENT_ID}")"
RIOT_EXCHANGE_URL_E="$(escape_ts "${RIOT_EXCHANGE_URL}")"

cat > "${ENV_FILE}" <<EOF
import type { AppRuntimeEnvironment } from './environment.types';

export const environment: AppRuntimeEnvironment = {
  production: false,
  appsync: {
    endpoint: '${APPSYNC_ENDPOINT_E}',
    region: '${AWS_REGION}',
    apiKey: '${APPSYNC_API_KEY_E}',
  },
  cognito: {
    userPoolId: '${COGNITO_POOL_E}',
    userPoolClientId: '${COGNITO_CLIENT_E}',
    domain: '${COGNITO_DOMAIN_E}',
    oauthRedirectSignIn: 'http://localhost:4200/auth/callback',
    oauthRedirectSignOut: 'http://localhost:4200/login',
  },
  webhookUrlPattern: '${WEBHOOK_PATTERN_E}',
  mediaProxyBaseUrl: '${MEDIA_PROXY_BASE_E}',
  riot: {
    clientId: '${RIOT_CLIENT_ID_E}',
    redirectUri: 'http://localhost:4200/integrations/riot/callback',
    authorizeUrl: 'https://auth.riotgames.com/authorize',
    scopes: 'openid offline_access',
    tokenExchangeUrl: '${RIOT_EXCHANGE_URL_E}',
    accountUrl: 'https://account.riotgames.com/',
    valorantPrivacyHelpUrl:
      'https://support-valorant.riotgames.com/hc/en-us/articles/360047241634',
  },
};
EOF

echo "OK: ${ENV_FILE} actualizado."
echo ""
echo "=== Referencia rápida ==="
terraform output webhook_url_pattern 2>/dev/null || true
terraform output frontend_url 2>/dev/null || true
