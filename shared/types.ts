// Domain model shared by the app (src/) and Cloud Functions (functions/).

export interface Profile {
  name: string;
  age: string;
  weight: string;
  height: string;
  goal: string | null;
  customTarget: string;
  runsNow: boolean | null;
  freq: string;
  avgDist: string;
  avgPace: string;
  maxDist: string;
  strengthLevel: string | null;
  /** Weekday indexes, 0 = Domingo … 6 = Sábado. */
  days: number[];
  duration: string | null;
  location: string | null;
  equipment: string[];
}

export type ThemeSetting = 'Sistema' | 'Claro' | 'Escuro';
export type UnitSetting = 'km' | 'mi';

export interface Settings {
  notifications: boolean;
  theme: ThemeSetting;
  unit: UnitSetting;
  gps: boolean;
  saveData: boolean;
}

export type Zone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'Z1/Z2';

export type BlockKind = 'warmup' | 'steady' | 'intervals' | 'cooldown';

export interface AerobicBlock {
  kind: BlockKind;
  label: string;
  detail: string;
  zone: Zone;
  /** Planned duration of the whole block, in minutes (used by warmup/steady/cooldown). */
  durationMin: number;
  /** Interval blocks only. */
  reps?: number;
  repDistanceM?: number;
  recoverySec?: number;
  /** Target pace in "m:ss" per km, if any. */
  targetPace?: string;
}

export interface StrengthItem {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  restSec: number;
}

export interface PlanDay {
  id: string;
  /** 0 = Domingo … 6 = Sábado */
  weekday: number;
  type: 'aerobic' | 'strength';
  title: string;
  subtitle: string;
  durationMin: number;
  zone: Zone | null;
  blocks: AerobicBlock[];
  exercises: StrengthItem[];
}

export interface Plan {
  name: string;
  weeks: number;
  sessionsPerWeek: number;
  summary: string;
  /** ISO date (yyyy-mm-dd) of the Sunday that starts week 1. */
  startDate: string;
  days: PlanDay[];
  source: 'ai' | 'rules';
  generatedAt: number;
  /** profileKey() of the profile the plan was generated from. */
  profileKey?: string;
}

export interface StravaIntegration {
  connected: boolean;
  athleteId?: number;
  athleteName?: string;
  connectedAt?: number;
  lastSyncAt?: number;
}

export interface Integrations {
  strava?: StravaIntegration;
}

export type OnboardingStep =
  | 'basic'
  | 'goal'
  | 'capacity'
  | 'availability'
  | 'generating'
  | 'created'
  | 'app';

export interface UserDoc {
  profile: Profile;
  settings: Settings;
  onboardingStep: OnboardingStep;
  plan?: Plan;
  integrations?: Integrations;
  updatedAt?: number;
}

/** A workout performed inside the app (users/{uid}/workouts). */
export interface WorkoutLog {
  id?: string;
  /** Local date yyyy-mm-dd */
  date: string;
  planDayId: string | null;
  type: 'aerobic' | 'strength';
  title: string;
  startedAt: number;
  finishedAt: number;
  /** Active time in seconds (pauses excluded). */
  durationSec: number;
  /** 0–100 */
  adherence: number;
  distanceM?: number;
  plannedDurationMin?: number;
  repsPlanned?: number;
  repsDone?: number;
  setsPlanned?: number;
  setsDone?: number;
  /** Planned vs. done rows shown on the result screen. */
  details?: { label: string; planned: string; actual: string }[];
}

/** A Strava activity normalized into VANTA's model (users/{uid}/activities). */
export interface Activity {
  id: string;
  source: 'strava';
  name: string;
  sportType: string;
  isRun: boolean;
  /** ISO timestamp */
  startDate: string;
  /** Local date yyyy-mm-dd */
  date: string;
  distanceM: number;
  movingTimeSec: number;
  elapsedTimeSec: number;
  avgHr: number | null;
  maxHr: number | null;
  /** Steps per minute (both feet) for runs. */
  avgCadence: number | null;
  /** Strava "relative effort" (suffer score). */
  sufferScore: number | null;
  elevationGainM: number | null;
}
