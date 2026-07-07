# @stats-games/application

Capa de aplicación — orquestadores (use cases), DTOs Zod, puertos hexagonales y mappers.

## Dependencias permitidas

- `@stats-games/domain`
- `@stats-games/common`

**No** importar `@stats-games/infrastructure`.

## Estructura

```
src/lib/
├── contracts/     # Tipos AppSync (subscriptions, mutations)
├── dto/
│   ├── ingestion/       # Webhook + mensajes SQS
│   ├── event-network/   # Match updates + stats rollups
│   └── player/          # Perfiles gamer
├── mappers/       # Entity ↔ DTO
├── ports/
│   ├── shared/          # ILogger, IIdGenerator
│   ├── event-network/   # IMatchWriter, IStatsSummaryRepository
│   └── player/          # IPlayerProfileRepository
└── use-cases/
    ├── ingestion/       # EnqueueGameEventUseCase
    ├── event-network/   # ProcessMatch, AggregateStats, ListMatches
    └── player/          # Get/Upsert/LinkPlatform
```

## Flujo event-network

```
Webhook → EnqueueGameEventUseCase → SQS
SQS → ProcessMatchFromQueueUseCase → DynamoDB + StatsRollup + AppSync
Query → ListPlayerMatchesUseCase / ListPlayerStatsRollupsUseCase
```
