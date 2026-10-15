import { addDays, isoDate, parseIsoDate, weekStart } from './dates';
import { totalSessions } from './plan';
import type { Activity, Plan, PlanDay, WorkoutLog } from './types';

const ratio = (a: number, b: number) => (a <= 0 || b <= 0 ? 0 : Math.min(a, b) / Math.max(a, b));

/**
 * Aerobic adherence = how closely the session matched the plan: reps completed,
 * active time vs planned time and, when GPS distance exists, distance vs planned
 * interval distance. Each component weighs equally.
 */
export function aerobicAdherence(input: {
  plannedMin: number; actualSec: number; repsPlanned?: number; repsDone?: number;
  plannedDistanceM?: number; distanceM?: number;
}): number {
  const parts: number[] = [ratio(input.actualSec, input.plannedMin * 60)];
  if (input.repsPlanned) parts.push(Math.min(1, (input.repsDone ?? 0) / input.repsPlanned));
  if (input.plannedDistanceM && input.distanceM) parts.push(ratio(input.distanceM, input.plannedDistanceM));
  return Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100);
}

export function strengthAdherence(setsPlanned: number, setsDone: number): number {
  if (setsPlanned <= 0) return 0;
  return Math.round(Math.min(1, setsDone / setsPlanned) * 100);
}

/** Strava runs that don't duplicate a workout already logged in the app on the same day. */
function extraRuns(activities: Activity[], workouts: WorkoutLog[]): Activity[] {
  const appAerobicDates = new Set(workouts.filter((w) => w.type === 'aerobic').map((w) => w.date));
  return activities.filter((a) => a.isRun && !appAerobicDates.has(a.date));
}

/** Distance in meters across app workouts and Strava runs, preferring Strava when both exist for a day. */
export function totalRunDistanceM(workouts: WorkoutLog[], activities: Activity[]): number {
  const stravaRunDates = new Set(activities.filter((a) => a.isRun).map((a) => a.date));
  const app = workouts
    .filter((w) => w.type === 'aerobic' && !stravaRunDates.has(w.date))
    .reduce((s, w) => s + (w.distanceM ?? 0), 0);
  const strava = activities.filter((a) => a.isRun).reduce((s, a) => s + a.distanceM, 0);
  return app + strava;
}

export interface PlanProgress {
  done: number;
  total: number;
  adherence: number | null;
  distanceM: number;
}

export function planProgress(plan: Plan, workouts: WorkoutLog[], activities: Activity[]): PlanProgress {
  const inPlan = workouts.filter((w) => w.date >= plan.startDate);
  const acts = activities.filter((a) => a.date >= plan.startDate);
  const extra = extraRuns(acts, inPlan);
  const adh = inPlan.map((w) => w.adherence);
  return {
    done: inPlan.length + extra.length,
    total: totalSessions(plan),
    adherence: adh.length ? Math.round(adh.reduce((s, x) => s + x, 0) / adh.length) : null,
    distanceM: totalRunDistanceM(inPlan, acts),
  };
}

export interface MonthSummary {
  sessions: number;
  adherence: number | null;
  runDistanceM: number;
  strengthSessions: number;
}

export function monthSummary(workouts: WorkoutLog[], activities: Activity[], today: Date = new Date()): MonthSummary {
  const from = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const ws = workouts.filter((w) => w.date >= from);
  const as = activities.filter((a) => a.date >= from);
  const extra = extraRuns(as, ws);
  const otherStrava = as.filter((a) => !a.isRun);
  const adh = ws.map((w) => w.adherence);
  return {
    sessions: ws.length + extra.length + otherStrava.length,
    adherence: adh.length ? Math.round(adh.reduce((s, x) => s + x, 0) / adh.length) : null,
    runDistanceM: totalRunDistanceM(ws, as),
    strengthSessions: ws.filter((w) => w.type === 'strength').length
      + otherStrava.filter((a) => /weight|workout|crossfit/i.test(a.sportType)).length,
  };
}

export const PERIOD_DAYS: Record<string, number> = {
  '7 dias': 7, '30 dias': 30, '3 meses': 91, '6 meses': 182, '1 ano': 365,
};

export interface PaceBar {
  label: string;
  /** Average seconds per km, null when no run that week. */
  paceSecPerKm: number | null;
  /** 0–100 bar height: faster = taller. */
  heightPct: number;
}

/**
 * Average pace per week over the selected period (max 8 bars, like the design).
 * Uses Strava runs plus app runs that recorded GPS distance.
 */
