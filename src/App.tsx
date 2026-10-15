import { useEffect, useRef, type JSX } from 'react';
import { App as CapApp } from '@capacitor/app';
import { listenForStravaReturn } from './lib/api';
import {
  AuthScreen, AvailabilityStep, BasicStep, CapacityStep, Created, Generating, GoalStep, SetupNeeded, Splash, Welcome,
} from './screens/Onboarding';
import {
  Capacidade, Config, DadosPessoais, Disponibilidade, Equipamentos, ExerciseDetail, Objetivo, Sobre,
} from './screens/Overlays';
import { EvolucaoTab, HojeTab, NavBar, PerfilTab, PlanoTab, TreinosTab } from './screens/Tabs';
import { AerobicDetail, AerobicExec, AerobicResult, StrengthDetail, StrengthExec, StrengthResult } from './screens/Workout';
import { useStore, type Detail, type Stage } from './state/store';

const DETAILS: Record<Detail, () => JSX.Element | null> = {
  workoutDetail: AerobicDetail, aerobicExec: AerobicExec, aerobicResult: AerobicResult,
  strengthDetail: StrengthDetail, strengthExec: StrengthExec, strengthResult: StrengthResult,
  exerciseDetail: ExerciseDetail, sobre: Sobre, config: Config,
  dadosPessoais: DadosPessoais, objetivo: Objetivo, capacidade: Capacidade,
  disponibilidade: Disponibilidade, equipamentos: Equipamentos,
};

const STAGES: Partial<Record<Stage, () => JSX.Element>> = {
  splash: Splash, welcome: Welcome, auth: AuthScreen, setup: SetupNeeded,
  basic: BasicStep, goal: GoalStep, capacity: CapacityStep, availability: AvailabilityStep,
  generating: () => <Generating />, created: Created, loading: () => <Generating label="Carregando…" />,
};

function AppShell() {
  const { activeTab, detail, toast } = useStore();
  const Overlay = detail ? DETAILS[detail] : null;
  return (
    <>
      <div className="scrollarea">
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'hoje' && <HojeTab />}
          {activeTab === 'plano' && <PlanoTab />}
          {activeTab === 'treinos' && <TreinosTab />}
          {activeTab === 'evolucao' && <EvolucaoTab />}
          {activeTab === 'perfil' && <PerfilTab />}
        </div>
      </div>
      <NavBar />
      {Overlay && <Overlay />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default function App() {
  const store = useStore();
  const { stage, showToast } = store;
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => listenForStravaReturn((ok) => {
    showToast(ok ? 'Strava conectado ✓' : 'Conexão com o Strava não concluída.');
  }), [showToast]);

  // Android hardware back button.
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      const s = storeRef.current;
      if (s.stage !== 'app') {
        const back: Partial<Record<Stage, () => void>> = {
          auth: s.goWelcome, goal: () => s.setStep('basic'), capacity: () => s.setStep('goal'), availability: () => s.setStep('capacity'),
        };
        if (back[s.stage]) back[s.stage]!();
        else CapApp.exitApp();
        return;
      }
      if (s.detail === 'aerobicExec' || s.detail === 'strengthExec') {
        if (window.confirm('Sair do treino? O progresso desta sessão não será salvo.')) s.closeDetail();
      } else if (s.detail === 'aerobicResult' || s.detail === 'strengthResult') {
        s.selectTab(s.detail === 'aerobicResult' ? 'hoje' : 'plano');
      } else if (s.detail) {
        s.closeDetail();
      } else if (s.activeTab !== 'hoje') {
        s.selectTab('hoje');
      } else {
        CapApp.exitApp();
      }
    });
    return () => { h.then((x) => x.remove()); };
  }, []);

  const Screen = STAGES[stage];
  return (
    <div className="app-root">
      {stage === 'app' ? <AppShell /> : (
        <div className="scrollarea">{Screen ? <Screen /> : null}</div>
      )}
    </div>
  );
}
