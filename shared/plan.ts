import { availableExercises, durationMinutes, exerciseById, STRENGTH_LEVELS } from './catalog';
import { addDays, daysBetween, isoDate, parseIsoDate, weekStart } from './dates';
import type { AerobicBlock, Plan, PlanDay, Profile, StrengthItem, Zone } from './types';

export const PLAN_WEEKS = 8;
const ZONES: Zone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1/Z2'];

export function planNameFor(goal: string | null): string {
  const g = (goal ?? '').toLowerCase();
  if (g.includes('5 km')) return 'Plano 5K';
  if (g.includes('10 km')) return 'Plano 10K';
  return 'Plano Condicionamento + Força';
}

type GoalFocus = 'run' | 'strength' | 'mixed';

export function goalFocus(goal: string | null): GoalFocus {
  switch (goal) {
    case 'Começar a correr': case 'Correr 5 km': case 'Correr 10 km':
    case 'Aumentar distância': case 'Melhorar pace': case 'Melhorar condicionamento':
      return 'run';
    case 'Ganho de força': case 'Ganho de massa muscular':
      return 'strength';
    default:
      return 'mixed';
  }
}

function trainingDays(profile: Profile): number[] {
  const d = [...new Set(profile.days)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  return d.length ? d : [1, 3, 5];
}

function strengthSession(profile: Profile, variant: number, minutes: number): StrengthItem[] {
  const pool = availableExercises(profile.equipment);
  const levelIdx = Math.max(0, STRENGTH_LEVELS.indexOf((profile.strengthLevel ?? 'Iniciante') as never));
  const reps = [10, 12, 12, 10][levelIdx] ?? 12;
  const sets = levelIdx >= 2 ? 4 : 3;
  const count = minutes <= 15 ? 3 : minutes <= 30 ? 3 : 4;
  const picked: StrengthItem[] = [];
  for (let i = 0; i < pool.length && picked.length < count; i++) {
    const ex = pool[(i + variant * 2) % pool.length];
    if (picked.some((p) => p.exerciseId === ex.id)) continue;
    const isHold = ex.id === 'prancha';
    picked.push({ exerciseId: ex.id, name: ex.name, sets, reps: isHold ? 30 : reps, restSec: levelIdx >= 2 ? 90 : 60 });
  }
  return picked;
}

function strengthDay(profile: Profile, weekday: number, variant: number, minutes: number): PlanDay {
  const exercises = strengthSession(profile, variant, minutes);
  return {
    id: `d${weekday}`, weekday, type: 'strength', title: 'Força',
    subtitle: exercises.map((e) => e.name.toLowerCase()).join(', ').replace(/^./, (c) => c.toUpperCase()),
    durationMin: minutes, zone: null, blocks: [], exercises,
  };
}

function easyRun(weekday: number, minutes: number, beginner: boolean, long = false): PlanDay {
  const warm = Math.min(10, Math.round(minutes * 0.2));
  const main = Math.max(5, minutes - warm * 2);
  const title = beginner ? 'Caminhada + trote' : long ? 'Longão' : 'Corrida leve';
  return {
    id: `d${weekday}`, weekday, type: 'aerobic', title,
    subtitle: `${minutes} min · Z2`, durationMin: minutes, zone: 'Z2', exercises: [],
    blocks: [
      { kind: 'warmup', label: 'Aquecimento', detail: `${warm} min`, zone: 'Z1/Z2', durationMin: warm },
      { kind: 'steady', label: beginner ? 'Alternar 1 min trote / 2 min caminhada' : 'Corrida contínua', detail: `${main} min`, zone: 'Z2', durationMin: main },
      { kind: 'cooldown', label: 'Desaquecimento', detail: `${warm} min`, zone: 'Z1/Z2', durationMin: warm },
    ],
  };
}

function intervalRun(weekday: number, minutes: number): PlanDay {
  const reps = minutes >= 45 ? 4 : 3;
  const warm = minutes >= 45 ? 10 : 8;
  return {
    id: `d${weekday}`, weekday, type: 'aerobic', title: 'Intervalado',
    subtitle: `${minutes} min · ${reps}×800m Z4`, durationMin: minutes, zone: 'Z4', exercises: [],
    blocks: [
      { kind: 'warmup', label: 'Aquecimento', detail: `${warm} min`, zone: 'Z1/Z2', durationMin: warm },
      { kind: 'intervals', label: `Intervalado — ${reps} × 800 m`, detail: 'Recuperação 2 min entre séries', zone: 'Z4',
        durationMin: Math.max(10, minutes - warm * 2), reps, repDistanceM: 800, recoverySec: 120 },
      { kind: 'cooldown', label: 'Desaquecimento', detail: `${warm} min`, zone: 'Z1/Z2', durationMin: warm },
    ],
  };
}

/**
 * Deterministic plan used when the AI generator is unavailable. Produces the same
 * shape the AI is asked for, so the app never has to care where a plan came from.
 */
export function buildRulePlan(profile: Profile, today: Date = new Date()): Plan {
  const days = trainingDays(profile);
  const minutes = durationMinutes(profile.duration);
  const focus = goalFocus(profile.goal);
  const beginner = profile.runsNow !== true;
  const n = days.length;

  // How many of the weekly sessions are strength.
  const strengthCount = focus === 'strength' ? Math.max(1, n - 1) : focus === 'run' ? (n >= 3 ? 1 : 0) : Math.floor(n / 2);
  // Spread strength sessions across the week.
  const strengthIdx = new Set<number>();
  for (let i = 0; i < strengthCount; i++) strengthIdx.add(Math.min(n - 1, Math.round(((i + 0.5) * n) / strengthCount - 0.5)));

  let aerobicSeen = 0;
  let strengthSeen = 0;
  const aerobicTotal = n - strengthIdx.size;
  const planDays = days.map((weekday, i): PlanDay => {
    if (strengthIdx.has(i)) return strengthDay(profile, weekday, strengthSeen++, minutes);
    const k = aerobicSeen++;
    const isLast = k === aerobicTotal - 1 && aerobicTotal >= 3;
    if (isLast) return easyRun(weekday, Math.min(90, Math.round(minutes * 1.3)), beginner, true);
    if (!beginner && k === 1) return intervalRun(weekday, minutes);
    return easyRun(weekday, minutes, beginner);
  });

  return {
    name: planNameFor(profile.goal),
    weeks: PLAN_WEEKS,
    sessionsPerWeek: n,
    summary: `${PLAN_WEEKS} semanas · ${n} treinos por semana`,
    startDate: isoDate(weekStart(today)),
    days: planDays,
    source: 'rules',
    generatedAt: Date.now(),
    profileKey: profileKey(profile),
  };
}

/**
 * Coerces an untrusted plan (e.g. LLM output) into a valid Plan. Returns null when
 * the plan is unusable so the caller can fall back to the rule-based one.
 */
export function sanitizePlan(raw: unknown, profile: Profile, today: Date = new Date()): Plan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawDays = Array.isArray(r.days) ? r.days : [];
  const allowed = new Set(availableExercises(profile.equipment).map((e) => e.id));
  const seen = new Set<number>();
  const days: PlanDay[] = [];
  for (const d of rawDays as Record<string, unknown>[]) {
    const weekday = Number(d.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || seen.has(weekday)) continue;
    const type = d.type === 'strength' ? 'strength' : 'aerobic';
    const zone = ZONES.includes(d.zone as Zone) ? (d.zone as Zone) : null;
    const blocks: AerobicBlock[] = type === 'aerobic' && Array.isArray(d.blocks)
      ? (d.blocks as Record<string, unknown>[]).map((b): AerobicBlock => ({
          kind: (['warmup', 'steady', 'intervals', 'cooldown'] as const).includes(b.kind as never) ? (b.kind as AerobicBlock['kind']) : 'steady',
          label: String(b.label ?? 'Bloco'),
          detail: String(b.detail ?? ''),
          zone: ZONES.includes(b.zone as Zone) ? (b.zone as Zone) : 'Z2',
          durationMin: clampNum(b.durationMin, 1, 180, 10),
          ...(b.kind === 'intervals' ? {
            reps: clampNum(b.reps, 1, 20, 4),
            repDistanceM: clampNum(b.repDistanceM, 100, 5000, 800),
            recoverySec: clampNum(b.recoverySec, 15, 600, 120),
          } : {}),
          ...(typeof b.targetPace === 'string' && /^\d{1,2}:\d{2}$/.test(b.targetPace) ? { targetPace: b.targetPace } : {}),
        }))
      : [];
    const exercises: StrengthItem[] = type === 'strength' && Array.isArray(d.exercises)
      ? (d.exercises as Record<string, unknown>[])
          .filter((e) => allowed.has(String(e.exerciseId)))
          .map((e) => ({
            exerciseId: String(e.exerciseId),
            name: exerciseById(String(e.exerciseId))!.name,
            sets: clampNum(e.sets, 1, 8, 3),
            reps: clampNum(e.reps, 1, 60, 12),
            restSec: clampNum(e.restSec, 15, 300, 60),
          }))
      : [];
    if (type === 'aerobic' && blocks.length === 0) continue;
    if (type === 'strength' && exercises.length === 0) continue;
    seen.add(weekday);
    days.push({
      id: `d${weekday}`, weekday, type,
      title: String(d.title ?? (type === 'strength' ? 'Força' : 'Corrida')).slice(0, 40),
      subtitle: String(d.subtitle ?? '').slice(0, 60),
      durationMin: clampNum(d.durationMin, 5, 240, 45),
      zone, blocks, exercises,
    });
  }
  if (days.length === 0) return null;
  days.sort((a, b) => a.weekday - b.weekday);
  const weeks = clampNum(r.weeks, 4, 16, PLAN_WEEKS);
  return {
    name: String(r.name ?? planNameFor(profile.goal)).slice(0, 40),
    weeks,
    sessionsPerWeek: days.length,
    summary: `${weeks} semanas · ${days.length} treinos por semana`,
    startDate: isoDate(weekStart(today)),
    days,
    source: 'ai',
    generatedAt: Date.now(),
    profileKey: profileKey(profile),
  };
}

