import { describe, expect, it } from 'vitest';
import { buildRulePlan } from './plan';
import {
  aerobicAdherence, deviceMetrics, monthSummary, normalizeStravaActivity, paceByWeek, planProgress, strengthAdherence, weekStatuses,
} from './stats';
import type { Activity, Profile, WorkoutLog } from './types';

const profile: Profile = {
  name: '', age: '', weight: '', height: '', goal: 'Correr 5 km', customTarget: '', runsNow: true, freq: '', avgDist: '',
  avgPace: '', maxDist: '', strengthLevel: 'Iniciante', days: [1, 3, 5], duration: '45 min', location: 'Casa', equipment: [],
};
const wed = new Date(2026, 9, 14);

const run = (date: string, km: number, min: number, extra: Partial<Activity> = {}): Activity => ({
  id: date + km, source: 'strava', name: 'Run', sportType: 'Run', isRun: true, startDate: `${date}T10:00:00Z`, date,
  distanceM: km * 1000, movingTimeSec: min * 60, elapsedTimeSec: min * 60, avgHr: null, maxHr: null, avgCadence: null,
  sufferScore: null, elevationGainM: null, ...extra,
});
const log = (date: string, type: 'aerobic' | 'strength', adherence: number, extra: Partial<WorkoutLog> = {}): WorkoutLog => ({
  date, planDayId: null, type, title: type, startedAt: 0, finishedAt: 0, durationSec: 1800, adherence, ...extra,
});

describe('adherence', () => {
  it('is 100 for a session exactly as planned', () => {
    expect(aerobicAdherence({ plannedMin: 42, actualSec: 42 * 60, repsPlanned: 4, repsDone: 4 })).toBe(100);
  });
  it('penalizes missing reps and time deviation', () => {
    expect(aerobicAdherence({ plannedMin: 40, actualSec: 30 * 60, repsPlanned: 4, repsDone: 2 })).toBe(63);
  });
  it('strength = sets done / planned', () => {
    expect(strengthAdherence(9, 9)).toBe(100);
    expect(strengthAdherence(9, 6)).toBe(67);
  });
});

describe('plan progress and month summary', () => {
  const plan = { ...buildRulePlan(profile, wed), generatedAt: new Date(2026, 9, 1).getTime() };
  it('does not double count a run logged in the app and on Strava the same day', () => {
    const w = [log('2026-10-12', 'aerobic', 90, { distanceM: 5000 }), log('2026-10-14', 'strength', 100)];
    const a = [run('2026-10-12', 5.2, 30), run('2026-10-13', 4, 25)];
    const p = planProgress(plan, w, a);
    expect(p.done).toBe(3); // 2 app sessions + 1 extra Strava run
    expect(p.adherence).toBe(95);
    expect(p.distanceM).toBe(9200); // Strava wins on 10-12
    const m = monthSummary(w, a, wed);
    expect(m.sessions).toBe(3);
    expect(m.strengthSessions).toBe(1);
  });

  it('marks week statuses', () => {
    const s = weekStatuses(plan, [log('2026-10-12', 'aerobic', 90)], [], wed);
    expect([...s.values()]).toEqual(['done', 'today', 'next']);
    const s2 = weekStatuses(plan, [], [], wed);
    expect(s2.get('d1')).toBe('missed');
    // Doing Monday's session on Wednesday ticks Monday, not Wednesday.
    const early = weekStatuses(plan, [log('2026-10-14', 'aerobic', 90, { planDayId: 'd1' })], [], wed);
    expect(early.get('d1')).toBe('done');
    expect(early.get('d3')).toBe('today');
    const late = { ...plan, generatedAt: new Date(2026, 9, 14, 9).getTime() };
    expect(weekStatuses(late, [], [], wed).get('d1')).toBe('beforeStart');
  });
});

describe('paceByWeek', () => {
  it('makes faster weeks taller and keeps empty weeks flat', () => {
    const a = [run('2026-10-13', 5, 30), run('2026-10-06', 5, 35)];
    const bars = paceByWeek([], a, 30, wed);
    expect(bars).toHaveLength(5);
    expect(bars[4].paceSecPerKm).toBe(360);
    expect(bars[4].heightPct).toBeGreaterThan(bars[3].heightPct);
    expect(bars[0].paceSecPerKm).toBeNull();
  });
});

describe('Strava', () => {
  it('normalizes an activity', () => {
    const a = normalizeStravaActivity({
      id: 123, name: 'Morning Run', sport_type: 'Run', start_date: '2026-10-14T09:00:00Z', start_date_local: '2026-10-14T06:00:00Z',
      distance: 5100, moving_time: 1800, elapsed_time: 1900, average_heartrate: 148.4, average_cadence: 84, suffer_score: 40,
    });
    expect(a).toMatchObject({ id: '123', isRun: true, date: '2026-10-14', avgCadence: 168, avgHr: 148.4, sufferScore: 40 });
  });
  it('builds device metrics', () => {
    const m = deviceMetrics([run('2026-10-13', 5, 30, { avgHr: 140, avgCadence: 170, sufferScore: 30 }), run('2026-10-10', 5, 30, { avgHr: 150, sufferScore: 20 })], wed);
    expect(m.map((x) => x.value)).toEqual(['145 bpm', '50 pts', '— (requer Garmin)', '— (requer Garmin)', '170 spm']);
  });
});
