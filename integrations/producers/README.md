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
| **Rocket League** | 1 | Webhook + opcional ballchasing | `BALLCHASING_API_KEY` |
| **Fortnite** | 2 | Career diff poller | `FORTNITE_API_KEY` |
| **Roblox** | 2 | **Solo BedWars + Arsenal** (badges) | — |

## Fase 1 — Valorant

1. Key en [developer.riotgames.com](https://developer.riotgames.com/).
2. GitHub secret `RIOT_API_KEY` (+ vars `VALORANT_REGION` / `VALORANT_SHARD`).
3. Vincular Riot ID `Nombre#TAG` en Integraciones.
4. Deploy infra + lambda `valorant-match-poller`.

Datos: KDA, assists, % headshots, rondas, mapa, agente.

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
npm run send:match -- --platform rocket_league --kills 4
npm run send:match -- --platform fortnite --kills 8 --placement 1
npm run send:match -- --platform roblox --mode BedWars --kills 7 --placement 2
npm run send:match -- --platform roblox --mode Arsenal --kills 15
npm run probe:roblox -- 8367095373
```
