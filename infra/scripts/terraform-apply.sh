#!/usr/bin/env bash
# Apply completo de la infraestructura statsGames.
set -euo pipefail

terraform apply -auto-approve -parallelism=1

echo ""
echo "=== AppSync ==="
terraform output appsync_graphql_api_name
terraform output appsync_api_id
terraform output appsync_endpoint

echo ""
echo "=== Webhooks de ingesta ==="
terraform output webhook_url_pattern
