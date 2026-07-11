# Roblox experiences trackeadas

| Experience | PlaceId | UniverseId | UI switcher |
|---|---|---|---|
| **Blox Fruits** | `2753915549` | `994732206` | sí |
| **Adopt Me!** | `920587237` | `383310974` | sí |
| **Brookhaven RP** | `4924922222` | `1686885941` | sí |
| BedWars | `6872265039` | `2619619496` | poller |
| Arsenal | `286090429` | `111958650` | poller |

Un solo **Roblox UserId** vincula todas. El poller chequea badges (Inventory API).

```bash
npm run probe:roblox -- 8367095373
npm run send:match -- --platform roblox --mode "Blox Fruits" --kills 3
npm run send:match -- --platform roblox --mode "Adopt Me!" --kills 1
npm run send:match -- --platform roblox --mode "Brookhaven RP"
```
