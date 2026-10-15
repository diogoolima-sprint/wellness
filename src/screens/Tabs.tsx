import { useEffect, useState } from 'react';
import { DAY_LABELS, EXERCISES, progressionLevel } from '../../shared/catalog';
import { addDays, isoDate } from '../../shared/dates';
import { currentWeek, nextSession, planDayFor } from '../../shared/plan';
import { deviceMetrics, monthSummary, paceByWeek, PERIOD_DAYS, planProgress, weekStatuses, workoutOn, type DayStatus } from '../../shared/stats';
import type { PlanDay } from '../../shared/types';
import { ZoneChip } from '../components/ui';
import { connectStrava, disconnectStrava, syncStrava } from '../lib/api';
import { distLabel, greeting, paceLabel } from '../lib/format';
import { cachedGif, loadGif } from '../lib/gifs';
import { useStore, type Detail, type Tab } from '../state/store';

const NAV: { id: Tab; label: string }[] = [
  { id: 'hoje', label: 'Hoje' }, { id: 'plano', label: 'Plano' }, { id: 'treinos', label: 'Treinos' },
  { id: 'evolucao', label: 'Evolução' }, { id: 'perfil', label: 'Perfil' },
];

export function NavBar() {
  const { activeTab, selectTab } = useStore();
  return (
    <nav className="navbar">
      {NAV.map((n) => (
        <button key={n.id} className={activeTab === n.id ? 'on' : ''} onClick={() => selectTab(n.id)}>
          <div className="dot" />
          <span className="label">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

const dayName = (weekday: number) => DAY_LABELS[weekday][1];

function whenLabel(date: Date, today = new Date()): string {
  return isoDate(date) === isoDate(addDays(today, 1)) ? 'amanhã' : dayName(date.getDay()).toLowerCase();
}

export function detailFor(day: PlanDay): Detail {
  return day.type === 'strength' ? 'strengthDetail' : 'workoutDetail';
}

/** Second meta item on the "today" card, e.g. "4 × 800 m". */
function dayMeta(day: PlanDay): string {
  if (day.type === 'strength') return `${day.exercises.length} exercícios`;
  const iv = day.blocks.find((b) => b.kind === 'intervals');
  return iv ? `${iv.reps} × ${iv.repDistanceM} m` : '';
}

function displayTitle(day: PlanDay): string {
  return day.title === 'Intervalado' ? 'Corrida intervalada' : day.title;
}

// ---------------- Hoje ----------------

export function HojeTab() {
  const { profile, plan, workouts, activities, settings, openDetail, planUpdating } = useStore();
  const today = new Date();
  const firstName = profile.name ? profile.name.split(' ')[0] : 'Atleta';
  if (!plan) return <div className="tab"><span className="h2-22">{greeting()}, {firstName} 👋</span><span className="t14">Gerando seu plano…</span></div>;

  const todayDay = planDayFor(plan, today);
  const doneToday = workoutOn(isoDate(today), workouts);
  const next = nextSession(plan, today);
  const prog = planProgress(plan, workouts, activities);

  return (
    <div className="tab">
      <div className="col" style={{ gap: 2 }}>
        <span className="h2-22">{greeting()}, {firstName} 👋</span>
        <span className="t14">Semana {currentWeek(plan, today)} de {plan.weeks}{planUpdating ? ' · atualizando plano…' : ''}</span>
      </div>

      {!doneToday && !todayDay && (
        <div className="card r22 col" style={{ gap: 6 }}>
          <span style={{ font: '700 16px var(--fd)', color: 'var(--recovery)' }}>Hoje é dia de recuperação</span>
          <span className="t14">{next ? `Seu próximo treino é ${whenLabel(next.date, today)}.` : 'Aproveite para descansar.'}</span>
        </div>
      )}
      {!doneToday && todayDay && (
        <div className="card r22 col" style={{ background: 'linear-gradient(160deg,var(--surface),var(--surface2))', gap: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="#000" strokeWidth="2" /><path d="M10 5v5l3 3" stroke="#000" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="col">
              <span style={{ font: '600 12px var(--fb)', color: 'var(--text2)' }}>SEU TREINO DE HOJE</span>
              <span style={{ font: '700 18px var(--fd)', color: 'var(--text)' }}>{displayTitle(todayDay)}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <span className="nowrap" style={{ font: '600 14px var(--fb)', color: 'var(--text2)' }}>{todayDay.durationMin} min</span>
            {dayMeta(todayDay) && <span className="nowrap" style={{ font: '600 14px var(--fb)', color: 'var(--text2)' }}>{dayMeta(todayDay)}</span>}
            <ZoneChip zone={todayDay.zone} />
          </div>
          <button className="btn-primary sm" onClick={() => openDetail(detailFor(todayDay), { dayId: todayDay.id })}>COMEÇAR TREINO</button>
        </div>
      )}
      {doneToday && (
        <div className="card r22 col" style={{ borderColor: 'var(--success)', gap: 6 }}>
          <span style={{ font: '700 16px var(--fd)', color: 'var(--success)' }}>Treino concluído ✓</span>
          <span className="t14">{doneToday.adherence}% de aderência.{next ? ` Seu próximo treino é ${whenLabel(next.date, today)}.` : ''}</span>
        </div>
      )}

      <div className="col" style={{ gap: 12 }}>
        <span className="section-label-strong">SEU PROGRESSO</span>
        <div className="grid3">
          <div className="stat"><span className="v">{prog.done}/{prog.total}</span><span className="l">treinos</span></div>
          <div className="stat"><span className="v accent">{prog.adherence != null ? `${prog.adherence}%` : '—'}</span><span className="l">aderência</span></div>
          <div className="stat"><span className="v">{distLabel(prog.distanceM, settings.unit)}</span><span className="l">distância</span></div>
        </div>
      </div>

      {next && (
        <div className="col" style={{ gap: 10 }}>
          <span className="section-label-strong">PRÓXIMO TREINO</span>
          <div className="card row click" style={{ gap: 12 }} onClick={() => openDetail(detailFor(next.day), { dayId: next.day.id })}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--orangeD)', flexShrink: 0 }} />
            <div className="col">
              <span className="t15">{dayName(next.date.getDay())} — {next.day.title}</span>
              <span className="t13">{next.day.subtitle}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Plano ----------------

const STATUS: Record<DayStatus, { label: string; color: string }> = {
  done: { label: '✓', color: 'var(--success)' },
  today: { label: 'Hoje', color: 'var(--orange)' },
  next: { label: 'Próximo', color: 'var(--orange)' },
  scheduled: { label: 'Agendado', color: 'var(--text2)' },
  missed: { label: 'Perdido', color: 'var(--error)' },
  beforeStart: { label: 'Próx. semana', color: 'var(--text2)' },
};

export function PlanoTab() {
  const { plan, workouts, activities, openDetail } = useStore();
  if (!plan) return null;
  const statuses = weekStatuses(plan, workouts, activities);
  return (
    <div className="tab gap18">
      <div className="col" style={{ gap: 2 }}>
        <span className="h2-22">{plan.name}</span>
        <span className="t14">Semana {currentWeek(plan)} de {plan.weeks}</span>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {plan.days.map((pd) => {
          const st = STATUS[statuses.get(pd.id) ?? 'scheduled'];
          return (
            <div key={pd.id} className="card row click" style={{ gap: 12 }} onClick={() => openDetail(detailFor(pd), { dayId: pd.id })}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {pd.type === 'strength' ? '💪' : '🏃'}
              </span>
              <div className="col" style={{ flex: 1 }}>
                <span className="t15">{dayName(pd.weekday)} — {pd.title}</span>
                <span className="t13">{pd.subtitle}</span>
              </div>
              <span style={{ font: '700 11px var(--fb)', color: st.color }}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Treinos (biblioteca) ----------------

export function TreinosTab() {
  const { profile, openDetail } = useStore();
  const [, force] = useState(0);
  // Fetch GIF thumbnails for exercises without a curated URL (cached afterwards).
  useEffect(() => {
    EXERCISES.filter((e) => !cachedGif(e)).forEach((e) => loadGif(e).then((u) => u && force((n) => n + 1)));
  }, []);
  return (
    <div className="tab gap18">
      <span className="h2-22">Biblioteca de exercícios</span>
      <div className="col" style={{ gap: 10 }}>
        {EXERCISES.map((ex) => {
          const gif = cachedGif(ex);
          return (
            <div key={ex.id} className="card p14 row click" style={{ gap: 12 }} onClick={() => openDetail('exerciseDetail', { exerciseId: ex.id })}>
              <div className={`thumb${gif ? '' : ' placeholder'}`} style={gif ? { backgroundImage: `url("${gif}")` } : undefined} />
              <div className="col" style={{ flex: 1 }}>
                <span className="t15">{ex.name}</span>
                <span className="t13">{ex.category} · Progressão nível {progressionLevel(ex, profile.strengthLevel) + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Evolução ----------------

export function EvolucaoTab() {
  const { workouts, activities, settings, activeFilter, setActiveFilter, userDoc, selectTab, setIntegracoesOpen } = useStore();
  const month = monthSummary(workouts, activities);
  const bars = paceByWeek(workouts, activities, PERIOD_DAYS[activeFilter] ?? 30);
  const stravaOn = !!userDoc?.integrations?.strava?.connected;
  const lastBar = bars.length - 1;
  return (
    <div className="tab">
      <span className="h2-22">Este mês</span>
      <div className="grid2">
        <div className="stat lg"><span className="v">{month.sessions}</span><span className="l">treinos</span></div>
        <div className="stat lg"><span className="v accent">{month.adherence != null ? `${month.adherence}%` : '—'}</span><span className="l">aderência</span></div>
        <div className="stat lg"><span className="v">{distLabel(month.runDistanceM, settings.unit)}</span><span className="l">corrida</span></div>
        <div className="stat lg"><span className="v">{month.strengthSessions}</span><span className="l">sessões de força</span></div>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, overflowX: 'auto' }}>
          {Object.keys(PERIOD_DAYS).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} className="nowrap" style={{
              cursor: 'pointer', padding: '8px 12px', borderRadius: 10, font: '600 12px var(--fb)',
              background: activeFilter === f ? 'var(--orange)' : 'var(--surface)', color: activeFilter === f ? '#000' : 'var(--text2)',
              border: `1px solid ${activeFilter === f ? 'var(--orange)' : 'var(--border)'}`,
            }}>{f}</button>
          ))}
        </div>
        <span className="section-label">PACE POR SEMANA</span>
        <div className="card row" style={{ alignItems: 'flex-end', gap: 8, height: 120 }}>
          {bars.map((b, i) => (
            <div key={b.label} className="col" style={{ flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: '100%' }}
              title={b.paceSecPerKm ? paceLabel(b.paceSecPerKm, settings.unit) : 'sem corridas'}>
              <div style={{ width: '100%', height: `${b.heightPct}%`, background: i === lastBar && b.paceSecPerKm ? 'var(--orange)' : 'var(--surface2)', borderRadius: 4 }} />
              <span style={{ font: '500 10px var(--fb)', color: 'var(--text2)' }}>{b.label}</span>
            </div>
          ))}
        </div>
        {bars.every((b) => b.paceSecPerKm == null) && (
          <span className="t13">Sem corridas com distância no período. Use o GPS no treino ou conecte o Strava.</span>
        )}
      </div>
      <div className="col" style={{ gap: 10 }}>
        <span className="section-label">DADOS DO DISPOSITIVO</span>
        {stravaOn ? (
          <div className="list">
            {deviceMetrics(activities).map((dm) => (
              <div key={dm.label} className="list-row dm">
                <span style={{ font: '500 14px var(--fb)', color: 'var(--text2)' }}>{dm.label}</span>
                <span style={{ font: '700 14px var(--fb)', color: 'var(--text)' }}>{dm.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card dashed col" style={{ padding: 18, gap: 8, alignItems: 'center', textAlign: 'center' }}>
            <span className="t13">Conecte Strava ou Garmin Connect para ver frequência cardíaca, carga de treino, sono e VO2 max aqui.</span>
            <button className="link" onClick={() => { selectTab('perfil'); setIntegracoesOpen(true); }}>Ir para Integrações →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Perfil ----------------

const PROFILE_ROWS: { label: string; detail?: Detail }[] = [
  { label: 'Dados pessoais', detail: 'dadosPessoais' }, { label: 'Objetivo', detail: 'objetivo' },
  { label: 'Capacidade', detail: 'capacidade' }, { label: 'Disponibilidade', detail: 'disponibilidade' },
  { label: 'Equipamentos', detail: 'equipamentos' }, { label: 'Integrações' },
  { label: 'Configurações', detail: 'config' }, { label: 'Sobre', detail: 'sobre' },
];

export function PerfilTab() {
  const { profile, integracoesOpen, setIntegracoesOpen, openDetail, generatePlan, userDoc, showToast } = useStore();
  const [busy, setBusy] = useState(false);
  const strava = userDoc?.integrations?.strava;
  const initials = profile.name ? profile.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : 'VT';

  const toggleStrava = async () => {
    setBusy(true);
    try {
      if (strava?.connected) { await disconnectStrava(); showToast('Strava desconectado.'); }
      else await connectStrava();
    } catch (e) {
      console.warn(e);
      showToast('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };
  const sync = async () => {
    setBusy(true);
    try { const n = await syncStrava(); showToast(n ? `${n} atividades sincronizadas.` : 'Tudo em dia.'); }
    catch { showToast('Falha ao sincronizar.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="tab gap18">
      <div className="row" style={{ gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface2)', border: '2px solid var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 20px var(--fd)', color: 'var(--orange)', flexShrink: 0 }}>{initials}</div>
        <div className="col">
          <span style={{ font: '700 18px var(--fd)', color: 'var(--text)' }}>{profile.name || 'Atleta'}</span>
          <span className="t13">{profile.goal}</span>
        </div>
      </div>
      <div className="list">
        {PROFILE_ROWS.map((r) => (
          <div key={r.label} className="list-row click" onClick={() => (r.detail ? openDetail(r.detail) : setIntegracoesOpen(!integracoesOpen))}>
            <span className="t15">{r.label}</span>
            <span style={{ font: '600 14px var(--fb)', color: 'var(--text2)' }}>›</span>
          </div>
        ))}
      </div>
      {integracoesOpen && (
        <div className="col" style={{ gap: 10 }}>
          <div className="card row" style={{ justifyContent: 'space-between' }}>
            <div className="col" style={{ gap: 2 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="t15">Strava</span>
                {strava?.connected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />}
              </div>
              {strava?.connected && strava.athleteName && <span className="t13">{strava.athleteName}</span>}
            </div>
            <div className="row" style={{ gap: 14 }}>
              {strava?.connected && <button className="link" style={{ color: 'var(--text2)' }} disabled={busy} onClick={sync}>Sincronizar</button>}
              <button className="link" disabled={busy} style={{ color: strava?.connected ? 'var(--text2)' : 'var(--orange)' }} onClick={toggleStrava}>
                {busy ? '…' : strava?.connected ? 'Desconectar' : 'Conectar'}
              </button>
            </div>
          </div>
          <div className="card row" style={{ justifyContent: 'space-between' }}>
            <span className="t15">Garmin Connect</span>
            <span style={{ font: '600 13px var(--fb)', color: 'var(--text2)' }}>Em breve</span>
          </div>
        </div>
      )}
      <button className="btn-outline" onClick={generatePlan}>Recalcular meu plano</button>
    </div>
  );
}
