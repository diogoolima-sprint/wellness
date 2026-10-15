import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, sendPasswordResetEmail,
  signInWithCredential, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

export const appleEnabled = import.meta.env.VITE_ENABLE_APPLE === 'true';

export async function signUpEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signInGoogle() {
  if (!Capacitor.isNativePlatform()) {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return;
  }
  // Native Google sign-in, then hand the credential to the JS SDK (skipNativeAuth: true).
  const res = await FirebaseAuthentication.signInWithGoogle();
  const idToken = res.credential?.idToken;
  if (!idToken) throw new Error('Login com Google cancelado.');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signInApple() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  if (!Capacitor.isNativePlatform()) {
    await signInWithPopup(auth, provider);
    return;
  }
  const res = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  const idToken = res.credential?.idToken;
  if (!idToken) throw new Error('Login com Apple cancelado.');
  await signInWithCredential(auth, provider.credential({ idToken, rawNonce: res.credential?.nonce }));
}

export async function signOut() {
  if (Capacitor.isNativePlatform()) {
    try { await FirebaseAuthentication.signOut(); } catch { /* not signed in natively */ }
  }
  await fbSignOut(auth);
}

/** Maps Firebase Auth error codes to pt-BR messages. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Informe a senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Este e-mail já tem conta. Toque em "Entrar".',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos conta com este e-mail.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
    'auth/popup-closed-by-user': 'Login cancelado.',
  };
  if (map[code]) return map[code];
  const msg = (err as Error)?.message ?? '';
  return /cancel/i.test(msg) ? 'Login cancelado.' : 'Não foi possível entrar. Tente novamente.';
}
