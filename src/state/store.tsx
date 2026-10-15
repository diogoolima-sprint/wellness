import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { buildRulePlan, profileKey } from '../../shared/plan';
import type { Activity, OnboardingStep, Plan, Profile, Settings, UserDoc, WorkoutLog } from '../../shared/types';
import { generatePlanRemote } from '../lib/api';
import {
  addWorkout, DEFAULT_SETTINGS, EMPTY_PROFILE, ensureUserDoc, savePlan, saveProfile, saveSettings, saveStep,
  watchActivities, watchUser, watchWorkouts,
} from '../lib/data';
import { auth, firebaseConfigured } from '../lib/firebase';
import { getLocal, setLocal } from '../lib/localPrefs';
import { scheduleWorkoutReminders } from '../lib/notifications';
import { applyTheme, onSystemThemeChange } from '../lib/theme';

export type Tab = 'hoje' | 'plano' | 'treinos' | 'evolucao' | 'perfil';
export type Detail =
  | 'workoutDetail' | 'aerobicExec' | 'aerobicResult'
  | 'strengthDetail' | 'strengthExec' | 'strengthResult'
  | 'exerciseDetail' | 'sobre' | 'config'
  | 'dadosPessoais' | 'objetivo' | 'capacidade' | 'disponibilidade' | 'equipamentos';
export type Stage = 'splash' | 'welcome' | 'auth' | 'loading' | 'setup' | OnboardingStep;

const PROFILE_OVERLAYS: Detail[] = ['dadosPessoais', 'objetivo', 'capacidade', 'disponibilidade', 'equipamentos'];

interface Store {
  stage: Stage;
  user: User | null;
  userDoc: UserDoc | null;
  profile: Profile;
  settings: Settings;
  plan: Plan | undefined;
  workouts: WorkoutLog[];
  activities: Activity[];
  activeTab: Tab;
  detail: Detail | null;
  selectedDayId: string | null;
  selectedExercise: string | null;
  integracoesOpen: boolean;
  activeFilter: string;
  lastResult: WorkoutLog | null;
  toast: string | null;
  planUpdating: boolean;

