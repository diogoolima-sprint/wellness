import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { httpsCallable } from 'firebase/functions';
import type { Plan } from '../../shared/types';
import { functions } from './firebase';

export async function generatePlanRemote(): Promise<Plan> {
  const fn = httpsCallable<void, { plan: Plan }>(functions, 'generatePlan', { timeout: 180_000 });
  const res = await fn();
  return res.data.plan;
}

/** Opens Strava's authorization page. The callback function redirects back with vanta://strava. */
export async function connectStrava() {
  const fn = httpsCallable<void, { url: string }>(functions, 'stravaAuthUrl');
  const { data } = await fn();
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
}

export async function disconnectStrava() {
  await httpsCallable(functions, 'stravaDisconnect')();
}

export async function syncStrava(): Promise<number> {
  const res = await httpsCallable<void, { imported: number }>(functions, 'stravaSync')();
  return res.data.imported;
}

/** Closes the in-app browser when the OAuth flow deep-links back into the app. */
export function listenForStravaReturn(onReturn: (ok: boolean) => void) {
  const handle = App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('vanta://strava')) return;
    Browser.close().catch(() => undefined);
    onReturn(url.includes('status=connected'));
  });
  return () => { handle.then((h) => h.remove()); };
}
