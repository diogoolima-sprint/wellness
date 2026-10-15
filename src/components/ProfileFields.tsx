// Field groups shared by the onboarding steps and the Perfil review/edit screens.
import { DAY_LABELS, DURATIONS, EQUIPMENT, GOALS, LOCATIONS, STRENGTH_LEVELS } from '../../shared/catalog';
import { useStore } from '../state/store';
import { Chip, ChipSm, Section } from './ui';

export function BasicFields() {
  const { profile, updateProfile } = useStore();
  return (
    <div className="col" style={{ gap: 14 }}>
      <input className="input" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Nome" autoComplete="name" />
      <div className="row" style={{ gap: 12 }}>
        <input className="input" style={{ flex: 1 }} value={profile.age} onChange={(e) => updateProfile({ age: e.target.value })} placeholder="Idade" inputMode="numeric" />
        <input className="input" style={{ flex: 1 }} value={profile.weight} onChange={(e) => updateProfile({ weight: e.target.value })} placeholder="Peso (kg)" inputMode="decimal" />
      </div>
      <input className="input" value={profile.height} onChange={(e) => updateProfile({ height: e.target.value })} placeholder="Altura (cm)" inputMode="numeric" />
    </div>
  );
}

export function GoalList() {
  const { profile, updateProfile } = useStore();
  return (
    <div className="col" style={{ gap: 10 }}>
      {GOALS.map((g) => <Chip key={g} label={g} check selected={profile.goal === g} onClick={() => updateProfile({ goal: g })} />)}
    </div>
  );
}

export function CapacityFields() {
  const { profile, updateProfile } = useStore();
  return (
    <>
      <Section label="VOCÊ CORRE ATUALMENTE?">
        <div className="row" style={{ gap: 10 }}>
          <ChipSm flex label="Sim" selected={profile.runsNow === true} onClick={() => updateProfile({ runsNow: true })} />
          <ChipSm flex label="Não" selected={profile.runsNow === false} onClick={() => updateProfile({ runsNow: false })} />
        </div>
      </Section>
      {profile.runsNow && (
        <div className="col" style={{ gap: 12 }}>
          <input className="input sm" value={profile.freq} onChange={(e) => updateProfile({ freq: e.target.value })} placeholder="Quantas vezes por semana?" inputMode="numeric" />
          <input className="input sm" value={profile.avgDist} onChange={(e) => updateProfile({ avgDist: e.target.value })} placeholder="Distância média (km)" inputMode="decimal" />
          <input className="input sm" value={profile.avgPace} onChange={(e) => updateProfile({ avgPace: e.target.value })} placeholder="Pace aproximado (min/km)" />
          <input className="input sm" value={profile.maxDist} onChange={(e) => updateProfile({ maxDist: e.target.value })} placeholder="Maior distância recente (km)" inputMode="decimal" />
        </div>
      )}
      <Section label="NÍVEL DE FORÇA">
        {STRENGTH_LEVELS.map((l) => (
          <Chip key={l} label={l} selected={profile.strengthLevel === l} onClick={() => updateProfile({ strengthLevel: l })} />
        ))}
      </Section>
    </>
  );
}

export function DaysPicker() {
  const { profile, updateProfile } = useStore();
  const toggle = (i: number) =>
    updateProfile({ days: profile.days.includes(i) ? profile.days.filter((d) => d !== i) : [...profile.days, i] });
  return (
    <Section label="QUANTOS DIAS POR SEMANA?">
      <div className="row" style={{ gap: 8 }}>
        {DAY_LABELS.map(([short, full], i) => (
          <button type="button" key={full} aria-label={full} className={`chip-sm flex1${profile.days.includes(i) ? ' on' : ''}`} onClick={() => toggle(i)} style={{ paddingLeft: 0, paddingRight: 0 }}>
            {short}
          </button>
        ))}
      </div>
    </Section>
  );
}

export function DurationPicker() {
  const { profile, updateProfile } = useStore();
  return (
    <Section label="QUANTO TEMPO?">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {DURATIONS.map((d) => <ChipSm key={d} label={d} selected={profile.duration === d} onClick={() => updateProfile({ duration: d })} />)}
      </div>
    </Section>
  );
}

export function LocationPicker() {
  const { profile, updateProfile } = useStore();
  return (
    <Section label="ONDE?">
      <div className="row" style={{ gap: 8 }}>
        {LOCATIONS.map((l) => <ChipSm flex key={l} label={l} selected={profile.location === l} onClick={() => updateProfile({ location: l })} />)}
      </div>
    </Section>
  );
}

export function EquipmentPicker() {
  const { profile, updateProfile } = useStore();
  const toggle = (e: string) =>
    updateProfile({ equipment: profile.equipment.includes(e) ? profile.equipment.filter((x) => x !== e) : [...profile.equipment, e] });
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {EQUIPMENT.map((e) => <ChipSm key={e} label={e} selected={profile.equipment.includes(e)} onClick={() => toggle(e)} />)}
    </div>
  );
}
