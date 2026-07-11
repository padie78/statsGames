--[[
  StatsGames — reporter de fin de partida (Roblox)

  Uso:
    1. ModuleScript en ServerScriptService llamado MatchEndReporter
    2. Al terminar el round:

       local MatchEndReporter = require(script.Parent.MatchEndReporter)
       MatchEndReporter.report(player, {
         matchId = "match-" .. tostring(os.time()),
         kills = 5,
         deaths = 1,
         placement = 2,
         assists = 1,
         mode = "BedWars",
         map = "Classic",
         summary = "BedWars · Top 2 · 5 kills",
       })

  Requisitos:
    - HttpService.HttpEnabled = true (Game Settings → Security)
    - Cuenta Roblox vinculada en StatsGames (platformUserId = UserId)
]]

local HttpService = game:GetService("HttpService")

local CONFIG = {
  -- Reemplazar con la URL de Integraciones (…/webhooks/roblox)
  WebhookUrl = "https://REPLACE.execute-api.eu-central-1.amazonaws.com/webhooks/roblox",
  WebhookSecret = "REPLACE_WITH_WEBHOOK_SECRET",
  -- Si nil, usa player.UserId
  PlatformUserIdOverride = nil,
}

local MatchEndReporter = {}

export type MatchStats = {
  matchId: string,
  kills: number?,
  deaths: number?,
  placement: number?,
  assists: number?,
  mode: string?,
  map: string?,
  summary: string?,
}

function MatchEndReporter.report(player: Player, stats: MatchStats)
  assert(player, "player requerido")
  assert(stats and stats.matchId, "stats.matchId requerido")

  local platformUserId = CONFIG.PlatformUserIdOverride or tostring(player.UserId)

  local body = {
    platformUserId = platformUserId,
    matchId = tostring(stats.matchId),
    occurredAt = DateTime.now():ToIsoDate(),
    mode = stats.mode,
    map = stats.map,
    summary = stats.summary,
    stats = {
      kills = stats.kills,
      deaths = stats.deaths,
      placement = stats.placement,
      assists = stats.assists,
      source = "roblox_experience",
    },
  }

  local ok, err = pcall(function()
    HttpService:RequestAsync({
      Url = CONFIG.WebhookUrl,
      Method = "POST",
      Headers = {
        ["Content-Type"] = "application/json",
        ["X-Webhook-Secret"] = CONFIG.WebhookSecret,
      },
      Body = HttpService:JSONEncode(body),
    })
  end)

  if not ok then
    warn("[StatsGames] Falló envío de partida:", err)
  end
end

return MatchEndReporter
