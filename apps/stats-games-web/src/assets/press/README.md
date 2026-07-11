# Press kits (Epic / Roblox)

Colocá aquí **solo** assets que hayas descargado desde canales oficiales de prensa/marketing **después de leer y aceptar sus términos**.

## Estructura

```
assets/press/
  fortnite/
    banner.jpg   # opcional → configurá pressBannerUrl en game-platform.config.ts
  roblox/
    banner.jpg
```

## Importante

- Los press kits de Epic suelen estar pensados para **eventos / islas / Featuring Fortnite**, no como licencia abierta para cualquier SaaS.
- Roblox Developer Hub tiene packs de marketing con reglas propias.
- **No** subas logos oficiales como marca principal de StatsGames.
- Preferí APIs en vivo (avatars, cosméticos) + YouTube embed para trailers.

## Cómo activar un banner

1. Copiá la imagen a `fortnite/banner.jpg` o `roblox/banner.jpg`.
2. En `game-platform.config.ts` seteá `pressBannerUrl: '/assets/press/fortnite/banner.jpg'`.
3. El disclaimer legal ya aparece en login/dashboard cuando hay media de terceros.

Referencias: `MEDIA_PRESS_KIT_GUIDE` en `core/media/media.policy.ts`.
