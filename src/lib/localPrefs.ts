// Small per-device preferences kept outside Firestore (needed before login/Firestore init).
import type { Settings } from '../../shared/types';

const KEY = 'vanta-local';

interface LocalPrefs {
  /** Cached settings so theme/units apply before the user doc loads. */
  settings?: Settings;
  /** Resized welcome photo (data URL). */
  welcomePhoto?: string;
  /** ExerciseDB GIF URLs found through the fallback lookup. */
  gifCache?: Record<string, string>;
}

function read(): LocalPrefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as LocalPrefs;
  } catch {
    return {};
  }
}

function write(p: LocalPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or unavailable */
  }
}

export function getLocal<K extends keyof LocalPrefs>(k: K): LocalPrefs[K] {
  return read()[k];
}

export function setLocal<K extends keyof LocalPrefs>(k: K, v: LocalPrefs[K]) {
  write({ ...read(), [k]: v });
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
