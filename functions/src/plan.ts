import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { availableExercises, DAY_LABELS, durationMinutes } from '../../shared/catalog';
import { addDays, isoDate } from '../../shared/dates';
import { buildRulePlan, PLAN_WEEKS, planNameFor, sanitizePlan } from '../../shared/plan';
import type { Activity, Plan, Profile, UserDoc, WorkoutLog } from '../../shared/types';
import { ANTHROPIC_API_KEY, db } from './config';

// Kept as plain strings (validated by sanitizePlan) so one off-list value doesn't fail the whole parse.
const Zone = z.string().describe('Uma de: Z1, Z2, Z3, Z4, Z5, Z1/Z2');

function planSchema(exerciseIds: string[]) {
  return z.object({
    name: z.string().describe('Nome curto do plano em pt-BR, ex.: "Plano 10K", "Plano Força + Corrida"'),
    weeks: z.number().int().describe('Duração do plano em semanas (4 a 12)'),
    rationale: z.string().describe('1–2 frases em pt-BR explicando a lógica do plano'),
    days: z.array(z.object({
      weekday: z.number().int().describe('0 = domingo … 6 = sábado. Use apenas os dias disponíveis do atleta.'),
      type: z.enum(['aerobic', 'strength']),
      title: z.string().describe('Ex.: "Corrida leve", "Intervalado", "Longão", "Força"'),
      subtitle: z.string().describe('Resumo curto, ex.: "42 min · 4×800m Z4" ou "Agachamento, flexão, remada"'),
      durationMin: z.number().int(),
      zone: z.string().nullable().describe('Zona principal: Z1, Z2, Z3, Z4, Z5 ou Z1/Z2 (null para força)'),
      blocks: z.array(z.object({
        kind: z.enum(['warmup', 'steady', 'intervals', 'cooldown']),
        label: z.string(),
        detail: z.string(),
        zone: Zone,
        durationMin: z.number().int(),
        reps: z.number().int().nullable().describe('Só para intervals'),
        repDistanceM: z.number().int().nullable().describe('Só para intervals, em metros'),
        recoverySec: z.number().int().nullable().describe('Só para intervals'),
        targetPace: z.string().nullable().describe('Pace alvo "m:ss" por km, ou null'),
      })).describe('Blocos do treino aeróbico; vazio para força'),
      exercises: z.array(z.object({
        exerciseId: z.string().describe(`Um destes ids: ${exerciseIds.join(', ')}`),
        sets: z.number().int(),
        reps: z.number().int().describe('Repetições; para prancha, segundos'),
        restSec: z.number().int(),
      })).describe('Exercícios do treino de força; vazio para aeróbico'),
    })),
  });
}

const SYSTEM = `Você é o treinador do VANTA, um app de corrida + força. Monte um plano semanal (um modelo de semana que se repete durante o plano) a partir do perfil do atleta.

Regras:
- Use exatamente os dias disponíveis informados, um treino por dia.
- Respeite o tempo por sessão (durationMin próximo do disponível; o longão pode passar até 30%).
- Treinos aeróbicos têm aquecimento e desaquecimento em Z1/Z2. Iniciantes ou quem não corre: caminhada/trote em Z2, sem Z4/Z5.
- Intervalados (Z4) no máximo 1 por semana para iniciantes/intermediários; nunca em dias consecutivos com outro treino intenso.
- Treinos de força usam somente os exercícios da lista permitida (compatíveis com local e equipamentos), 3–5 exercícios.
- Equilibre corrida e força conforme o objetivo: objetivos de corrida priorizam corrida; ganho de força/massa priorizam força; os demais combinam.
- Se houver histórico recente, adapte: baixa aderência → reduza volume/intensidade; aderência alta e consistente → progrida levemente.
- Textos em português do Brasil, curtos, no estilo: "Corrida leve", "30 min · Z2", "4 × 800 m".`;

