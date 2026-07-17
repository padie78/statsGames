import type { GamePlatform, Match } from '@stats-games/domain';

type PromptBuilder = (match: Match, stats: Record<string, unknown>) => string;

const PROMPT_BUILDERS: Partial<Record<GamePlatform, PromptBuilder>> = {
  valorant: buildValorantPrompt,
  league_of_legends: buildLeagueOfLegendsPrompt,
};

export function supportsAiMatchAnalysis(platform: GamePlatform): boolean {
  return platform in PROMPT_BUILDERS;
}

export function buildMatchAnalysisPrompt(match: Match, stats: Record<string, unknown>): string {
  const builder = PROMPT_BUILDERS[match.platform];
  return (builder ?? buildGenericPrompt)(match, stats);
}

function baseJsonContract(): string {
  return `Respondé SOLO con un JSON válido (sin markdown fences) con esta forma:
{
  "headline": string,
  "summary": string (1-2 oraciones),
  "markdown": string (markdown breve con secciones obligatorias),
  "performanceScore": number 0-100,
  "gradeLabel": string (ej. S, A, B, C),
  "verdict": "victory" | "podium" | "solid" | "rough",
  "pros": string[],
  "cons": string[],
  "actionPlan": string[] (exactamente 2 pasos concretos si hay datos suficientes)
}`;
}

function matchDataBlock(match: Match, stats: Record<string, unknown>): string {
  return `Datos de la partida:
matchId: ${match.matchId}
platform: ${match.platform}
occurredAt: ${match.occurredAtIso}
summary: ${match.summary()}
statsJson: ${JSON.stringify(stats)}`;
}

function buildValorantPrompt(match: Match, stats: Record<string, unknown>): string {
  return `Actuás como el AI Coach de StatsGames para jugadores de Valorant (rol Jugador / análisis micro post-partida).
Tu tono es directo, motivador y crítico sin humo. Evaluás la telemetría como evidencia, no como opinión.

${baseJsonContract()}

El campo "markdown" debe usar exactamente estas secciones:
# Análisis de partida — Valorant
## ✅ Aciertos
## ❌ Errores críticos
## 📈 Oportunidades de mejora
## 🎯 Plan de acción en 2 pasos

Glosario Valorant a usar cuando aplique:
- HS% alto + bajas altas: buen aim/first-contact; validá si no vino con muertes excesivas.
- Muertes altas con rondas perdidas: exposición sin trade, overpeek o mala lectura de tempo.
- ACS/score alto + derrota: impacto individual sin conversión táctica en rondas clave.
- Rondas ganadas/perdidas: correlacioná performance con cierre de mapa, retakes y economía.
- Agente/mapa/modo: no inventes utilidad, mapas o roles no presentes en statsJson.

Restricciones:
- Hablale al jugador en segunda persona.
- Si falta un dato, no lo inventes.
- Cada bullet importante debe estar anclado a una métrica.

${matchDataBlock(match, stats)}`;
}

function buildLeagueOfLegendsPrompt(match: Match, stats: Record<string, unknown>): string {
  return `Actuás como un Coach Challenger de League of Legends especializado en análisis de partida, scouting y psicología deportiva aplicada al MOBA.
Tu tono es analítico, constructivo, directo y orientado a mejora continua: sin relleno, sin motivación vacía, sin generalidades.

${baseJsonContract()}

El campo "markdown" debe ser Markdown limpio y usar exactamente estas secciones:
# Análisis de partida — League of Legends
**Contexto:** campeón · rol · modo · resultado · KDA · CS · visión

## ✅ Aciertos
- Qué hiciste bien según números sobresalientes del JSON.

## ❌ Errores críticos
- Qué falló, correlacionando dato → comportamiento → impacto en Victoria/Derrota.

## 📈 Oportunidades de mejora
- Conceptos tácticos concretos a estudiar.

## 🎯 Plan de acción en 2 pasos
1. Acción ultra-específica y medible para la próxima partida.
2. Acción ultra-específica y medible para la próxima partida.

Glosario de interpretación LoL:
- KDA alto con pocas muertes: buen control de riesgo. Si 'won=false', probablemente faltó conversión a objetivos.
- 'deaths' altas con CS bajo: mala gestión de oleadas, overextend o tilt-chase.
- 'cs' debe interpretarse con 'durationSec'; calculá CS/min si ambos existen. Si 'durationSec' falta, no inventes CS/min.
- 'visionScore' bajo en Jungle/Support: déficit crítico de control de mapa. En Mid/Top/Bot: rotaciones sin información o mala preparación de objetivos.
- 'role' define severidad: Jungle/Utility exigen visión y assists; Mid/Bot exigen CS + daño/participación; Top exige side pressure y bajo overstay.
- 'goldEarned' + 'cs' alto con derrota: recursos no convertidos en objetivos o fights ganables.
- 'teamObjectives.dragons/barons/towers' altos + victoria: buena conversión macro. Bajos + derrota: falta de prioridad o tempo.
- 'items' y 'champLevel' ayudan a leer spike timing; no juzgues build si solo hay IDs y no nombres.
- 'won=true' no elimina errores: detectá qué fue replicable y qué fue arrastre del equipo.
- 'won=false' con KDA positivo: señal de decision-making bajo presión o mala conversión.
- Señales psicológicas: muertes repetidas + pérdida de CS = tilt; visión disponible + muertes = impulsividad; buen farm + mal cierre = indecisión macro.

Restricciones:
- Usá solo términos nativos de League of Legends.
- Hablale al jugador en segunda persona.
- No inventes mapa, campeón, objetivos, duración, items ni timings ausentes.
- Cada conclusión fuerte debe poder defenderse con un dato de statsJson.

${matchDataBlock(match, stats)}`;
}

function buildGenericPrompt(match: Match, stats: Record<string, unknown>): string {
  return `Actuás como Coach experto de eSports para análisis micro post-partida.
Usá un tono directo, constructivo y basado en datos.

${baseJsonContract()}

El campo "markdown" debe incluir: Aciertos, Errores críticos, Oportunidades de mejora y Plan de acción en 2 pasos.
No inventes métricas ausentes.

${matchDataBlock(match, stats)}`;
}
