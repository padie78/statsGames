# Frontend Architecture — StatsGames (Atomic Design + TRN Cyberpunk)

## 1. Estructura de directorios

```text
apps/stats-games-web/src/
├── theme/
│   ├── tokens/
│   │   └── _variables.scss      # Design tokens (neones, glow, tipografía)
│   ├── utilities/
│   │   └── _utilities.scss      # Clases u-* (flex, spacing, buttons)
│   ├── components/
│   │   └── _atomic.scss         # BEM global para átomos/moléculas/organismos
│   └── variables.scss           # Bridge legacy → tokens
├── styles.scss                  # Entry: tokens + utilities + Ionic + base
├── app/
│   ├── ui/                      # Design System (Atomic Design)
│   │   ├── atoms/
│   │   │   ├── neon-badge/
│   │   │   └── stat-value/
│   │   ├── molecules/
│   │   │   └── match-stat-card/
│   │   ├── organisms/
│   │   │   ├── live-match-feed/
│   │   │   └── premium-upsell-banner/
│   │   └── index.ts
│   ├── pages/                   # Templates / Screens
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── register/
│   │   ├── onboarding/
│   │   └── tabs/
│   ├── services/
│   │   ├── appsync-realtime.service.ts  # Amplify WS + Signals
│   │   ├── match.service.ts
│   │   └── player.service.ts
│   ├── core/auth/
│   └── stores/
└── environments/
```

> En este monorepo el frontend vive en `apps/stats-games-web/src/` (no `src/frontend/`).
> La jerarquía Atomic Design es la misma.

## 2. Reglas de CSS global

1. **Cero `styles` / `styleUrls` en componentes** — el diseño se gobierna desde `theme/`.
2. Componentes UI usan `encapsulation: ViewEncapsulation.None` y clases globales `sg-*` / `u-*`.
3. Tokens en `:root` (`--sg-neon-lime`, `--sg-glow-purple`, etc.).
4. Tipografías: Orbitron (display) + Inter (body) + JetBrains Mono (KPIs).

## 3. Flujo atómico

```text
NeonBadge / StatValue  →  MatchStatCard  →  LiveMatchFeed
                                         →  PremiumUpsellBanner
                                         →  DashboardPage
```

## 4. Realtime

`AppSyncRealtimeService` abre la subscription Amplify `onMatchUpdate`, expone
`liveMatches` / `isLive` / `premiumInsight` como **Angular Signals**.
El dashboard consume signals en template y muestra el banner de conversión
cuando el insight está visible.
