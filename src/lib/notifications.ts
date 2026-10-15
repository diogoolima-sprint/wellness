import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Plan } from '../../shared/types';

const BASE_ID = 7000;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
}

/** Weekly 7:00 reminder on each training day of the plan; cancels everything when disabled. */
export async function scheduleWorkoutReminders(plan: Plan | undefined, enabled: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 10);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  if (!enabled || !plan) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return;
  await LocalNotifications.schedule({
    notifications: plan.days.map((d) => ({
      id: BASE_ID + d.weekday,
      title: 'Seu treino de hoje',
      body: `${d.title} · ${d.subtitle}`,
      // Capacitor weekday: 1 = domingo … 7 = sábado
      schedule: { on: { weekday: d.weekday + 1, hour: 7, minute: 0 }, allowWhileIdle: true },
    })),
  });
}
