# Data por juego — StatsGames

Guía de referencia: cómo se modela, ingiere y lee la data de partidas para cada plataforma.

> **Importante:** no hay una tabla DynamoDB física por juego. Hay **una sola tabla operacional** (`{prefix}-core`) con partición lógica por `platform` en las claves. Este documento describe la “tabla lógica” de cada título.

---

## Arquitectura general

```text
Poller / Webhook / send-match
         │
         ▼
   SQS game_ingestion
         │
         ▼
   game_processor Lambda
         │
         ├──► DynamoDB ({prefix}-core)
         ├──► AppSync publishMatchUpdate → onMatchUpdate (WebSocket)
         └──► SQS match_ai_analysis (solo Valorant hoy)
```

**Fuentes de ingesta**

| Origen | Ruta | Cuándo |
|---|---|---|
| Poller (EventBridge) | Lambda → SQS directo | Partidas detectadas por API externa |
| Webhook | `POST /webhooks/{platform}` → `game_ingestion` → SQS | Companion, partner, pruebas |
| Manual | `npm run send:match` → webhook | Smoke / desarrollo |

**Orden en `game_processor`:** guardar partida → rollup de stats → publicar `onMatchUpdate` → (Valorant) encolar análisis IA.

---

## Tabla DynamoDB única (`{prefix}-core`)

Definición Terraform: `infra/modules/database/main.tf`

### Entidades relevantes

| Entidad | PK | SK | Uso |
|---|---|---|---|
| Perfil jugador | `USER#<userId>` | `PROFILE` | IDs externos de cada juego |
| Partida | `USER#<userId>` | `MATCH#<platform>#<matchId>` | Historial por usuario |
| Cuenta vinculada | `PLATFORM_ACCOUNT#<platform>#<externalId>` | `LINK` | Resolver externalId → Cognito sub |
| Cursor poller | `STATS_SNAPSHOT#<platform>#<externalId>` | `LATEST` | Último match visto / diff de carrera |
| Reporte IA | `USER#<userId>` | `MATCH_AI_REPORT#<matchId>` | Análisis Bedrock (Valorant) |
| Rollup KPIs | `USER#<userId>` | `METRICS#<granularity>#<period>#<platform>` | Evolución / dashboards |

### Índices

| GSI | Hash | Range | Uso |
|---|---|---|---|
| **GSI1** | `PLATFORM#<platform>` | `<playedAtIso>#<matchId>#<userId>` | Listar partidas por juego |
| **GSI2** | `GAMERTAG` | `<tag>#<userId>` | Búsqueda por gamerTag |

Patrones de clave: `libs/common/src/lib/dynamodb/keys.ts`

### Stats en reposo

Las estadísticas se guardan como JSON flexible (`statsJson`). GraphQL expone un superset tipado (`MatchStats`); campos extra del juego permanecen en el JSON.

---

## Catálogo por juego

Fuente de verdad del catálogo: `libs/common/src/lib/platforms/catalog.ts`

| Juego | `platform` | Campo perfil | ID externo | Fase | Integración hoy | Secret / key |
|---|---|---|---|---|---|---|
| Valorant | `valorant` | `valorantId` | Riot ID `Nombre#TAG` | 1 | Poller Riot | `RIOT_API_KEY` |
| League of Legends | `league_of_legends` | `leagueOfLegendsId` | Riot ID `Nombre#TAG` | 1 | Poller match-v5 | `RIOT_API_KEY` |
| Counter-Strike 2 | `cs2` | `cs2Id` | SteamID64 (17 dígitos) | 1 | Webhook + validación Steam | `STEAM_WEB_API_KEY` |
| Dota 2 | `dota2` | `dota2Id` | SteamID64 | 1 | Poller Steam + webhook | `STEAM_WEB_API_KEY` / `DOTA2_API_KEY` |
| Rocket League | `rocket_league` | `rocketLeagueId` | Epic display name / id | 1 | Webhook + opcional ballchasing | `BALLCHASING_API_KEY` |
| Fortnite | `fortnite` | `fortniteId` | Epic id o display name | 2 | Poller diff de carrera | `FORTNITE_API_KEY` |
| Overwatch 2 | `overwatch2` | `overwatch2Id` | BattleTag `Nombre#1234` | 2 | Poller API bridge + webhook | `OVERWATCH2_API_URL` |
| Clash Royale | `clash_royale` | `clashRoyaleId` | Player tag `#ABC123` | 2 | Poller Supercell + webhook | `SUPERCELL_API_KEY` |
| Brawl Stars | `brawl_stars` | `brawlStarsId` | Player tag `#ABC123` | 2 | Poller Supercell + webhook | `SUPERCELL_API_KEY` |
| Roblox | `roblox` | `robloxId` | UserId numérico | 2 | Poller badges (BedWars + Arsenal) | — |

