import { useEffect, useState } from 'react';
import { exerciseById, progressionLevel } from '../../shared/catalog';
import type { Settings, ThemeSetting, UnitSetting } from '../../shared/types';
import {
  BasicFields, CapacityFields, DaysPicker, DurationPicker, EquipmentPicker, GoalList, LocationPicker,
} from '../components/ProfileFields';
import { BackButton, Overlay, Section, Segmented, Toggle } from '../components/ui';
import { signOut } from '../lib/auth';
import { clearOfflineCache } from '../lib/firebase';
import { cachedGif, loadGif } from '../lib/gifs';
import { requestGpsPermission } from '../lib/gps';
import { clearLocal, setLocal } from '../lib/localPrefs';
import { requestNotificationPermission } from '../lib/notifications';
import { useStore } from '../state/store';

export function Sobre() {
  const { closeDetail } = useStore();
  return (
    <Overlay className="gap20">
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Sobre</h2>
      <div className="col" style={{ gap: 6 }}>
        <span className="t15">VANTA</span>
        <span className="t13">App de treino pessoal. Uso não comercial.</span>
      </div>
      <div className="card col" style={{ gap: 6 }}>
        <span style={{ font: '600 14px var(--fb)', color: 'var(--text)' }}>GIFs de exercícios</span>
        <span className="t13">Fornecidos por ExerciseDB (via AscendAPI), usados sob licença gratuita para fins não comerciais.</span>
      </div>
      <div className="card col" style={{ gap: 6 }}>
        <span style={{ font: '600 14px var(--fb)', color: 'var(--text)' }}>Dados de atividades</span>
        <span className="t13">Compatível com Strava. Atividades importadas via API do Strava com sua autorização.</span>
      </div>
    </Overlay>
  );
}

const THEMES: readonly ThemeSetting[] = ['Sistema', 'Claro', 'Escuro'];
const UNITS: readonly UnitSetting[] = ['km', 'mi'];

export function Config() {
  const { closeDetail, settings, updateSettings, showToast } = useStore();

  const toggle = async (key: 'notifications' | 'gps' | 'saveData') => {
    const on = !settings[key];
    if (on && key === 'notifications' && !(await requestNotificationPermission())) {
      showToast('Permita notificações nas configurações do Android.');
    }
    if (on && key === 'gps' && !(await requestGpsPermission())) {
      showToast('Permita a localização nas configurações do Android.');
    }
    updateSettings({ [key]: on } as Partial<Settings>);
    if (key === 'saveData') showToast('Vale a partir da próxima abertura do app.');
  };

  const clearData = async () => {
    if (!window.confirm('Apagar os dados salvos neste aparelho? Seus dados na nuvem continuam guardados.')) return;
    try { await clearOfflineCache(); } catch (e) { console.warn(e); }
    clearLocal();
    setLocal('settings', settings);
    window.location.reload();
  };

  const logout = async () => {
    if (!window.confirm('Sair da sua conta neste aparelho?')) return;
    await signOut();
    window.location.reload();
  };

  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Configurações</h2>
      <Section label="TEMA">
        <Segmented options={THEMES} value={settings.theme} onChange={(t) => updateSettings({ theme: t })} />
      </Section>
      <Section label="UNIDADE DE DISTÂNCIA">
        <Segmented options={UNITS} value={settings.unit} onChange={(u) => updateSettings({ unit: u })} />
      </Section>
      <div className="list">
        {([['notifications', 'Notificações'], ['gps', 'Autorização de GPS'], ['saveData', 'Salvamento de dados']] as const).map(([k, label]) => (
          <div key={k} className="list-row">
            <span className="t15">{label}</span>
            <Toggle label={label} on={settings[k]} onClick={() => toggle(k)} />
          </div>
        ))}
      </div>
      <button className="btn-outline danger" onClick={clearData}>Limpar dados salvos no aparelho</button>
      <button className="btn-outline neutral" onClick={logout}>Sair da conta</button>
    </Overlay>
  );
}

export function DadosPessoais() {
  const { closeDetail } = useStore();
  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Dados pessoais</h2>
      <BasicFields />
    </Overlay>
  );
}

