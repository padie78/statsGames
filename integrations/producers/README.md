# Match producers — Fortnite & Roblox → StatsGames

Tu backend ya tiene el spine:

```text
POST /webhooks/{platform}  →  game_ingestion  →  SQS  →  game_processor  →  DynamoDB + AppSync
```

Epic **no** ofrece un webhook público de “partida terminada” para Battle Royale.
Roblox **sí** permite que *tu experiencia* (server script) envíe HTTP al terminar un match.

| Plataforma | Camino real | Qué hay en este folder |
|---|---|---|
| **Roblox** | Server script en tu experience → webhook | `roblox/MatchEndReporter.luau` |
| **Fortnite** | Poll de stats de carrera (diff) → SQS, o companion local | Lambda `fortnite_stats_poller` + `fortnite/send-match.mjs` |
| **Ambas** | Test manual del pipeline | `send-match.mjs` |

## Setup rápido

1. En la app → **Integraciones**, vinculá tu Epic Account ID / Roblox UserId.
2. Configurá `webhook_secret` en Terraform y el header `X-Webhook-Secret`.
3. Copiá la URL de webhook desde Integraciones.

### Roblox (push al terminar partida)

1. Pegá `roblox/MatchEndReporter.luau` en ServerScriptService (ModuleScript).
2. Seteá `WebhookUrl`, `WebhookSecret`, `PlatformUserId` (Roblox UserId del jugador).
3. Al finalizar el round, llamá `MatchEndReporter.report(player, stats)`.

### Fortnite (poller Route B)

1. Creá API key en [fortnite-api.com](https://fortnite-api.com/).
2. En `terraform.tfvars`: `fortnite_api_key = "..."`.
3. Deploy infra + lambda `fortnite-stats-poller` (EventBridge cada 3 min).
4. Vinculá el **Epic account id** (o display name) en Integraciones.

El poller guarda un snapshot de carrera; cuando suben las partidas, encola un evento sintético hacia `game_processor`.

### Test local del webhook

```bash
export SG_WEBHOOK_URL='https://xxxx.execute-api.eu-central-1.amazonaws.com/webhooks/roblox'
export SG_WEBHOOK_SECRET='tu-secreto'
export SG_PLATFORM_USER_ID='123456789'   # debe estar vinculado

npm run send:match -- --platform roblox --kills 7 --deaths 2 --placement 4
```
