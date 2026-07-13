# Match producers — multi-juego StatsGames

```text
Valorant (Riot) ────────┐
Rocket League (BC/WH) ──┤
Fortnite (fortnite-api) ┼──► SQS ──► game_processor ──► DynamoDB + AppSync
BedWars/Arsenal badges ─┘
Webhook POST /webhooks/{platform}
```

| Plataforma | Fase | Integración | Secret / key |
|---|---|---|---|
| **Valorant** | 1 | Riot matchlist poller | `RIOT_API_KEY` |
| **League of Legends** | 1 | Riot match-v5 poller | `RIOT_API_KEY` |
| **CS2** | 1 | Steam link + webhook | `STEAM_WEB_API_KEY` |
| **Rocket League** | 1 | Webhook + opcional ballchasing | `BALLCHASING_API_KEY` |
| **Fortnite** | 2 | Career diff poller | `FORTNITE_API_KEY` |
| **Roblox** | 2 | **Solo BedWars + Arsenal** (badges) | — |

## Fase 1 — Valorant

1. Key en [developer.riotgames.com](https://developer.riotgames.com/).
2. GitHub secret `RIOT_API_KEY` (+ repo vars `VALORANT_REGION` / `VALORANT_SHARD`, default `americas` / `na`).
3. Redeploy **Deploy Infrastructure** → EventBridge rule `*-valorant-match-poller` pasa a **ENABLED** solo si la key no está vacía.
4. En Integraciones vincular Riot ID exacto `Nombre#TAG` (validado en UI).
5. Smoke: jugar / esperar partida cerrada → ≤1 ciclo (~3 min) → match en `/tabs/matches` → análisis Bedrock en detalle / AI Coach.

Sin `RIOT_API_KEY` el poller es no-op (log `missing_api_key`) y la rule queda DISABLED.

Datos: KDA, assists, HS%, rounds won/lost, mapa, agente, mode/queue, won.


## Fase 1 — League of Legends

1. Misma `RIOT_API_KEY` que Valorant.
2. Repo var `LOL_REGION` (default `europe` — routing match-v5).
3. Vincular Riot ID `Nombre#TAG` en Integraciones (plataforma League of Legends).
4. Poller encola partidas nuevas ≤3 min.

## Fase 1 — Counter-Strike 2

1. Steam Web API key → secret `STEAM_WEB_API_KEY` (valida SteamID64).
2. Vincular SteamID64 (`7656119…`) en Integraciones.
3. Match history oficial limitada: enviar partidas con webhook / `send:match --platform cs2`.

## Fase 1 — Rocket League

Psyonix no expone match history pública. Caminos:

1. **Webhook / companion** (inmediato):  
   `npm run send:match -- --platform rocket_league --kills 5`
2. **ballchasing.com** (replays): secret `BALLCHASING_API_KEY` → poller.

Datos: goles, assists, saves, shots, playlist/mapa.

## Fase 2 — Fortnite

Ver `fortnite/probe-stats.mjs`. Diff de carrera cada ~3 min.

## Fase 2 — Roblox · BedWars & Arsenal

No se trackea “todo Roblox”. Solo:

- **BedWars** (universe `2619619496`)
- **Arsenal** (universe `111958650`)

Poller de badges públicos → hitos en el feed. Ver `roblox/README.md`.

## Smoke

```bash
npm run send:match -- --platform valorant --kills 18 --deaths 14 --assists 6
npm run send:match -- --platform league_of_legends --kills 8 --deaths 3 --assists 12
npm run send:match -- --platform cs2 --kills 22 --deaths 14 --assists 5
npm run send:match -- --platform rocket_league --kills 4
npm run send:match -- --platform fortnite --kills 8 --placement 1
npm run send:match -- --platform roblox --mode BedWars --kills 7 --placement 2
npm run send:match -- --platform roblox --mode Arsenal --kills 15
npm run probe:roblox -- 8367095373
```