export function paceByWeek(workouts: WorkoutLog[], activities: Activity[], periodDays: number, today: Date = new Date()): PaceBar[] {
  const weeks = Math.min(8, Math.max(1, Math.ceil(periodDays / 7)));
  const stravaRunDates = new Set(activities.filter((a) => a.isRun).map((a) => a.date));
  const runs: { date: string; distanceM: number; sec: number }[] = [
    ...activities.filter((a) => a.isRun && a.distanceM > 0).map((a) => ({ date: a.date, distanceM: a.distanceM, sec: a.movingTimeSec })),
    ...workouts.filter((w) => w.type === 'aerobic' && (w.distanceM ?? 0) > 200 && !stravaRunDates.has(w.date))
      .map((w) => ({ date: w.date, distanceM: w.distanceM!, sec: w.durationSec })),
  ];
  const lastStart = weekStart(today);
  const raw = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(lastStart, -7 * (weeks - 1 - i));
    const from = isoDate(start);
    const to = isoDate(addDays(start, 7));
    const wk = runs.filter((r) => r.date >= from && r.date < to);
    const dist = wk.reduce((s, r) => s + r.distanceM, 0);
    const sec = wk.reduce((s, r) => s + r.sec, 0);
    return { label: `S${i + 1}`, paceSecPerKm: dist > 0 ? sec / (dist / 1000) : null };
  });
  const paces = raw.map((r) => r.paceSecPerKm).filter((p): p is number => p != null);
  const slowest = Math.max(...paces);
  const fastest = Math.min(...paces);
  return raw.map((r) => ({
    ...r,
    heightPct: r.paceSecPerKm == null ? 4
      : slowest === fastest ? 70
      : Math.round(35 + ((slowest - r.paceSecPerKm) / (slowest - fastest)) * 50),
  }));
}

export interface DeviceMetric { label: string; value: string }

/** Metrics shown in "Dados do dispositivo". Strava has no sleep or VO2 max data. */
export function deviceMetrics(activities: Activity[], today: Date = new Date()): DeviceMetric[] {
  const since30 = isoDate(addDays(today, -30));
  const since7 = isoDate(addDays(today, -7));
  const recent = activities.filter((a) => a.date >= since30);
  const hr = recent.filter((a) => a.avgHr).map((a) => a.avgHr!);
  const cad = recent.filter((a) => a.isRun && a.avgCadence).map((a) => a.avgCadence!);
  const load = activities.filter((a) => a.date >= since7).reduce((s, a) => s + (a.sufferScore ?? 0), 0);
  const avg = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return [
    { label: 'Freq. cardíaca média', value: hr.length ? `${avg(hr)} bpm` : '—' },
    { label: 'Carga de treino (7d)', value: load ? `${Math.round(load)} pts` : '—' },
    { label: 'Sono médio', value: '— (requer Garmin)' },
    { label: 'VO2 max estimado', value: '— (requer Garmin)' },
    { label: 'Cadência média', value: cad.length ? `${avg(cad)} spm` : '—' },
  ];
}

export type DayStatus = 'done' | 'today' | 'next' | 'scheduled' | 'missed' | 'beforeStart';

/** Status of each plan day within the current week (Plano tab). */
export function weekStatuses(plan: Plan, workouts: WorkoutLog[], activities: Activity[], today: Date = new Date()): Map<string, DayStatus> {
  const ws = weekStart(today);
  const from = isoDate(ws);
  const to = isoDate(addDays(ws, 7));
  const todayIso = isoDate(today);
  const out = new Map<string, DayStatus>();
  let nextAssigned = false;
  for (const day of plan.days) {
    const date = isoDate(addDays(ws, day.weekday));
    const doneEarly = workouts.some((w) => w.planDayId === day.id && w.date >= from && w.date < to);
    if (doneEarly || isDone(day, date, workouts, activities)) { out.set(day.id, 'done'); continue; }
    // Sessions that fell before the plan existed are not "missed".
    if (date < todayIso) { out.set(day.id, date < isoDate(new Date(plan.generatedAt)) ? 'beforeStart' : 'missed'); continue; }
    if (date === todayIso) { out.set(day.id, 'today'); continue; }
    out.set(day.id, nextAssigned ? 'scheduled' : 'next');
    nextAssigned = true;
  }
  return out;
}

export function isDone(day: PlanDay, date: string, workouts: WorkoutLog[], activities: Activity[]): boolean {
  // A workout counts for its own plan day; unplanned ones count for a same-type session that day.
  if (workouts.some((w) => w.date === date && w.type === day.type && (!w.planDayId || w.planDayId === day.id))) return true;
  // A run recorded on Strava that day counts for an aerobic session.
  return day.type === 'aerobic' && activities.some((a) => a.date === date && a.isRun);
}

export function workoutOn(date: string, workouts: WorkoutLog[]): WorkoutLog | undefined {
  return workouts.filter((w) => w.date === date).sort((a, b) => b.finishedAt - a.finishedAt)[0];
}

export function dayFromIso(s: string): Date { return parseIsoDate(s); }

// ---------- Strava normalization ----------

/** Subset of Strava's DetailedActivity / SummaryActivity that we read. */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  suffer_score?: number | null;
  total_elevation_gain?: number;
}

export function normalizeStravaActivity(a: StravaActivity): Activity {
  const sport = a.sport_type ?? a.type ?? 'Workout';
  const isRun = /run/i.test(sport);
  return {
    id: String(a.id),
    source: 'strava',
    name: a.name,
    sportType: sport,
    isRun,
    startDate: a.start_date,
    // start_date_local is the athlete's wall-clock time encoded with a "Z" suffix.
    date: a.start_date_local.slice(0, 10),
    distanceM: a.distance ?? 0,
    movingTimeSec: a.moving_time ?? 0,
    elapsedTimeSec: a.elapsed_time ?? 0,
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    // Strava reports run cadence per leg (rpm); double it for steps per minute.
    avgCadence: a.average_cadence != null ? Math.round(a.average_cadence * (isRun ? 2 : 1)) : null,
    sufferScore: a.suffer_score ?? null,
    elevationGainM: a.total_elevation_gain ?? null,
  };
}
