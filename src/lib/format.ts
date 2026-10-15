import type { CSSProperties } from 'react';
import type { UnitSetting } from '../../shared/types';

export function distLabel(meters: number, unit: UnitSetting): string {
  const km = meters / 1000;
  return unit === 'mi' ? `${(km * 0.621371).toFixed(1).replace('.', ',')}mi` : `${km.toFixed(1).replace('.', ',')}km`;
}

export function paceLabel(secPerKm: number, unit: UnitSetting): string {
  const s = unit === 'mi' ? secPerKm / 0.621371 : secPerKm;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}/${unit}`;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function zoneColor(zone: string | null | undefined): string {
  const z = (zone ?? 'Z2').split('/').pop()!.toLowerCase();
  return `var(--${['z1', 'z2', 'z3', 'z4', 'z5'].includes(z) ? z : 'z2'})`;
}

export function zoneChipStyle(zone: string | null | undefined): CSSProperties {
  const c = zoneColor(zone);
  return { color: c, background: `color-mix(in srgb, ${c} 15%, transparent)` };
}
