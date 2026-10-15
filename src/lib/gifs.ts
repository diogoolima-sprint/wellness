import { EXERCISES, type Exercise } from '../../shared/catalog';
import { getLocal, setLocal } from './localPrefs';

const inflight = new Map<string, Promise<string | null>>();

export function cachedGif(ex: Exercise): string | null {
  return ex.gifUrl ?? getLocal('gifCache')?.[ex.id] ?? null;
}

/**
 * Looks an exercise's GIF up on ExerciseDB (AscendAPI free tier) by its English name.
 * Same matching as the prototype: exact name, else bodyweight variants, else the shortest match.
 */
export function loadGif(ex: Exercise): Promise<string | null> {
  const known = cachedGif(ex);
  if (known) return Promise.resolve(known);
  const running = inflight.get(ex.id);
  if (running) return running;
  const p = fetch(`https://oss.exercisedb.dev/api/v1/exercises?name=${encodeURIComponent(ex.apiQuery)}&limit=20`)
    .then((r) => r.json())
    .then((data: unknown) => {
      const d = data as { data?: unknown[]; exercises?: unknown[] } | unknown[];
      const list = (Array.isArray(d) ? d : d.data ?? d.exercises ?? []) as { name?: string; gifUrl?: string; equipments?: string[] }[];
      const q = ex.apiQuery.toLowerCase();
      const exact = list.find((e) => (e.name ?? '').toLowerCase() === q);
      const bodyweight = list.filter((e) => (e.equipments ?? []).some((eq) => /bodyweight|body weight/i.test(eq)) && (e.name ?? '').toLowerCase().includes(q));
      const simple = list.filter((e) => (e.name ?? '').toLowerCase().includes(q));
      const pool = exact ? [exact] : bodyweight.length ? bodyweight : simple.length ? simple : list;
      const best = pool.slice().sort((a, b) => (a.name ?? '').length - (b.name ?? '').length)[0];
      const url = best?.gifUrl ?? null;
      if (url) setLocal('gifCache', { ...(getLocal('gifCache') ?? {}), [ex.id]: url });
      return url;
    })
    .catch(() => null)
    .finally(() => inflight.delete(ex.id));
  inflight.set(ex.id, p);
  return p;
}

export function exercisesWithoutGif(): Exercise[] {
  return EXERCISES.filter((e) => !cachedGif(e));
}