  leaveSplash: () => void;
  goAuth: () => void;
  goWelcome: () => void;
  setStep: (s: OnboardingStep) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  generatePlan: () => Promise<void>;
  selectTab: (t: Tab) => void;
  openDetail: (d: Detail, opts?: { dayId?: string; exerciseId?: string }) => void;
  closeDetail: () => void;
  setIntegracoesOpen: (v: boolean) => void;
  setActiveFilter: (f: string) => void;
  finishWorkout: (w: WorkoutLog, next: Detail) => Promise<void>;
  showToast: (msg: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

const MIN_GENERATING_MS = 1800;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [settings, setSettings] = useState<Settings>(getLocal('settings') ?? DEFAULT_SETTINGS);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [splashDone, setSplashDone] = useState(false);
  const [preAuth, setPreAuth] = useState<'welcome' | 'auth'>('welcome');
  const [localStep, setLocalStep] = useState<OnboardingStep | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('hoje');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [integracoesOpen, setIntegracoesOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('30 dias');
  const [lastResult, setLastResult] = useState<WorkoutLog | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [planUpdating, setPlanUpdating] = useState(false);

  const profileDirty = useRef(false);
  const profileTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const uid = user?.uid;

  // ---- Auth & data subscriptions ----
  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return; }
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!uid) { setUserDoc(null); setWorkouts([]); setActivities([]); return; }
    let unsubs: (() => void)[] = [];
    let cancelled = false;
    ensureUserDoc(uid, getLocal('settings') ?? DEFAULT_SETTINGS, user?.displayName)
      .catch((e) => console.warn('ensureUserDoc failed (offline?)', e))
      .finally(() => {
        if (cancelled) return;
        unsubs = [
          watchUser(uid, (d) => {
            setUserDoc(d);
            if (!d) return;
            if (!profileDirty.current) setProfile({ ...EMPTY_PROFILE, ...d.profile });
            if (d.settings) {
              setSettings(d.settings);
              setLocal('settings', d.settings);
            }
          }, (e) => console.error(e)),
          watchWorkouts(uid, setWorkouts),
          watchActivities(uid, setActivities),
        ];
      });
    return () => { cancelled = true; unsubs.forEach((u) => u()); };
  }, [uid, user?.displayName]);

  // ---- Theme ----
  useEffect(() => {
    applyTheme(settings.theme);
    return onSystemThemeChange(() => { if (settings.theme === 'Sistema') applyTheme('Sistema'); });
  }, [settings.theme]);

  // ---- Reminders follow plan + notifications setting ----
  const plan = userDoc?.plan;
  useEffect(() => {
    scheduleWorkoutReminders(plan, settings.notifications).catch((e) => console.warn('reminders', e));
  }, [plan, settings.notifications]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ---- Stage machine ----
  const step: OnboardingStep | undefined = localStep ?? userDoc?.onboardingStep;
  let stage: Stage;
  if (!splashDone || user === undefined) stage = 'splash';
  else if (!firebaseConfigured) stage = 'setup';
  else if (!user) stage = preAuth;
  else if (!userDoc || !step) stage = 'loading';
  else stage = step;

  const setStep = useCallback((s: OnboardingStep) => {
    setLocalStep(s);
    if (uid) saveStep(uid, s).catch((e) => console.warn(e));
  }, [uid]);

  // Once Firestore reflects the step, drop the local override.
  useEffect(() => {
    if (localStep && userDoc?.onboardingStep === localStep) setLocalStep(null);
  }, [localStep, userDoc?.onboardingStep]);

  const flushProfile = useCallback((p: Profile) => {
    window.clearTimeout(profileTimer.current);
    if (!uid) return;
    saveProfile(uid, p)
      .catch((e) => console.warn(e))
      .finally(() => { profileDirty.current = false; });
  }, [uid]);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    profileDirty.current = true;
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      window.clearTimeout(profileTimer.current);
      profileTimer.current = window.setTimeout(() => flushProfile(next), 500);
      return next;
    });
  }, [flushProfile]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      setLocal('settings', next);
      if (uid) saveSettings(uid, next).catch((e) => console.warn(e));
      return next;
    });
  }, [uid]);

  const profileRef = useRef(profile);
  profileRef.current = profile;

  /** Calls the AI generator; falls back to the local rule-based plan when offline/unavailable. */
  const regenerate = useCallback(async (): Promise<Plan> => {
    const p = profileRef.current;
    if (uid) await saveProfile(uid, p).catch(() => undefined);
    try {
      return await generatePlanRemote();
    } catch (err) {
      console.warn('generatePlan failed, using rule-based plan', err);
      const fallback = buildRulePlan(p);
      if (uid) await savePlan(uid, fallback).catch(() => undefined);
      return fallback;
    }
  }, [uid]);

  const generating = useRef(false);
  const generatePlan = useCallback(async () => {
    if (generating.current) return;
    generating.current = true;
    try {
      setDetail(null);
      setStep('generating');
      const t0 = Date.now();
      await regenerate();
      const wait = MIN_GENERATING_MS - (Date.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setStep('created');
    } finally {
      generating.current = false;
    }
  }, [regenerate, setStep]);

  // If the app was closed mid-generation, resume it once per launch.
  const resumed = useRef(false);
  useEffect(() => {
    if (!resumed.current && userDoc?.onboardingStep === 'generating' && !generating.current) {
      resumed.current = true;
      generatePlan();
    }
  }, [userDoc?.onboardingStep, generatePlan]);

  const regenerateInBackground = useCallback(async () => {
    setPlanUpdating(true);
    showToast('Atualizando seu plano…');
    await regenerate();
    setPlanUpdating(false);
    showToast('Plano atualizado ✓');
  }, [regenerate, showToast]);

  const selectTab = useCallback((t: Tab) => { setActiveTab(t); setDetail(null); }, []);

  const openDetail = useCallback((d: Detail, opts?: { dayId?: string; exerciseId?: string }) => {
    if (opts?.dayId !== undefined) setSelectedDayId(opts.dayId);
    if (opts?.exerciseId !== undefined) setSelectedExercise(opts.exerciseId);
    setDetail(d);
  }, []);

  const closeDetail = useCallback(() => {
    const wasProfileEdit = detail && PROFILE_OVERLAYS.includes(detail);
    setDetail(null);
    if (wasProfileEdit) {
      flushProfile(profileRef.current);
      // Editing goal/capacity/availability/equipment re-runs the plan generator.
      if (plan && plan.profileKey && plan.profileKey !== profileKey(profileRef.current)) regenerateInBackground();
    }
  }, [detail, flushProfile, plan, regenerateInBackground]);

  const finishWorkout = useCallback(async (w: WorkoutLog, next: Detail) => {
    setLastResult(w);
    setDetail(next);
    if (uid) await addWorkout(uid, w).catch((e) => console.warn(e));
  }, [uid]);

  const value = useMemo<Store>(() => ({
    stage, user: user ?? null, userDoc, profile, settings, plan, workouts, activities,
    activeTab, detail, selectedDayId, selectedExercise, integracoesOpen, activeFilter, lastResult, toast, planUpdating,
    leaveSplash: () => setSplashDone(true),
    goAuth: () => setPreAuth('auth'),
    goWelcome: () => setPreAuth('welcome'),
    setStep, updateProfile, updateSettings, generatePlan, selectTab, openDetail, closeDetail,
    setIntegracoesOpen, setActiveFilter, finishWorkout, showToast,
  }), [stage, user, userDoc, profile, settings, plan, workouts, activities, activeTab, detail, selectedDayId,
    selectedExercise, integracoesOpen, activeFilter, lastResult, toast, planUpdating, setStep, updateProfile,
    updateSettings, generatePlan, selectTab, openDetail, closeDetail, finishWorkout, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
