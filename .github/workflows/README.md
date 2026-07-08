# CI/CD — StatsGames

| Workflow | Trigger | Qué hace |
|----------|---------|----------|
| `deploy-infra.yml` | push en `infra/**` o manual | Terraform apply |
| `deploy-lambdas.yml` | push en `lambda_code/**` / `libs/**`, tras infra OK, o manual | esbuild + `update-function-code` (×3) |
| `deploy-frontend.yml` | push en `apps/stats-games-web/**` o manual | build Angular + S3 + CloudFront |

## Error: `Falta configurar el secret AWS_DEPLOY_ROLE_ARN`

Los workflows usan **OIDC** (sin access keys). Hay que crear el rol en AWS y cargar el ARN como secret en GitHub.

### Opción A — Script automático (recomendado)

Con AWS CLI autenticado en la cuenta correcta:

```bash
chmod +x scripts/setup-github-oidc.sh
./scripts/setup-github-oidc.sh --repo padie78/statsGames
```

Luego en GitHub (**Settings → Secrets and variables → Actions → Secrets**):

| Secret | Valor |
|--------|--------|
| `AWS_DEPLOY_ROLE_ARN` | ARN que imprime el script (ej. `arn:aws:iam::123456789012:role/stats-games-github-deploy`) |

Con GitHub CLI:

```bash
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::<ACCOUNT_ID>:role/stats-games-github-deploy"
```

### Opción B — Manual en consola AWS

1. **IAM → Identity providers → Add provider**
   - Provider type: OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **IAM → Roles → Create role**
   - Trusted entity: Web identity → GitHub
   - Repositorio: `padie78/statsGames`
   - Permisos: `PowerUserAccess` (PoC) o política mínima custom

3. Copiar el **Role ARN** al secret `AWS_DEPLOY_ROLE_ARN` en GitHub.

## Secrets y variables en GitHub

### Secrets (obligatorio para CI)

| Nombre | Descripción |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | ARN del rol OIDC de deploy |

### Secrets (opcional)

| Nombre | Descripción |
|--------|-------------|
| `WEBHOOK_SECRET` | Header `X-Webhook-Secret` para webhooks de juegos |

### Variables (obligatorio tras bootstrap)

| Nombre | Ejemplo |
|--------|---------|
| `TF_STATE_BUCKET` | `stats-games-tfstate-<account_id>` |
| `TF_STATE_LOCKS_TABLE` | `stats-games-tf-locks` |
| `AWS_REGION` | `eu-central-1` |
| `TF_STATE_KEY` | `dev/terraform.tfstate` |

Obtener bucket de state:

```bash
cd infra/bootstrap && terraform output -raw state_bucket
```

### Environment `production`

Los workflows usan `environment: production`. Si activás **Required reviewers**, hay que aprobar cada run.

## Orden del primer deploy

```text
1. infra/bootstrap/terraform apply     (una vez, state remoto)
2. scripts/setup-github-oidc.sh        (una vez, rol + secret en GitHub)
3. Configurar TF_STATE_BUCKET y demás variables en GitHub
4. workflow_dispatch → Deploy Infrastructure
5. Deploy Lambdas (auto tras infra, o manual)
6. workflow_dispatch → Deploy Frontend
```
