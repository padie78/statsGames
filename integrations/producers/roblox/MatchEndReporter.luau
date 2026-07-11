--[[
  StatsGames — reporter de fin de partida (Roblox)

  Envía al webhook: jugador, place, JobId, fecha/hora, modo/mapa,
  duración (si se pasa) y stats. Arma un `summary` por defecto si no viene.

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
         mode = "BedWars",          -- opcional; default = game.Name
         map = "Classic",           -- opcional
         durationSec = 312,         -- opcional
         summary = nil,             -- opcional; se genera solo
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
  --- Duración de la partida en segundos (recomendado).
  durationSec: number?,
  --- os.clock() o tick() al inicio del round; si no hay durationSec, se calcula.
  startedAt: number?,
}

local function trim(value: string?): string?
  if typeof(value) ~= "string" then
    return nil
  end
  local cleaned = (value :: string):match("^%s*(.-)%s*$")
  if cleaned == nil or cleaned == "" then
    return nil
  end
  return cleaned
end

local function resolveDurationSec(stats: MatchStats): number?
  if typeof(stats.durationSec) == "number" and stats.durationSec >= 0 then
    return math.floor(stats.durationSec)
  end
  if typeof(stats.startedAt) == "number" then
    local elapsed = os.clock() - stats.startedAt
    if elapsed >= 0 then
      return math.floor(elapsed)
    end
  end
  return nil
end

local function buildDefaultSummary(parts: {
  placeName: string,
  mode: string?,
  map: string?,
  placement: number?,
  kills: number?,
  durationSec: number?,
}): string
  local bits = { parts.placeName }

  local mode = trim(parts.mode)
  if mode and mode ~= parts.placeName then
    table.insert(bits, mode)
  end

  local map = trim(parts.map)
  if map then
    table.insert(bits, map)
  end

  if typeof(parts.placement) == "number" and parts.placement > 0 then
    table.insert(bits, ("Top %d"):format(math.floor(parts.placement)))
  end

  if typeof(parts.kills) == "number" and parts.kills >= 0 then
    table.insert(bits, ("%d kills"):format(math.floor(parts.kills)))
  end

  if typeof(parts.durationSec) == "number" and parts.durationSec > 0 then
    local mins = math.floor(parts.durationSec / 60)
    local secs = parts.durationSec % 60
    if mins > 0 then
      table.insert(bits, ("%dm %02ds"):format(mins, secs))
    else
      table.insert(bits, ("%ds"):format(secs))
    end
  end

  local summary = table.concat(bits, " · ")
  if #summary > 200 then
    return summary:sub(1, 200)
  end
  return summary
end

function MatchEndReporter.report(player: Player, stats: MatchStats)
  assert(player, "player requerido")
  assert(stats and stats.matchId, "stats.matchId requerido")

  local platformUserId = CONFIG.PlatformUserIdOverride or tostring(player.UserId)
  local placeName = tostring(game.Name)
  local placeId = tostring(game.PlaceId)
  local jobId = tostring(game.JobId)
  local universeId = tostring(game.GameId)
  local durationSec = resolveDurationSec(stats)
  local mode = trim(stats.mode) or placeName
  local map = trim(stats.map)
  local summary = trim(stats.summary)
    or buildDefaultSummary({
      placeName = placeName,
      mode = mode,
      map = map,
      placement = stats.placement,
      kills = stats.kills,
      durationSec = durationSec,
    })

  local body = {
    platformUserId = platformUserId,
    matchId = tostring(stats.matchId),
    occurredAt = DateTime.now():ToIsoDate(),
    mode = mode,
    map = map,
    summary = summary,
    stats = {
      kills = stats.kills,
      deaths = stats.deaths,
      placement = stats.placement,
      assists = stats.assists,
      source = "roblox_experience",
      placeId = placeId,
      placeName = placeName,
      experienceName = placeName,
      universeId = universeId,
      jobId = jobId,
      playerUserId = tostring(player.UserId),
      playerName = player.Name,
      playerDisplayName = player.DisplayName,
      durationSec = durationSec,
      mode = mode,
      map = map,
      summary = summary,
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
