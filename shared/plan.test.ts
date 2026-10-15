import { describe, expect, it } from 'vitest';
import { availableExercises } from './catalog';
import { isoDate } from './dates';
import { buildRulePlan, currentWeek, nextSession, planDayFor, profileKey, sanitizePlan } from './plan';
import type { Profile } from './types';

const base: Profile = {
  name: 'Diogo', age: '35', weight: '80', height: '180', goal: 'Correr 10 km', customTarget: '',
  runsNow: true, freq: '3', avgDist: '5', avgPace: '6:00', maxDist: '8', strengthLevel: 'Iniciante',
  days: [1, 3, 5, 0], duration: '45 min', location: 'Casa', equipment: ['Nenhum'],
};
const wed = new Date(2026, 9, 14); // quarta-feira

describe('buildRulePlan', () => {
  it('uses exactly the chosen days, sorted, one session each', () => {
    const p = buildRulePlan(base, wed);
    expect(p.days.map((d) => d.weekday)).toEqual([0, 1, 3, 5]);
    expect(p.sessionsPerWeek).toBe(4);
    expect(p.name).toBe('Plano 10K');
    expect(p.startDate).toBe('2026-10-11'); // Sunday of that week
  });

  it('only uses exercises compatible with the equipment', () => {
    const allowed = new Set(availableExercises(['Nenhum']).map((e) => e.id));
    const p = buildRulePlan({ ...base, goal: 'Ganho de força' }, wed);
    const ex = p.days.flatMap((d) => d.exercises);
    expect(ex.length).toBeGreaterThan(0);
    expect(ex.every((e) => allowed.has(e.exerciseId))).toBe(true);
    expect(ex.some((e) => e.exerciseId === 'remada')).toBe(false);
  });

  it('gives non-runners no Z4 intervals', () => {
    const p = buildRulePlan({ ...base, runsNow: false }, wed);
    expect(p.days.flatMap((d) => d.blocks).some((b) => b.zone === 'Z4')).toBe(false);
  });

  it('defaults to Mon/Wed/Fri when no day was chosen', () => {
    expect(buildRulePlan({ ...base, days: [] }, wed).days.map((d) => d.weekday)).toEqual([1, 3, 5]);
  });
});

describe('sanitizePlan', () => {
  it('drops invalid days, unknown exercises and clamps numbers', () => {
    const raw = {
      name: 'Plano X', weeks: 50,
      days: [
        { weekday: 1, type: 'strength', title: 'Força', subtitle: '', durationMin: 40, zone: null, blocks: [],
          exercises: [{ exerciseId: 'flexao', sets: 99, reps: 10, restSec: 60 }, { exerciseId: 'inventado', sets: 3, reps: 10, restSec: 60 }] },
        { weekday: 9, type: 'aerobic', blocks: [{ kind: 'steady', label: 'x', detail: '', zone: 'Z2', durationMin: 30 }], exercises: [] },
        { weekday: 3, type: 'aerobic', title: 'Intervalado', zone: 'Z4', durationMin: 42, exercises: [],
          blocks: [{ kind: 'intervals', label: '4×800', detail: '', zone: 'Z4', durationMin: 22, reps: 4, repDistanceM: 800, recoverySec: 120, targetPace: null }] },
      ],
    };
    const p = sanitizePlan(raw, base, wed)!;
    expect(p.weeks).toBe(16);
    expect(p.days.map((d) => d.weekday)).toEqual([1, 3]);
    expect(p.days[0].exercises).toEqual([{ exerciseId: 'flexao', name: 'Flexão', sets: 8, reps: 10, restSec: 60 }]);
    expect(p.days[1].blocks[0].reps).toBe(4);
    expect(p.days[1].blocks[0].targetPace).toBeUndefined();
    expect(p.source).toBe('ai');
    expect(p.profileKey).toBe(profileKey(base));
  });

  it('returns null for unusable input', () => {
    expect(sanitizePlan(null, base)).toBeNull();
    expect(sanitizePlan({ days: [] }, base)).toBeNull();
  });
});

describe('schedule helpers', () => {
  const p = buildRulePlan(base, wed);
  it('computes the current week and clamps it', () => {
    expect(currentWeek(p, wed)).toBe(1);
    expect(currentWeek(p, new Date(2026, 9, 25))).toBe(3);
    expect(currentWeek(p, new Date(2027, 5, 1))).toBe(8);
  });
  it('finds today and the next session', () => {
    expect(planDayFor(p, wed)?.weekday).toBe(3);
    const n = nextSession(p, wed)!;
    expect(n.day.weekday).toBe(5);
    expect(isoDate(n.date)).toBe('2026-10-16');
  });
});

describe('profileKey', () => {
  it('ignores personal data but tracks plan inputs', () => {
    expect(profileKey({ ...base, name: 'Outro' })).toBe(profileKey(base));
    expect(profileKey({ ...base, days: [5, 3, 1, 0] })).toBe(profileKey(base));
    expect(profileKey({ ...base, goal: 'Correr 5 km' })).not.toBe(profileKey(base));
  });
});
