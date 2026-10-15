import { useEffect, useMemo, useRef, useState } from 'react';
import { exerciseById } from '../../shared/catalog';
import { fmtClock, isoDate } from '../../shared/dates';
import { currentWeek } from '../../shared/plan';
import { aerobicAdherence, strengthAdherence } from '../../shared/stats';
import type { AerobicBlock, PlanDay, WorkoutLog, Zone } from '../../shared/types';
import { BackButton, Overlay, ZoneChip } from '../components/ui';
import { distLabel, paceLabel } from '../lib/format';
import { DistanceTracker } from '../lib/gps';
import { useStore } from '../state/store';
import { ExerciseGif } from './Overlays';

function useSelectedDay(): PlanDay | undefined {
  const { plan, selectedDayId } = useStore();
  return plan?.days.find((d) => d.id === selectedDayId) ?? plan?.days[0];
}

function sessionIndex(day: PlanDay, days: PlanDay[]): number {
  return days.findIndex((d) => d.id === day.id) + 1;
}

/** Re-renders every `ms` while `active`, returning the current timestamp. */
function useNow(active: boolean, ms = 500): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/** Wall-clock stopwatch with pause support (survives the WebView throttling timers). */
function useStopwatch() {
  const [startedAt, setStartedAt] = useState(Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const now = useNow(pausedAt == null);
  const elapsedSec = ((pausedAt ?? now) - startedAt - pausedMs) / 1000;
  return {
    elapsedSec: Math.max(0, elapsedSec),
    paused: pausedAt != null,
    togglePause: () => {
      if (pausedAt == null) setPausedAt(Date.now());
      else { setPausedMs((p) => p + Date.now() - pausedAt); setPausedAt(null); }
    },
    reset: () => { setStartedAt(Date.now()); setPausedAt(null); setPausedMs(0); },
  };
}

// ================= Aerobic =================

export function AerobicDetail() {
  const { plan, closeDetail, openDetail } = useStore();
  const day = useSelectedDay();
  if (!plan || !day) return null;
  return (
    <Overlay className="gap20">
      <BackButton onClick={closeDetail} />
      <div className="col" style={{ gap: 4 }}>
        <span className="step-label">{(day.title === 'Intervalado' ? 'Corrida intervalada' : day.title).toUpperCase()}</span>
        <h2 className="h2">Semana {currentWeek(plan)} · Treino {sessionIndex(day, plan.days)}</h2>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {day.blocks.map((bl, i) => (
          <div key={i} className="card row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="t15">{bl.label}</span>
              <span className="t13">{bl.detail}</span>
            </div>
            <ZoneChip zone={bl.zone} large />
          </div>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn-primary" onClick={() => openDetail('aerobicExec')}>Iniciar treino</button>
    </Overlay>
  );
}

interface ExecStep {
  kind: 'timed' | 'rep' | 'recovery';
  block: AerobicBlock;
  title: string;
  sub: string;
  zone: Zone;
  /** Recovery: countdown length. Timed: planned length (counts up). */
  plannedSec: number;
  rep?: number;
  reps?: number;
}

function buildSteps(day: PlanDay): ExecStep[] {
  const out: ExecStep[] = [];
  for (const b of day.blocks) {
    if (b.kind === 'intervals' && b.reps) {
      for (let r = 1; r <= b.reps; r++) {
        out.push({ kind: 'rep', block: b, title: `INTERVALADO — REP ${r}/${b.reps}`, sub: `${b.repDistanceM ?? 800} m`, zone: b.zone, plannedSec: 0, rep: r, reps: b.reps });
        if (r < b.reps) out.push({ kind: 'recovery', block: b, title: 'RECUPERAÇÃO', sub: `${r}/${b.reps} concluídas`, zone: 'Z2', plannedSec: b.recoverySec ?? 120, rep: r, reps: b.reps });
      }
    } else {
      const title = b.kind === 'warmup' ? 'AQUECIMENTO' : b.kind === 'cooldown' ? 'DESAQUECIMENTO' : b.label.toUpperCase();
      out.push({ kind: 'timed', block: b, title, sub: `${b.durationMin} min planejados`, zone: b.zone === 'Z1/Z2' ? 'Z2' : b.zone, plannedSec: b.durationMin * 60 });
    }
  }
  return out;
}

function stepName(s: ExecStep): string {
  if (s.kind === 'rep') return `Repetição ${s.rep}/${s.reps}`;
  if (s.kind === 'recovery') return `Recuperação — ${fmtClock(s.plannedSec)}`;
  return s.block.label;
}

export function AerobicExec() {
  const { settings, finishWorkout } = useStore();
  const day = useSelectedDay()!;
  const steps = useMemo(() => buildSteps(day), [day]);
  const [idx, setIdx] = useState(0);
  const [repsDone, setRepsDone] = useState(0);
  const [activeSec, setActiveSec] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [stepStartDist, setStepStartDist] = useState(0);
  const startedAt = useRef(Date.now());
  const watch = useStopwatch();
  const tracker = useRef<DistanceTracker | null>(null);
  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  useEffect(() => {
    if (!settings.gps) return;
    const t = new DistanceTracker();
    tracker.current = t;
    t.start(setDistanceM);
    return () => t.stop();
  }, [settings.gps]);

  useEffect(() => { if (tracker.current) tracker.current.paused = watch.paused; }, [watch.paused]);

  const finish = (totalSec: number, reps: number) => {
    tracker.current?.stop();
    const iv = day.blocks.find((b) => b.kind === 'intervals');
    const dist = tracker.current?.distanceM ?? 0;
    const details: WorkoutLog['details'] = [];
    if (dist > 0) details.push({ label: 'Distância', planned: '—', actual: distLabel(dist, settings.unit) });
    details.push({ label: 'Tempo', planned: `${day.durationMin} min`, actual: `${Math.round(totalSec / 60)} min` });
    if (iv) details.push({ label: 'Repetições', planned: `${iv.reps} × ${iv.repDistanceM} m`, actual: `${reps} × ${iv.repDistanceM} m` });
    if (dist > 200) {
      const target = day.blocks.find((b) => b.targetPace)?.targetPace;
      details.push({ label: 'Pace médio', planned: target ? `${target}/km` : '—', actual: paceLabel(totalSec / (dist / 1000), settings.unit) });
    }
    const log: WorkoutLog = {
      date: isoDate(new Date()), planDayId: day.id, type: 'aerobic', title: day.title,
      startedAt: startedAt.current, finishedAt: Date.now(), durationSec: Math.round(totalSec),
      adherence: aerobicAdherence({ plannedMin: day.durationMin, actualSec: totalSec, repsPlanned: iv?.reps, repsDone: reps }),
      distanceM: dist > 0 ? Math.round(dist) : undefined,
      plannedDurationMin: day.durationMin, repsPlanned: iv?.reps, repsDone: iv ? reps : undefined, details,
    };
    finishWorkout(log, 'aerobicResult');
  };

  const advance = () => {
    const total = activeSec + watch.elapsedSec;
    const reps = repsDone + (step.kind === 'rep' ? 1 : 0);
    if (isLast) { finish(total, reps); return; }
    setActiveSec(total);
    setRepsDone(reps);
    setStepStartDist(tracker.current?.distanceM ?? 0);
    setIdx(idx + 1);
    watch.reset();
  };

  // Recovery counts down and advances on its own.
  const remaining = step.kind === 'recovery' ? step.plannedSec - watch.elapsedSec : 0;
  useEffect(() => {
    if (step.kind === 'recovery' && remaining <= 0 && !watch.paused) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0, step.kind]);

  const stepDist = distanceM - stepStartDist;
  const pace = step.kind === 'recovery' ? ''
    : stepDist >= 100 ? paceLabel(watch.elapsedSec / (stepDist / 1000), settings.unit)
    : step.block.targetPace ? `${step.block.targetPace}/km` : '';
  const advanceLabel = isLast ? 'Finalizar treino' : step.kind === 'recovery' ? 'Pular recuperação' : step.kind === 'rep' ? 'Concluir repetição' : 'Concluir bloco';

  return (
    <Overlay className="exec">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="section-label">{step.title}</span>
        <ZoneChip zone={step.zone} large />
      </div>
      <div className="col" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ font: '600 16px var(--fb)', color: 'var(--text2)' }}>{step.sub}</span>
        <span style={{ font: '800 64px var(--fd)', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtClock(step.kind === 'recovery' ? remaining : watch.elapsedSec)}
        </span>
        <span style={{ font: '600 18px var(--fb)', color: 'var(--orange)', minHeight: 22 }}>{pace}</span>
        {settings.gps && distanceM > 0 && <span className="t13">{distLabel(distanceM, settings.unit)} no total</span>}
      </div>
      <div className="card r14 col" style={{ padding: 14, gap: 6 }}>
        <span style={{ font: '500 12px var(--fb)', color: 'var(--text2)' }}>PRÓXIMO</span>
        <span style={{ font: '600 14px var(--fb)', color: 'var(--text)' }}>{isLast ? 'Finalizar treino' : stepName(steps[idx + 1])}</span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={watch.togglePause}>{watch.paused ? 'Retomar' : 'Pausar'}</button>
        <button className="btn-primary sm" style={{ flex: 2 }} onClick={advance}>{advanceLabel}</button>
      </div>
    </Overlay>
  );
}

function ResultRows({ rows }: { rows: NonNullable<WorkoutLog['details']> }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ font: '600 12px var(--fb)', color: 'var(--text2)', padding: '0 4px' }}>
        <span style={{ flex: 1 }}>MÉTRICA</span><span style={{ flex: 1, textAlign: 'center' }}>PLANEJADO</span><span style={{ flex: 1, textAlign: 'center' }}>REALIZADO</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="card r14 p14 row">
          <span style={{ flex: 1, font: '600 14px var(--fb)', color: 'var(--text)' }}>{r.label}</span>
          <span style={{ flex: 1, textAlign: 'center', font: '500 14px var(--fb)', color: 'var(--text2)' }}>{r.planned}</span>
          <span style={{ flex: 1, textAlign: 'center', font: '600 14px var(--fb)', color: 'var(--text)' }}>{r.actual}</span>
        </div>
      ))}
    </div>
  );
}

