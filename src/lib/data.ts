import {
  addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, type Unsubscribe, where,
} from 'firebase/firestore';
import { addDays, isoDate } from '../../shared/dates';
import type { Activity, OnboardingStep, Plan, Profile, Settings, UserDoc, WorkoutLog } from '../../shared/types';
import { db } from './firebase';

export const EMPTY_PROFILE: Profile = {
  name: '', age: '', weight: '', height: '', goal: null, customTarget: '',
  runsNow: null, freq: '', avgDist: '', avgPace: '', maxDist: '', strengthLevel: null,
  days: [], duration: null, location: null, equipment: [],
};

export const DEFAULT_SETTINGS: Settings = { notifications: true, theme: 'Sistema', unit: 'km', gps: true, saveData: true };

const userRef = (uid: string) => doc(db, 'users', uid);

/** Creates the user document on first login if it doesn't exist yet. */
export async function ensureUserDoc(uid: string, settings: Settings, name?: string | null) {
  const snap = await getDoc(userRef(uid));
  if (snap.exists()) return;
  const fresh: UserDoc = {
    profile: { ...EMPTY_PROFILE, name: name ?? '' },
    settings,
    onboardingStep: 'basic',
    updatedAt: Date.now(),
  };
  await setDoc(userRef(uid), fresh);
}

export function watchUser(uid: string, cb: (u: UserDoc | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(userRef(uid), (s) => cb(s.exists() ? (s.data() as UserDoc) : null), onError);
}

export function saveProfile(uid: string, profile: Profile) {
  return setDoc(userRef(uid), { profile, updatedAt: Date.now() }, { merge: true });
}

export function saveSettings(uid: string, settings: Settings) {
  return setDoc(userRef(uid), { settings, updatedAt: Date.now() }, { merge: true });
}

export function saveStep(uid: string, onboardingStep: OnboardingStep) {
  return setDoc(userRef(uid), { onboardingStep, updatedAt: Date.now() }, { merge: true });
}

export function savePlan(uid: string, plan: Plan) {
  return setDoc(userRef(uid), { plan, updatedAt: Date.now() }, { merge: true });
}

/** Workouts from the last year (enough for every Evolução period). */
export function watchWorkouts(uid: string, cb: (w: WorkoutLog[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'workouts'),
    where('date', '>=', isoDate(addDays(new Date(), -366))),
    orderBy('date', 'desc'),
    limit(500),
  );
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as WorkoutLog), id: d.id }))));
}

export function watchActivities(uid: string, cb: (a: Activity[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'activities'),
    where('date', '>=', isoDate(addDays(new Date(), -366))),
    orderBy('date', 'desc'),
    limit(1000),
  );
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as Activity)));
}

export function addWorkout(uid: string, w: WorkoutLog) {
  const clean = Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined));
  return addDoc(collection(db, 'users', uid, 'workouts'), clean);
}