**Fase 1** — APIs estables (MVP scouting). **Fase 2** — tracción / experiencias.

---

## Cómo obtener la data — por juego

### Valorant

A diferencia de LoL (historial mayormente público), en Valorant los perfiles nacen **privados**.
Con solo `RIOT_API_KEY`, Riot rechaza matchlist / match-v1 salvo que se cumpla una de estas vías:

| Vía | Qué hace el jugador | Qué usa StatsGames |
|---|---|---|
| **Riot Sign-On (RSO)** — recomendada | “Iniciar sesión con Riot” | Authorize → `/integrations/riot/callback` → Lambda exchange → `linkPlatformAccount` |
| **Perfil público** | Historial Público + Riot ID + checkbox | Poller con API key sobre PUUID |

1. App de producción + RSO Client en [developer.riotgames.com](https://developer.riotgames.com/).
2. Terraform: `riot_rso_client_id`, `riot_rso_client_secret` → Lambda `*-riot-rso`.
3. Frontend: `environment.riot.clientId` + `redirectUri` + `tokenExchangeUrl`.
4. Redirect URI registrada en Riot: `{origin}/integrations/riot/callback`.
5. Flujo: authorize (`openid offline_access` + PKCE) → POST `/integrations/riot/rso/exchange` → `accounts/me` → `valorantId`.
6. Poller: `lambda_code/ingestion/valorant_match_poller/` — account-v1 → matchlist → match-v1.
7. Latencia típica: ≤ 1 ciclo EventBridge (~3 min) tras partida cerrada.
8. IA: Bedrock vía `match_ai_analyzer` tras guardar la partida.

**Stats típicas:** `kills`, `deaths`, `assists`, `headshotPct`, `roundsWon`, `roundsLost`, `map`, `agent`, `score`, `acs`, `won`, `mode`.

**Nota:** keys de desarrollo personal pueden devolver 403 en `val/match` si el perfil sigue privado o la app no tiene acceso de producción al endpoint.

---

### League of Legends

1. Misma `RIOT_API_KEY` que Valorant.
2. Var `LOL_REGION` (default `europe`) para routing match-v5.
3. Vincular Riot ID en Integraciones (`leagueOfLegendsId`).
4. Poller: `lambda_code/ingestion/league_of_legends_match_poller/`.
5. Sin partidas reales: usar `send-match` para smoke.

**Stats típicas:** `kills`, `deaths`, `assists`, `champion`, `role`, `cs`, `visionScore`, `won`, `mode`.

```bash
npm run send:match -- --platform league_of_legends --platform-user-id "Nombre#TAG" --kills 8 --deaths 3 --assists 12
```

---

### Counter-Strike 2

1. `STEAM_WEB_API_KEY` para validar SteamID64 al vincular.
2. Vincular SteamID64 en Integraciones (`cs2Id`).
3. Historial oficial limitado → webhook o `send-match`.

**Stats típicas:** `kills`, `deaths`, `assists`, `adr`, `headshotPct`, `map`, `won`.

```bash
npm run send:match -- --platform cs2 --platform-user-id "76561198000000000" --kills 22 --deaths 14
```

---

### Dota 2

1. Vincular SteamID64 (`dota2Id`).
2. Poller: `lambda_code/ingestion/dota2_match_poller/`.
3. Fuente: Steam Web API (`GetMatchHistory` + `GetMatchDetails`).

**Stats típicas:** `kills`, `deaths`, `assists`, `hero`, `gpm`, `xpm`, `won`.

```bash
npm run send:match -- --platform dota2 --kills 10 --deaths 4 --assists 15
```

*(Verificar que `send-match` y webhook acepten `dota2` antes de usar en prod.)*

---

### Rocket League

Psyonix no expone match history pública de forma estable.

1. **Inmediato:** webhook / companion / `send-match`.
2. **Opcional:** poller ballchasing.com con `BALLCHASING_API_KEY`.

**Stats típicas:** `goals`, `assists`, `saves`, `shots`, `shotPct`, `score`, `won`. En KPIs, `goals` se mapea como kills.

```bash
npm run send:match -- --platform rocket_league --kills 4
```

Poller: `lambda_code/ingestion/rocket_league_match_poller/`

---

### Fortnite

1. `FORTNITE_API_KEY` (fortnite-api.com u equivalente configurado).
2. Vincular Epic id o display name (`fortniteId`).
3. Poller de **diff de carrera** (no match-by-match nativo): `lambda_code/ingestion/fortnite_stats_poller/`.

**Stats típicas:** `kills`, `deaths`, `placement`, `mode`, `won`.

```bash
npm run send:match -- --platform fortnite --kills 8 --placement 1
```

---

### Overwatch 2

1. Vincular BattleTag (`overwatch2Id`).
2. Poller: `lambda_code/ingestion/overwatch2_match_poller/`.
3. Fuente: `OVERWATCH2_API_URL` configurable con contrato normalizado `{ matches: [...] }`.

**Stats típicas:** `kills`, `deaths`, `assists`, `damage`, `healing`, `hero`, `role`, `won`.

---

### Clash Royale

1. Vincular player tag (`clashRoyaleId`).
2. Poller: `lambda_code/ingestion/clash_royale_match_poller/`.
3. Fuente: Supercell Battlelog API.

**Stats típicas:** `won`, `crowns`, `trophies`, `mode`, `score`.

---

### Brawl Stars

1. Vincular player tag (`brawlStarsId`).
2. Poller: `lambda_code/ingestion/brawl_stars_match_poller/`.
3. Fuente: Supercell Battlelog API.

**Stats típicas:** `kills`, `deaths`, `won`, `trophies`, `brawler`, `mode`.

---

### Roblox (BedWars & Arsenal)

No se trackea “todo Roblox”. Solo experiencias con poller de badges:

| Experiencia | Universe ID |
|---|---|
| BedWars | `2619619496` |
| Arsenal | `111958650` |

1. Vincular Roblox UserId (`robloxId`).
2. Poller: `lambda_code/ingestion/roblox_experience_poller/`.
3. Detalle: `integrations/producers/roblox/README.md`.

**Stats típicas:** `kills`, `deaths`, `placement`, `mode`, `experienceName`, `badgeId`, `badgeName`.

```bash
npm run send:match -- --platform roblox --mode BedWars --kills 7 --placement 2
npm run probe:roblox -- 123456789
```

---

## Cómo leer la data

### GraphQL (historial — pull)

Schema: `infra/modules/api/schema.graphql`

```graphql
query ListMatches($userId: ID!, $platform: String, $limit: Int) {
  listPlayerMatches(userId: $userId, platform: $platform, limit: $limit) {
    matchId
    platform
    summary
    updatedAt
    stats {
      kills
      deaths
      assists
      placement
      champion
      agent
      goals
      # … superset MatchStats
    }
  }
}
```

| Parámetro | Efecto |
|---|---|
| Sin `platform` | Todas las partidas del usuario |
| `platform: "valorant"` | Solo ese juego |
| `limit` | Máximo de filas (default en API) |

**Frontend:** `apps/stats-games-web/src/app/services/match.service.ts` → `listPlayerMatchesOnce(userId, { platform, limit })`.

**Mapa LoL:** `stats.mapTelemetry` (AWSJSON) con `source: riot_timeline_v5 | live_client | synthetic`, `path[]` y `events[]` normalizados 0–1. El poller LoL llama Match-Timeline-V5; la SPA usa `match-map-lol.util.ts` + asset `summoners-rift-mvp.svg`. Live Client (`127.0.0.1:2999`) está tipado en `lol-live-client.types.ts` para companion futuro.

**Repositorio:** `libs/infrastructure/src/lib/repositories/dynamodb-match.repository.ts`  
Query: `PK = USER#<id> AND begins_with(SK, "MATCH#")` con prefijo opcional `MATCH#<platform>#`.

---

### AppSync (tiempo real — push)

```graphql
subscription OnMatchUpdate($userId: ID!) {
  onMatchUpdate(userId: $userId) {
    matchId
    platform
    summary
    updatedAt
    stats { kills deaths assists placement champion agent goals }
  }
}
```

**Frontend:** `AppSyncRealtimeService` (`liveMatches` signal) + merge en `matches.page.ts`.  
**Notificaciones:** `MatchNotificationsStore` consume el mismo feed.

La partida aparece en la lista **antes** de que termine el análisis IA.

---

### Detalle de partida

- Ruta UI: `/tabs/matches/:matchId`
- Resolución: historial API + `liveMatches` + notificación en memoria.
- IA: `getMatchAiReport(userId, matchId)` — hoy pipeline completo en Valorant.

---

### Analytics frío (S3 / Glue / Athena)

Bucket Parquet particionado por plataforma: `s3://{prefix}-data-lake-parquet-{account}/platform=<platform>/`

Tablas Glue (infra): `match_history_valorant`, `match_history_fortnite`, `match_history_roblox`, `match_history_rocket_league`, `bronze_matches`.

> El export ETL activo a S3 puede no estar cableado para todos los juegos; la infra existe en `infra/modules/analytics/main.tf`.

---

## Flujo operativo (checklist)

```text
1. Usuario vincula cuenta en Integraciones
      → PLATFORM_ACCOUNT#<platform>#<externalId> + campo en PROFILE

2. Ingesta (automática o manual)
      → mensaje SQS { userId, matchId, platform, stats, occurredAtIso }

3. game_processor persiste
      → MATCH#<platform>#<matchId>

4. AppSync notifica
      → toast + merge en Partidas

5. (Opcional) IA Bedrock
      → MATCH_AI_REPORT#<matchId> + onMatchAiReady
```

---

## Smoke commands

```bash
npm run send:match -- --platform valorant --kills 18 --deaths 14 --assists 6
npm run send:match -- --platform league_of_legends --platform-user-id "Nombre#TAG" --kills 8 --deaths 3 --assists 12
npm run send:match -- --platform cs2 --kills 22 --deaths 14 --assists 5
npm run send:match -- --platform rocket_league --kills 4
npm run send:match -- --platform fortnite --kills 8 --placement 1
npm run send:match -- --platform roblox --mode BedWars --kills 7 --placement 2
```

Más detalle de producers: `integrations/producers/README.md`

---

## ¿Tabla física por juego?

**Recomendación actual: no.** El single-table con `platform` en SK/GSI1 escala a los 10 títulos sin duplicar infra ni resolvers.

Considerar tablas separadas solo si:

- un juego genera volumen masivo (millones de filas/día),
- necesitás TTL o retención distinta por título,
- o hay requisito de aislamiento/compliance.

Para analytics a escala, usar partición en S3 (`platform=`) + Athena, no saturar DynamoDB operacional.

---

## Referencias en el repo

| Tema | Ruta |
|---|---|
| Catálogo plataformas | `libs/common/src/lib/platforms/catalog.ts` |
| Claves DynamoDB | `libs/common/src/lib/dynamodb/keys.ts` |
| Tabla TF | `infra/modules/database/main.tf` |
| Schema GraphQL | `infra/modules/api/schema.graphql` |
| Procesar partida | `libs/application/src/lib/use-cases/event-network/process-match-from-queue.use-case.ts` |
| Repo matches | `libs/infrastructure/src/lib/repositories/dynamodb-match.repository.ts` |
| Webhook ingress | `lambda_code/ingestion/game_ingestion/src/index.ts` |
| Processor SQS | `lambda_code/ingestion/game_processor/src/index.ts` |
| Producers / smoke | `integrations/producers/README.md` |
| UI matches | `apps/stats-games-web/src/app/pages/matches/matches.page.ts` |
| Realtime | `apps/stats-games-web/src/app/services/appsync-realtime.service.ts` |