function profilePrompt(p: Profile, history: string): string {
  const allowed = availableExercises(p.equipment);
  const days = (p.days.length ? p.days : [1, 3, 5]).slice().sort((a, b) => a - b);
  return JSON.stringify({
    atleta: {
      nome: p.name || undefined, idade: p.age || undefined, peso_kg: p.weight || undefined, altura_cm: p.height || undefined,
    },
    objetivo: p.goal, meta_especifica: p.customTarget || undefined,
    capacidade: {
      corre_atualmente: p.runsNow,
      ...(p.runsNow ? { vezes_por_semana: p.freq, distancia_media_km: p.avgDist, pace_min_km: p.avgPace, maior_distancia_recente_km: p.maxDist } : {}),
      nivel_de_forca: p.strengthLevel,
    },
    disponibilidade: {
      dias: days.map((d) => ({ weekday: d, nome: DAY_LABELS[d][1] })),
      minutos_por_sessao: durationMinutes(p.duration),
      local: p.location,
      equipamentos: p.equipment,
    },
    exercicios_permitidos: allowed.map((e) => ({ exerciseId: e.id, nome: e.name, padrao: e.movement })),
    duracao_sugerida_semanas: PLAN_WEEKS,
  }, null, 2) + (history ? `\n\nHistórico recente:\n${history}` : '');
}

async function recentHistory(uid: string): Promise<string> {
  const since = isoDate(addDays(new Date(), -28));
  const [ws, as] = await Promise.all([
    db.collection(`users/${uid}/workouts`).where('date', '>=', since).get(),
    db.collection(`users/${uid}/activities`).where('date', '>=', since).get(),
  ]);
  const workouts = ws.docs.map((d) => d.data() as WorkoutLog);
  const runs = as.docs.map((d) => d.data() as Activity).filter((a) => a.isRun);
  if (!workouts.length && !runs.length) return '';
  const lines = [
    ...workouts.map((w) => `- ${w.date} ${w.title} (${w.type}): ${Math.round(w.durationSec / 60)} min, aderência ${w.adherence}%`),
    ...runs.map((a) => `- ${a.date} Strava corrida: ${(a.distanceM / 1000).toFixed(1)} km em ${Math.round(a.movingTimeSec / 60)} min${a.avgHr ? `, FC média ${Math.round(a.avgHr)}` : ''}`),
  ];
  return lines.sort().join('\n');
}

async function generateWithClaude(profile: Profile, history: string): Promise<Plan | null> {
  const allowedIds = availableExercises(profile.equipment).map((e) => e.id);
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), timeout: 110_000, maxRetries: 1 });
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(planSchema(allowedIds)) },
    system: SYSTEM,
    messages: [{ role: 'user', content: profilePrompt(profile, history) }],
  });
  if (response.stop_reason === 'refusal') {
    logger.warn('Plan generation refused', { details: response.stop_details });
    return null;
  }
  if (!response.parsed_output) {
    logger.warn('Plan generation returned no parsed output', { stop_reason: response.stop_reason });
    return null;
  }
  const plan = sanitizePlan(response.parsed_output, profile);
  if (plan && !plan.name) plan.name = planNameFor(profile.goal);
  return plan;
}

/**
 * Generates (or regenerates) the weekly plan from the stored profile and writes it
 * to users/{uid}.plan. Falls back to the rule-based plan if the AI call fails.
 */
export const generatePlan = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 180, memory: '512MiB' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para gerar o plano.');
  const snap = await db.doc(`users/${uid}`).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user?.profile) throw new HttpsError('failed-precondition', 'Perfil não encontrado.');

  let plan: Plan | null = null;
  try {
    plan = await generateWithClaude(user.profile, await recentHistory(uid));
  } catch (err) {
    logger.error('Claude plan generation failed; using rule-based plan', err);
  }
  if (!plan) plan = buildRulePlan(user.profile);

  await db.doc(`users/${uid}`).set({ plan, updatedAt: Date.now() }, { merge: true });
  return { plan };
});
