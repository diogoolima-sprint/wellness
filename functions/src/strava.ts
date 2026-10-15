import { randomBytes } from 'node:crypto';
import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { normalizeStravaActivity, type StravaActivity } from '../../shared/stats';
import {
  APP_URL_SCHEME, db, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN, stravaRedirectUri,
} from './config';

const STRAVA = 'https://www.strava.com';
const SCOPE = 'read,activity:read_all';
const BACKFILL_DAYS = 120;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch seconds */
  expiresAt: number;
  athleteId: number;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID.value(),
      client_secret: STRAVA_CLIENT_SECRET.value(),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

/** Returns a valid access token for the user, refreshing it when it is about to expire (~6h lifetime). */
async function accessTokenFor(uid: string): Promise<string | null> {
  const ref = db.doc(`stravaTokens/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const t = snap.data() as StoredTokens;
  if (t.expiresAt - 300 > Date.now() / 1000) return t.accessToken;
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refreshToken });
  await ref.update({ accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: r.expires_at });
  return r.access_token;
}

async function stravaGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${STRAVA}/api/v3${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Strava GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function saveActivities(uid: string, list: StravaActivity[]): Promise<void> {
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch();
    for (const a of list.slice(i, i + 400)) {
      const act = normalizeStravaActivity(a);
      batch.set(db.doc(`users/${uid}/activities/${act.id}`), act);
    }
    await batch.commit();
  }
}

/** Imports activities since `afterEpoch` (paginated, 100 per page). */
async function syncSince(uid: string, afterEpoch: number): Promise<number> {
  const token = await accessTokenFor(uid);
  if (!token) return 0;
  let page = 1;
  let total = 0;
  for (;;) {
    const list = await stravaGet<StravaActivity[]>(token, `/athlete/activities?after=${afterEpoch}&per_page=100&page=${page}`);
    if (!list.length) break;
    await saveActivities(uid, list);
    total += list.length;
    if (list.length < 100 || page >= 20) break;
    page++;
  }
  await db.doc(`users/${uid}`).set({ integrations: { strava: { lastSyncAt: Date.now() } } }, { merge: true });
  return total;
}

async function disconnect(uid: string, revoke: boolean): Promise<void> {
  const ref = db.doc(`stravaTokens/${uid}`);
  const snap = await ref.get();
  if (snap.exists) {
    const t = snap.data() as StoredTokens;
    if (revoke) {
      try {
        await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${t.accessToken}` } });
      } catch (err) {
        logger.warn('Strava deauthorize failed', err);
      }
    }
    await db.doc(`stravaAthletes/${t.athleteId}`).delete();
    await ref.delete();
  }
  await db.doc(`users/${uid}`).set({ integrations: { strava: { connected: false } } }, { merge: true });
}

// ---------- Callable: start OAuth ----------

export const stravaAuthUrl = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
  const state = randomBytes(24).toString('hex');
  await db.doc(`stravaOAuthStates/${state}`).set({ uid, createdAt: Date.now() });
  const url = new URL(`${STRAVA}/oauth/mobile/authorize`);
  url.search = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID.value(),
    redirect_uri: stravaRedirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  }).toString();
  return { url: url.toString() };
});

// ---------- HTTP: OAuth redirect target ----------

function resultPage(ok: boolean, message: string): string {
  const deepLink = `${APP_URL_SCHEME}://strava?status=${ok ? 'connected' : 'error'}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VANTA · Strava</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0A0A0A;color:#fff;font:500 16px Inter,system-ui,sans-serif;padding:24px;text-align:center}
a{background:#FF6B1A;color:#000;font-weight:700;padding:16px 24px;border-radius:14px;text-decoration:none}</style></head>
<body><div style="font:800 24px Sora,system-ui;letter-spacing:2px">VANTA</div><p>${message}</p><a href="${deepLink}">Voltar ao app</a>
<script>setTimeout(function(){location.href=${JSON.stringify(deepLink)}},600)</script></body></html>`;
}

