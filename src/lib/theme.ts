import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { ThemeSetting } from '../../shared/types';

export function resolveTheme(setting: ThemeSetting): 'light' | 'dark' {
  if (setting === 'Claro') return 'light';
  if (setting === 'Escuro') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Applies the palette (CSS variables on :root) and matches the native status bar. */
export function applyTheme(setting: ThemeSetting) {
  const t = resolveTheme(setting);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F5F5F5' : '#0A0A0A');
  if (Capacitor.isNativePlatform()) {
    StatusBar.setStyle({ style: t === 'light' ? Style.Light : Style.Dark }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: t === 'light' ? '#F5F5F5' : '#0A0A0A' }).catch(() => undefined);
  }
}

/** Calls `cb` when the OS theme changes (for the "Sistema" option). */
export function onSystemThemeChange(cb: () => void): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  if (!mq) return () => undefined;
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