export function Objetivo() {
  const { closeDetail } = useStore();
  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Objetivo</h2>
      <GoalList />
    </Overlay>
  );
}

export function Capacidade() {
  const { closeDetail } = useStore();
  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Capacidade</h2>
      <CapacityFields />
    </Overlay>
  );
}

export function Disponibilidade() {
  const { closeDetail } = useStore();
  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Disponibilidade</h2>
      <DaysPicker />
      <DurationPicker />
      <LocationPicker />
    </Overlay>
  );
}

export function Equipamentos() {
  const { closeDetail } = useStore();
  return (
    <Overlay>
      <BackButton onClick={closeDetail} />
      <h2 className="h2-22">Equipamentos</h2>
      <EquipmentPicker />
    </Overlay>
  );
}

/** GIF box with loading/error states (shared with strength execution). */
export function ExerciseGif({ exerciseId, small = false }: { exerciseId: string; small?: boolean }) {
  const ex = exerciseById(exerciseId);
  const [url, setUrl] = useState<string | null>(() => (ex ? cachedGif(ex) : null));
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  useEffect(() => {
    if (!ex) return;
    const known = cachedGif(ex);
    setUrl(known);
    if (known) return;
    setStatus('loading');
    loadGif(ex).then((u) => { setUrl(u); setStatus(u ? 'idle' : 'error'); });
  }, [ex]);
  if (url) return <div className={`gif-box${small ? ' sm' : ''}`} style={{ backgroundImage: `url("${url}")` }} role="img" aria-label={ex?.name} />;
  return (
    <div className={`gif-box gif-placeholder${small ? ' sm' : ''}`}>
      <span style={{ font: '500 12px var(--fb)', color: 'var(--text2)' }}>
        {status === 'loading' ? '[ Carregando GIF… ]' : status === 'error' ? '[ GIF indisponível ]' : '[ GIF de execução em loop ]'}
      </span>
    </div>
  );
}

export function ExerciseDetail() {
  const { closeDetail, selectedExercise, profile } = useStore();
  const ex = exerciseById(selectedExercise ?? '') ?? exerciseById('flexao')!;
  const level = progressionLevel(ex, profile.strengthLevel);
  return (
    <Overlay className="gap18">
      <BackButton onClick={closeDetail} />
      <h2 className="h2">{ex.name}</h2>
      <ExerciseGif exerciseId={ex.id} />
      <span style={{ font: '500 10px var(--fb)', color: 'var(--text2)', opacity: 0.6, marginTop: -8 }}>GIF via AscendAPI (ExerciseDB)</span>
      <p className="body-text">{ex.desc}</p>
      <Section label="MAPA MUSCULAR">
        <div className="card row" style={{ gap: 14 }}>
          <div style={{ width: 64, height: 100, borderRadius: 30, background: 'var(--mn)', position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 14, left: 12, width: 40, height: 30, borderRadius: 8, background: 'var(--mp)' }} />
            <div style={{ position: 'absolute', bottom: 10, left: 8, width: 20, height: 24, borderRadius: 6, background: 'var(--ms)' }} />
            <div style={{ position: 'absolute', bottom: 10, right: 8, width: 20, height: 24, borderRadius: 6, background: 'var(--ms)' }} />
          </div>
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mp)', flexShrink: 0 }} /><span style={{ font: '600 13px var(--fb)', color: 'var(--text)' }}>{ex.primary}</span></div>
            <div className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ms)', flexShrink: 0 }} /><span className="t13">{ex.secondary}</span></div>
          </div>
        </div>
      </Section>
      <Section label={`PROGRESSÃO — ${ex.movement}`}>
        <div className="col">
          {ex.progression.map((label, i) => (
            <div key={label} className="row" style={{ gap: 12, padding: '8px 0' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === level ? 'var(--orange)' : 'var(--border)', flexShrink: 0 }} />
              <span style={{ font: `${i === level ? 700 : 500} 14px var(--fb)`, color: i === level ? 'var(--text)' : 'var(--text2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </Section>
    </Overlay>
  );
}