export const stravaCallback = onRequest({ secrets: [STRAVA_CLIENT_SECRET] }, async (req, res) => {
  const { code, state, error, scope } = req.query as Record<string, string | undefined>;
  if (error || !code || !state) {
    res.status(400).send(resultPage(false, 'A conexão com o Strava foi cancelada.'));
    return;
  }
  const stateRef = db.doc(`stravaOAuthStates/${state}`);
  const stateSnap = await stateRef.get();
  await stateRef.delete();
  const st = stateSnap.data() as { uid: string; createdAt: number } | undefined;
  if (!st || Date.now() - st.createdAt > 15 * 60_000) {
    res.status(400).send(resultPage(false, 'Link expirado. Tente conectar novamente pelo app.'));
    return;
  }
  if (!scope || !scope.includes('activity:read')) {
    res.status(400).send(resultPage(false, 'Precisamos da permissão de leitura de atividades para conectar.'));
    return;
  }
  try {
    const t = await tokenRequest({ code, grant_type: 'authorization_code' });
    const athlete = t.athlete!;
    // One Strava athlete maps to one VANTA account.
    const prev = await db.doc(`stravaAthletes/${athlete.id}`).get();
    if (prev.exists && prev.data()!.uid !== st.uid) await disconnect(prev.data()!.uid, false);

    await db.doc(`stravaTokens/${st.uid}`).set({
      accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at, athleteId: athlete.id, scope,
    } satisfies StoredTokens);
    await db.doc(`stravaAthletes/${athlete.id}`).set({ uid: st.uid });
    await db.doc(`users/${st.uid}`).set({
      integrations: { strava: {
        connected: true, athleteId: athlete.id,
        athleteName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '),
        connectedAt: Date.now(),
      } },
    }, { merge: true });

    await syncSince(st.uid, Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86400);
    res.send(resultPage(true, 'Strava conectado! Suas atividades já estão sendo importadas.'));
  } catch (err) {
    logger.error('Strava callback failed', err);
    res.status(500).send(resultPage(false, 'Não foi possível conectar ao Strava. Tente novamente.'));
  }
});

// ---------- Callables: disconnect / manual sync ----------

export const stravaDisconnect = onCall({ secrets: [STRAVA_CLIENT_SECRET] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
  await disconnect(uid, true);
  return { ok: true };
});

export const stravaSync = onCall({ secrets: [STRAVA_CLIENT_SECRET], timeoutSeconds: 120 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
  const user = (await db.doc(`users/${uid}`).get()).data();
  const last = user?.integrations?.strava?.lastSyncAt as number | undefined;
  const after = Math.floor((last ?? Date.now() - BACKFILL_DAYS * 86_400_000) / 1000) - 2 * 86400;
  const imported = await syncSince(uid, after);
  return { imported };
});

// ---------- HTTP: Strava webhook (push subscription) ----------

interface WebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  updates?: Record<string, string>;
}

export const stravaWebhook = onRequest({ secrets: [STRAVA_WEBHOOK_VERIFY_TOKEN] }, async (req, res) => {
  // Subscription validation handshake.
  if (req.method === 'GET') {
    const q = req.query as Record<string, string | undefined>;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === STRAVA_WEBHOOK_VERIFY_TOKEN.value()) {
      res.json({ 'hub.challenge': q['hub.challenge'] });
    } else {
      res.sendStatus(403);
    }
    return;
  }
  if (req.method !== 'POST') { res.sendStatus(405); return; }
  // Strava expects a 200 within 2 seconds, so only enqueue here; processStravaEvent does the work.
  const ev = req.body as WebhookEvent;
  if (ev && typeof ev.owner_id === 'number' && typeof ev.object_id === 'number') {
    await db.collection('stravaEvents').add({ ...ev, receivedAt: Date.now() });
  }
  res.sendStatus(200);
});

export const processStravaEvent = onDocumentCreated({ document: 'stravaEvents/{id}', secrets: [STRAVA_CLIENT_SECRET] }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const ev = snap.data() as WebhookEvent;
  try {
    const map = await db.doc(`stravaAthletes/${ev.owner_id}`).get();
    const uid = map.data()?.uid as string | undefined;
    if (!uid) return;

    if (ev.object_type === 'athlete' && ev.updates?.authorized === 'false') {
      await disconnect(uid, false);
    } else if (ev.object_type === 'activity') {
      const ref = db.doc(`users/${uid}/activities/${ev.object_id}`);
      if (ev.aspect_type === 'delete') {
        await ref.delete();
      } else {
        const token = await accessTokenFor(uid);
        if (token) {
          const a = await stravaGet<StravaActivity>(token, `/activities/${ev.object_id}`);
          await ref.set(normalizeStravaActivity(a));
          await db.doc(`users/${uid}`).update({ 'integrations.strava.lastSyncAt': Date.now() });
        }
      }
    }
  } catch (err) {
    logger.error('Strava event processing failed', { ev, err });
  } finally {
    await snap.ref.delete();
  }
});
