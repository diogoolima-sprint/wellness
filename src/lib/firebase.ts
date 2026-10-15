import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import {
  clearIndexedDbPersistence, connectFirestoreEmulator, initializeFirestore, memoryLocalCache, persistentLocalCache,
  persistentMultipleTabManager, terminate,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { Capacitor } from '@capacitor/core';
import { getLocal } from './localPrefs';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

export const app = initializeApp(firebaseConfigured ? config : { apiKey: 'missing', projectId: 'missing', appId: 'missing' });

// In the Android WebView the default popup/redirect resolver is not usable; IndexedDB persistence is.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

// "Salvamento de dados" (Configurações) controls whether Firestore keeps an offline copy on the device.
const saveData = getLocal('settings')?.saveData ?? true;
export const db = initializeFirestore(app, {
  localCache: saveData ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache(),
});

export const functions = getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || 'southamerica-east1');

// Local development against `firebase emulators:start` (see README).
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}

/** Removes Firestore's offline cache from this device. Reload the app afterwards. */
export async function clearOfflineCache() {
  await terminate(db);
  await clearIndexedDbPersistence(db);
}
