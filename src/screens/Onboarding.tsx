import { useEffect, useState } from 'react';
import {
  BasicFields, CapacityFields, DaysPicker, DurationPicker, EquipmentPicker, GoalList, LocationPicker,
} from '../components/ProfileFields';
import { PhotoSlot } from '../components/PhotoSlot';
import { Section, Segmented } from '../components/ui';
import { appleEnabled, authErrorMessage, resetPassword, signInApple, signInEmail, signInGoogle, signUpEmail } from '../lib/auth';
import { useStore } from '../state/store';

export function Splash() {
  const { leaveSplash, user } = useStore();
  // Returning users skip the tap; first-time users tap to continue (as in the design).
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(leaveSplash, 900);
    return () => clearTimeout(t);
  }, [user, leaveSplash]);
  return (
    <div onClick={leaveSplash} style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, cursor: 'pointer' }}>
      <img src="/vanta-icon.png" alt="Vanta" style={{ width: 72, height: 'auto' }} />
      <span style={{ font: '800 24px var(--fd)', color: 'var(--text)', letterSpacing: 2 }}>VANTA</span>
    </div>
  );
}

export function Welcome() {
  const { goAuth } = useStore();
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 28px', justifyContent: 'space-between' }}>
      <div style={{ height: '40%', borderRadius: 20 }}>
        <PhotoSlot placeholder="Carregue sua foto" />
      </div>
      <div className="col" style={{ gap: 14 }}>
        <h1 className="h1">Seu treino. Seu ritmo. Sua evolução.</h1>
        <p style={{ margin: 0, font: '400 16px/1.5 var(--fb)', color: 'var(--text2)' }}>Um plano criado para o seu objetivo e adaptado à sua rotina.</p>
        <button className="btn-primary" style={{ marginTop: 8 }} onClick={goAuth}>Começar</button>
      </div>
    </div>
  );
}

const AUTH_MODES = ['Criar conta', 'Entrar'] as const;

/** Account screen (not in the prototype): follows the onboarding visual language. */
export function AuthScreen() {
  const { goWelcome } = useStore();
  const [mode, setMode] = useState<(typeof AUTH_MODES)[number]>('Criar conta');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setInfo(null);
    try { await fn(); } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  };
  const submit = () => run(() => (mode === 'Criar conta' ? signUpEmail(email, password) : signInEmail(email, password)));
  const forgot = () => {
    if (!email) { setError('Informe seu e-mail acima para redefinir a senha.'); return; }
    run(async () => { await resetPassword(email); setInfo('Enviamos um link de redefinição para o seu e-mail.'); });
  };

  return (
    <div className="screen gap22">
      <button className="btn-back" onClick={goWelcome} aria-label="Voltar">←</button>
      <div className="col" style={{ gap: 6 }}>
        <span className="step-label">SUA CONTA</span>
        <h2 className="h2">{mode === 'Criar conta' ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
      </div>
      <Segmented options={AUTH_MODES} value={mode} onChange={(m) => { setMode(m); setError(null); }} />
      <form className="col" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="email" />
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha"
          autoComplete={mode === 'Criar conta' ? 'new-password' : 'current-password'} />
        {mode === 'Entrar' && (
          <button type="button" className="link" style={{ alignSelf: 'flex-end' }} onClick={forgot}>Esqueci minha senha</button>
        )}
        {error && <span className="error-text">{error}</span>}
        {info && <span className="t13" style={{ color: 'var(--success)' }}>{info}</span>}
        <button className="btn-primary" type="submit" disabled={busy || !email || !password}>{mode}</button>
      </form>
      <div className="row" style={{ gap: 12 }}>
        <div className="divider" style={{ flex: 1 }} />
        <span className="t13">ou</span>
        <div className="divider" style={{ flex: 1 }} />
      </div>
      <div className="col" style={{ gap: 10 }}>
        <button className="btn-secondary" disabled={busy} onClick={() => run(signInGoogle)}>Continuar com Google</button>
        {appleEnabled && <button className="btn-secondary" disabled={busy} onClick={() => run(signInApple)}>Continuar com Apple</button>}
      </div>
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="step-label">PASSO {n} DE 5</span>
      <h2 className="h2">{title}</h2>
    </div>
  );
}

export function BasicStep() {
  const { setStep } = useStore();
  return (
    <div className="screen gap22">
      <StepHeader n={1} title="Dados básicos" />
      <BasicFields />
      <div className="spacer" />
      <button className="btn-primary" onClick={() => setStep('goal')}>Continuar</button>
    </div>
  );
}

export function GoalStep() {
  const { setStep, profile } = useStore();
  return (
    <div className="screen">
      <StepHeader n={2} title="Qual é o seu objetivo?" />
      <GoalList />
      <div className="spacer" />
      <button className="btn-primary" disabled={!profile.goal} onClick={() => setStep('capacity')}>Continuar</button>
    </div>
  );
}

export function CapacityStep() {
  const { setStep } = useStore();
  return (
    <div className="screen">
      <StepHeader n={3} title="Sua capacidade hoje" />
      <CapacityFields />
      <div className="spacer" />
      <button className="btn-primary" onClick={() => setStep('availability')}>Continuar</button>
    </div>
  );
}

export function AvailabilityStep() {
  const { generatePlan } = useStore();
  return (
    <div className="screen">
      <StepHeader n={4} title="Sua disponibilidade" />
      <DaysPicker />
      <DurationPicker />
      <LocationPicker />
      <Section label="EQUIPAMENTOS"><EquipmentPicker /></Section>
      <div className="spacer" />
      <button className="btn-primary" onClick={generatePlan}>Gerar meu plano</button>
    </div>
  );
}

export function Generating({ label = 'Analisando seu perfil...' }: { label?: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 28 }}>
      <div className="spinner" />
      <span className="pulse" style={{ font: '600 16px var(--fb)', color: 'var(--text)' }}>{label}</span>
    </div>
  );
}

export function Created() {
  const { plan, profile, setStep } = useStore();
  return (
    <div className="screen gap22">
      <div className="spacer" />
      <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 26px var(--fb)', color: '#000' }}>✓</div>
        <h2 className="h2" style={{ fontSize: 26 }}>Seu plano está pronto.</h2>
        <div className="card r20 col" style={{ width: '100%', gap: 14, textAlign: 'left' }}>
          <span style={{ font: '700 20px var(--fd)', color: 'var(--orange)' }}>{plan?.name ?? '—'}</span>
          <span className="t14">{plan ? `${plan.weeks} semanas · ${plan.sessionsPerWeek} treinos por semana` : ''}</span>
          <div className="divider" />
          <span className="section-label">OBJETIVO</span>
          <span style={{ font: '600 16px var(--fb)', color: 'var(--text)' }}>{profile.goal}</span>
        </div>
      </div>
      <div className="spacer" />
      <button className="btn-primary" onClick={() => setStep('app')}>Ver meu plano</button>
    </div>
  );
}

export function SetupNeeded() {
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <h2 className="h2">Configuração pendente</h2>
      <p className="body-text">
        As chaves do Firebase não foram encontradas. Copie <code>.env.example</code> para <code>.env</code>,
        preencha com os dados do seu projeto Firebase e gere o app novamente (veja o README).
      </p>
    </div>
  );
}
