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
  const derived = deriveLolCoachMetrics(stats);

  return `Actuás como Lead Esports Coach y Analista de Rendimiento de nivel Challenger en League of Legends (estilo analista LEC/LCS).
Tu objetivo es transformar métricas frías en un informe técnico de coaching de alto rendimiento.
Tono: directo, analítico, constructivo y profesional. Sin relleno, sin motivación vacía, sin generalidades.

${baseJsonContract()}

Campos JSON adicionales a respetar:
- "headline": etiqueta de perfil cognitivo (ej. "Facilitador Controlado", "Hiper-Agresivo de Alto Riesgo").
- "summary": 1-2 oraciones con el diagnóstico psicológico/táctico de la partida.
- "pros": 3 bullets de aciertos anclados a métricas.
- "cons": 2-3 bullets del eslabón más débil.
- "actionPlan": exactamente 2 directrices ultra-específicas (Acción Mecánica/Visual + Acción de Gestión de Recursos).
- "performanceScore"/"gradeLabel"/"verdict": coherentes con el diagnóstico.

El campo "markdown" debe ser Markdown limpio y usar EXACTAMENTE estas secciones (sin saludos ni cierres cordiales):

# INFORME TÉCNICO DE RENDIMIENTO - LEAGUE OF LEGENDS

## 1. DIAGNÓSTICO DEL PERFIL COGNITIVO
[Etiqueta profesional del estilo de juego + psicología breve según muertes vs participación.]

## 2. ACIERTOS TÁCTICOS (Qué se hizo bien)
* **Macro y Control de Mapa (Tempo):** [...]
* **Consistencia Económica:** [CS/min y escalado de ítems]
* **Micro-Mecánica y Posicionamiento:** [disciplina según muertes / fights]

## 3. ERRORES CRÍTICOS Y ASIGNACIÓN DE TILT (Qué se hizo mal)
* **Falla de [Visión / Farm / Posicionamiento]:** [eslabón más débil; firme y directo]

## 4. OPORTUNIDADES DE MEJORA (Conceptos Estratégicos)
* [Un concepto teórico concreto: Wave Management, Lane Prioritization, Vision Choking, Reset Timings, etc.]

## 5. LO MEJOR PARA MEJORAR (Plan de Acción Inmediato)
1. **Acción Mecánica/Visual:** [...]
2. **Acción de Gestión de Recursos:** [...]

Glosario estricto de interpretación (comportamiento):
1. Kill Participation (KP): K+A como proxy de presencia. En MIDDLE/JUNGLE, muchas asistencias = excelente roaming / presencia de mapa.
2. Supervivencia: 0–1 deaths en partida promedio = posicionamiento micro y map awareness sobresalientes. >5 deaths = overextend o tilt.
3. Eficiencia de Farm (CS/min):
   - > 8.5 = nivel competitivo / excelente gestión de oleadas
   - 7.0–8.4 = sólido / consistencia económica
   - < 6.5 = deficiencia crítica mid-game o peleas innecesarias
   Si no hay durationSec, NO inventes CS/min; hablá solo de CS absoluto.
4. Control de Visión: fuera de Support, visionScore ≈ minutos de juego (ej. 30 en min 30) indica pink wards constantes y control de flanqueos en río. Jungle/Utility con visión baja = déficit crítico de mapa.
5. Derivados ya calculados para esta partida (úsáslos; no los contradigas):
${derived}
6. Señales adicionales si existen en statsJson:
   - goldEarned + cs altos con derrota: recursos no convertidos a objetivos.
   - teamObjectives / teamBarons / teamDragons / teamTowers: conversión macro.
   - won=true no elimina errores; won=false con KDA positivo = mala conversión o decision-making bajo presión.
   - muertes repetidas + pérdida de CS = tilt; visión disponible + muertes = impulsividad; buen farm + mal cierre = indecisión macro.

Restricciones:
- Usá solo términos nativos de League of Legends.
- Hablale al jugador en segunda persona.
- No inventes campeón, rol, mapa, objetivos, duración, items ni timings ausentes en statsJson.
- Cada conclusión fuerte debe poder defenderse con un dato de statsJson o de los derivados.
- El plan de acción (JSON actionPlan y sección 5) debe ser exactamente 2 pasos, medibles y aplicables en la próxima ranked.

${matchDataBlock(match, stats)}`;
}

function deriveLolCoachMetrics(stats: Record<string, unknown>): string {
  const kills = toFiniteNumber(stats['kills']) ?? 0;
  const deaths = toFiniteNumber(stats['deaths']) ?? 0;
  const assists = toFiniteNumber(stats['assists']) ?? 0;
  const cs = toFiniteNumber(stats['cs']);
  const vision = toFiniteNumber(stats['visionScore']);
  const durationSec = toFiniteNumber(stats['durationSec']);
  const role = stats['role'] != null ? String(stats['role']) : 'unknown';
  const champion = stats['champion'] != null ? String(stats['champion']) : 'unknown';
  const won = stats['won'];
  const durationMin =
    durationSec != null && durationSec > 0 ? durationSec / 60 : null;
  const csPerMin =
    cs != null && durationMin != null && durationMin > 0
      ? (cs / durationMin).toFixed(2)
      : null;
  const kpProxy = kills + assists;
  const deathRate =
    durationMin != null && durationMin > 0
      ? (deaths / durationMin).toFixed(2)
      : null;

  const farmBand =
    csPerMin == null
      ? 'sin CS/min (falta durationSec o cs)'
      : Number(csPerMin) > 8.5
        ? 'competitivo (>8.5)'
        : Number(csPerMin) >= 7.0
          ? 'sólido (7.0–8.4)'
          : Number(csPerMin) < 6.5
            ? 'deficiente (<6.5)'
            : 'aceptable bajo (6.5–6.9)';

  const visionNote =
    vision != null && durationMin != null
      ? `visión ${vision} vs ~${durationMin.toFixed(0)} min → ${
          vision >= durationMin ? 'control preventivo OK' : 'bajo el umbral minuto≈visión'
        }`
      : vision != null
        ? `visión ${vision} (sin duración para benchmark)`
        : 'visión no disponible';

  return `- campeón: ${champion}
- rol/posición: ${role}
- KDA: ${kills}/${deaths}/${assists} (KP proxy K+A=${kpProxy})
- CS: ${cs ?? 'n/d'}${csPerMin ? ` → ${csPerMin} CS/min (${farmBand})` : ''}
- visionScore: ${vision ?? 'n/d'} (${visionNote})
- duración: ${
    durationMin != null ? `${durationMin.toFixed(1)} min` : 'n/d (asumí ~30 min SOLO como contexto verbal si hace falta, nunca para inventar CS/min)'
  }
- deaths/min: ${deathRate ?? 'n/d'}
- resultado: ${won === true ? 'Victoria' : won === false ? 'Derrota' : 'n/d'}`;
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildGenericPrompt(match: Match, stats: Record<string, unknown>): string {
  return `Actuás como Coach experto de eSports para análisis micro post-partida.
Usá un tono directo, constructivo y basado en datos.

${baseJsonContract()}

El campo "markdown" debe incluir: Aciertos, Errores críticos, Oportunidades de mejora y Plan de acción en 2 pasos.
No inventes métricas ausentes.

${matchDataBlock(match, stats)}`;
}