function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Fingerprint of the profile fields that shape the plan; a change means the plan should be regenerated. */
export function profileKey(p: Profile): string {
  return JSON.stringify([
    p.goal, p.customTarget, p.runsNow, p.freq, p.avgDist, p.avgPace, p.maxDist, p.strengthLevel,
    [...p.days].sort(), p.duration, p.location, [...p.equipment].sort(),
  ]);
}

// ---------- Schedule helpers ----------

/** 1-based week of the plan for `today`, clamped to [1, weeks]. */
export function currentWeek(plan: Plan, today: Date = new Date()): number {
  const w = Math.floor(daysBetween(parseIsoDate(plan.startDate), today) / 7) + 1;
  return Math.min(plan.weeks, Math.max(1, w));
}

export function planDayFor(plan: Plan, date: Date): PlanDay | undefined {
  return plan.days.find((d) => d.weekday === date.getDay());
}

/** Next scheduled session strictly after `today`. */
export function nextSession(plan: Plan, today: Date = new Date()): { day: PlanDay; date: Date } | null {
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const day = planDayFor(plan, date);
    if (day) return { day, date };
  }
  return null;
}

/** Date of a plan day inside the current week. */
export function dateInWeek(day: PlanDay, today: Date = new Date()): Date {
  return addDays(weekStart(today), day.weekday);
}

export function totalSessions(plan: Plan): number {
  return plan.weeks * plan.sessionsPerWeek;
}

export function isPlanFinished(plan: Plan, today: Date = new Date()): boolean {
  return daysBetween(parseIsoDate(plan.startDate), today) >= plan.weeks * 7;
}