function ResultHeader({ title, pct, caption }: { title: string; pct: number; caption: string }) {
  return (
    <div className="col" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
      <span style={{ font: '600 14px var(--fb)', color: 'var(--text2)' }}>{title}</span>
      <span style={{ font: '800 44px var(--fd)', color: 'var(--orange)' }}>{pct}%</span>
      <span className="t14">{caption}</span>
    </div>
  );
}

export function AerobicResult() {
  const { lastResult, selectTab } = useStore();
  if (!lastResult) return null;
  return (
    <Overlay className="exec gap22">
      <ResultHeader title="Treino concluído" pct={lastResult.adherence} caption="de aderência" />
      <ResultRows rows={lastResult.details ?? []} />
      <div className="spacer" />
      <button className="btn-primary" onClick={() => selectTab('hoje')}>Concluir</button>
    </Overlay>
  );
}

// ================= Strength =================

export function StrengthDetail() {
  const { plan, profile, closeDetail, openDetail } = useStore();
  const day = useSelectedDay();
  if (!plan || !day) return null;
  return (
    <Overlay className="gap20">
      <BackButton onClick={closeDetail} />
      <div className="col" style={{ gap: 4 }}>
        <span style={{ font: '600 13px var(--fb)', color: 'var(--orangeD)' }}>FORÇA{profile.location ? ` — ${profile.location.toUpperCase()}` : ''}</span>
        <h2 className="h2">Semana {currentWeek(plan)} · Treino de força</h2>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {day.exercises.map((sp) => (
          <div key={sp.exerciseId} className="card row click" style={{ justifyContent: 'space-between' }} onClick={() => openDetail('exerciseDetail', { exerciseId: sp.exerciseId })}>
            <span className="t15">{sp.name}</span>
            <span style={{ font: '600 14px var(--fb)', color: 'var(--text2)' }}>{sp.sets} × {sp.reps}</span>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn-primary" onClick={() => openDetail('strengthExec')}>Iniciar treino</button>
    </Overlay>
  );
}

export function StrengthExec() {
  const { finishWorkout } = useStore();
  const day = useSelectedDay()!;
  const plan = day.exercises;
  const [exIndex, setExIndex] = useState(0);
  const [set, setSet] = useState(1);
  const [doneByEx, setDoneByEx] = useState<number[]>(() => plan.map(() => 0));
  const [restStart, setRestStart] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const now = useNow(restStart != null);
  const cur = plan[exIndex];
  const restLeft = restStart != null ? cur.restSec - (now - restStart) / 1000 : 0;

  const finish = (done: number[]) => {
    const setsPlanned = plan.reduce((s, e) => s + e.sets, 0);
    const setsDone = done.reduce((s, x) => s + x, 0);
    const finishedAt = Date.now();
    finishWorkout({
      date: isoDate(new Date()), planDayId: day.id, type: 'strength', title: day.title,
      startedAt: startedAt.current, finishedAt, durationSec: Math.round((finishedAt - startedAt.current) / 1000),
      adherence: strengthAdherence(setsPlanned, setsDone), setsPlanned, setsDone,
      details: plan.map((e, i) => ({ label: e.name, planned: `${e.sets} × ${e.reps}`, actual: `${done[i]} × ${e.reps}` })),
    }, 'strengthResult');
  };

  const endRest = () => { setRestStart(null); setSet((s) => s + 1); };
  useEffect(() => {
    if (restStart != null && restLeft <= 0) endRest();
  }, [restStart, restLeft]);

  const finishSet = () => {
    const done = doneByEx.map((d, i) => (i === exIndex ? d + 1 : d));
    setDoneByEx(done);
    if (set < cur.sets) { setRestStart(Date.now()); return; }
    if (exIndex < plan.length - 1) { setExIndex(exIndex + 1); setSet(1); return; }
    finish(done);
  };

  const stop = () => {
    if (window.confirm('Encerrar o treino agora? As séries feitas serão salvas.')) finish(doneByEx);
  };

  const ex = exerciseById(cur.exerciseId);
  return (
    <Overlay className="exec gap22">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="section-label">EXERCÍCIO {exIndex + 1} DE {plan.length}</span>
          <h2 className="h2">{cur.name}</h2>
        </div>
        <button className="link" style={{ color: 'var(--text2)' }} onClick={stop}>Encerrar</button>
      </div>
      <ExerciseGif exerciseId={cur.exerciseId} small />
      <p className="body-text">{ex?.desc}</p>
      {restStart == null ? (
        <div className="col" style={{ gap: 14, alignItems: 'center' }}>
          <span style={{ font: '600 15px var(--fb)', color: 'var(--text2)' }}>Série {set} de {cur.sets}</span>
          <span style={{ font: '800 48px var(--fd)', color: 'var(--text)' }}>{cur.reps} {cur.exerciseId === 'prancha' ? 's' : 'reps'}</span>
          <button className="btn-primary sm" style={{ width: '100%' }} onClick={finishSet}>CONCLUIR SÉRIE</button>
        </div>
      ) : (
        <div className="col" style={{ gap: 14, alignItems: 'center' }}>
          <span style={{ font: '600 15px var(--fb)', color: 'var(--text2)' }}>Descanso</span>
          <span style={{ font: '800 48px var(--fd)', color: 'var(--orange)', fontVariantNumeric: 'tabular-nums' }}>{fmtClock(Math.ceil(restLeft))}</span>
          <button className="btn-secondary" style={{ font: '600 14px var(--fb)', padding: '12px 20px', borderRadius: 12 }} onClick={endRest}>Pular descanso</button>
        </div>
      )}
    </Overlay>
  );
}

export function StrengthResult() {
  const { lastResult, selectTab } = useStore();
  if (!lastResult) return null;
  return (
    <Overlay className="exec gap22">
      <ResultHeader title="Treino de força concluído" pct={lastResult.adherence} caption="das séries completadas" />
      <div className="col" style={{ gap: 10 }}>
        {(lastResult.details ?? []).map((r) => (
          <div key={r.label} className="card r14 p14 row" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '600 14px var(--fb)', color: 'var(--text)' }}>{r.label}</span>
            <span className="t13">{r.actual} concluídas</span>
          </div>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn-primary" onClick={() => selectTab('plano')}>Concluir</button>
    </Overlay>
  );
}
