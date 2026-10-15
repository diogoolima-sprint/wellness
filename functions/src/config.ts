import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';

initializeApp();
export const db = getFirestore();

/** Region for every function. São Paulo, close to the user. Keep in sync with VITE_FUNCTIONS_REGION. */
export const REGION = 'southamerica-east1';

export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
export const STRAVA_CLIENT_SECRET = defineSecret('STRAVA_CLIENT_SECRET');
export const STRAVA_WEBHOOK_VERIFY_TOKEN = defineSecret('STRAVA_WEBHOOK_VERIFY_TOKEN');
export const STRAVA_CLIENT_ID = defineString('STRAVA_CLIENT_ID');
/** Deep link scheme the OAuth callback page sends the user back to. Must match the Android intent filter. */
export const APP_URL_SCHEME = 'vanta';

export function stravaRedirectUri(): string {
  const project = process.env.GCLOUD_PROJECT;
  return `https://${REGION}-${project}.cloudfunctions.net/stravaCallback`;
}
