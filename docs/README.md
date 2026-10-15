# Handoff: VANTA — App de Treino Pessoal

## Overview
VANTA é um app mobile de treino (corrida + força) com onboarding personalizado, plano semanal, execução de treino guiada, biblioteca de exercícios com GIFs de demonstração, acompanhamento de evolução e integrações com wearables (Strava/Garmin).

## About the Design Files
The files in this bundle are **design references created in HTML** (a single-file interactive prototype) — not production code to copy directly. The task is to recreate these designs in the target codebase's environment (likely React Native or Capacitor + web stack, per the chosen APK packaging route) using that stack's own component/state patterns, calling the real backend described below instead of localStorage/mocked data.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy (in Portuguese) are final. Recreate pixel-accurately. All numeric data shown (percentages, distances, bpm, etc.) is currently mocked — replace with real computed/fetched values per the Data section below.

## Screens / Views
All screens live in one state machine (`obStep` for onboarding, `activeTab`/`detail` for the app shell) inside `VANTA FITNESS APP.dc.html`.

1. **Splash** — VANTA icon + wordmark, tap to continue.
2. **Welcome** — headline, subcopy, athlete photo slot, "Começar" CTA.
3. **Onboarding — Dados básicos** (step 1/5): nome, idade, peso, altura.
4. **Onboarding — Objetivo** (step 2/5): grid of goal chips (ex: Correr 5km, 10km, Condicionamento + Força, custom).
5. **Onboarding — Capacidade** (step 3/5): corre atualmente (sim/não) + campos condicionais (frequência, distância média, pace, maior distância), nível de força (4 chips).
6. **Onboarding — Disponibilidade** (step 4/5): dias por semana, duração, local, equipamentos (multi-select chips).
7. **Onboarding — Gerando plano**: spinner + "Analisando seu perfil...".
8. **Onboarding — Plano pronto**: resumo do plano gerado (nome, duração, frequência) → "Ver meu plano".
9. **App shell**: 5 tabs — Hoje, Plano, Treinos, Evolução, Perfil — bottom nav bar.
   - **Hoje**: treino do dia (card com tipo, duração, zona, CTA "Começar treino") ou estado "Treino concluído ✓"; resumo de aderência.
   - **Plano**: lista semanal de treinos (dia, título, subtítulo, status com cor), clique abre detalhe.
   - **Treinos** (Biblioteca de exercícios): lista com thumbnail (GIF do exercício), nome, categoria, nível de progressão; clique abre detalhe do exercício (GIF ampliado, músculos trabalhados, escada de progressão).
   - **Evolução**: cards de resumo do mês (treinos, aderência, km, sessões de força), filtro de período, gráfico de pace por semana, bloco "Dados do dispositivo" (freq. cardíaca, carga de treino, sono, VO2 max, cadência) — só aparece com Strava/Garmin conectado, senão CTA para conectar.
   - **Perfil**: avatar com iniciais, nome + objetivo, lista de linhas (Dados pessoais, Objetivo, Capacidade, Disponibilidade, Equipamentos, Integrações, Configurações, Sobre) cada uma abrindo uma tela de checagem/edição dedicada; botão "Recalcular meu plano".
10. **Detalhe de treino aeróbico**: blocos do treino (aquecimento, intervalos, recuperação) com zona de FC, CTA "Iniciar treino".
11. **Execução de treino aeróbico**: timer ao vivo, zona atual, pace alvo, próximo bloco, pausar/avançar.
12. **Resultado do treino aeróbico**: % de aderência, CTA concluir.
13. **Detalhe de treino de força**: lista de exercícios do dia, CTA "Iniciar treino".
14. **Execução de força**: série atual, reps, descanso com timer, "Concluir série" / "Pular descanso".
15. **Resultado do treino de força**: % de séries completadas.
16. **Detalhe de exercício**: GIF em loop (ExerciseDB via AscendAPI, atribuição exigida), descrição, músculos primário/secundário, escada de progressão com nível atual destacado.
17. **Integrações** (dentro de Perfil): cards Strava / Garmin Connect com indicador de conexão e botão Conectar/Desconectar.
18. **Configurações**: tema (Sistema/Claro/Escuro — já aplica cores em tempo real), unidade (km/mi), notificações, GPS, salvamento de dados (toggles), botão limpar dados locais.
19. **Sobre**: nome do app, atribuição legal do ExerciseDB/AscendAPI.

## Interactions & Behavior
- Onboarding is a linear 5-step wizard; "Continuar" advances, validated minimally (ex: Objetivo precisa de seleção antes de habilitar Continuar).
- Perfil rows for Dados pessoais/Objetivo/Capacidade/Disponibilidade/Equipamentos open **read/edit-in-place screens** (not the onboarding wizard) — editing a field there mutates the same `profile` state and does not chain into subsequent onboarding steps.
- Tab switching resets any open `detail` overlay.
- Workout execution screens use `setInterval` timers for countdowns (aerobic intervals, strength rest). These are prototype timers — replace with real elapsed-time tracking in production, ideally backed by background-safe timers (the app will background during real workouts).
- GIF loading: static URL map for 4 core exercises; a fallback fetch to `https://oss.exercisedb.dev/api/v1/exercises?name=...` for any exercise without a curated URL (see Data section).
- Theme switching recomputes a CSS custom-property block per render and applies it inline on the root element — reproduce as your framework's equivalent (CSS variables / theme context), including a "Sistema" mode that follows `prefers-color-scheme` and reacts live to OS changes.
- All settings/profile/integration-connected state persists to `localStorage` today — replace with real backend persistence (see Backend section).

## State Management (current prototype)
- `profile`: name, age, weight, height, goal, customTarget, runsNow, freq, avgDist, avgPace, maxDist, strengthLevel, days[], duration, location, equipment[]
- `settings`: notifications, theme, unit, gps, saveData
- `integrations`: { strava: bool, garmin: bool } — currently just a local toggle, no real OAuth
- `todayCompleted`, `activeTab`, `detail`, `selectedExercise`
- `gifCache` / `gifStatus`: per-exercise-id GIF URL cache + load status

## Design Tokens
```
--vanta-primary: #FF6B1A        (--orange)
--vanta-orange-light: #FF8A4C   (--orangeL)
--vanta-orange-dark: #D94F00    (--orangeD)
--vanta-background: #0A0A0A     (--bg, dark theme)
--vanta-surface: #151515        (--surface, dark theme)
--vanta-surface-elevated: #202020 (--surface2, dark theme)
--vanta-border: #2A2A2A         (--border, dark theme)
--vanta-text-primary: #FFFFFF   (--text, dark theme)
--vanta-text-secondary: #A3A3A3 (--text2, dark theme)
--vanta-success: #39C477
--vanta-warning: #FFC857
--vanta-error: #EF4444

Light theme (added for the theme switcher):
--bg: #F5F5F5, --surface: #FFFFFF, --surface2: #ECECEC,
--border: #DEDEDE, --text: #0A0A0A, --text2: #5C5C5C

Zone colors: --z1 #8BC7A8, --z2 #62B78F, --z3 #FFC857, --z4 #F2994A, --z5 #E85D5D
Fonts: --fd 'Sora' (display/headings), --fb 'Inter' (body)
Font sizes in use: 11–13px (labels/meta), 14–16px (body), 18–26px (headings), 34px (hero), 44–64px (big stats/timers)
Border radius: 12–16px (cards), 20px (large cards/avatar), 50% (circular), 14px (buttons/inputs)
```

## Assets
- `assets/vanta-logo.png` — full lockup (icon + wordmark), user-provided.
- `assets/vanta-icon.png` — icon mark only (cropped from the logo), used on the dark splash screen and recommended as the APK/app-icon source.
- Exercise GIFs: served live from ExerciseDB (via AscendAPI, free non-commercial tier) — `https://static.exercisedb.dev/media/*.gif`. **Attribution required** wherever GIFs are shown or in an About screen (already added). For offline/commercial use, cache GIFs locally or upgrade to a paid tier.
- Athlete photo on Welcome screen: an `<image-slot>` placeholder (drag-and-drop) — the user fills this with their own photo; ships empty by default.

## Backend requirements (to build in Claude Code)

### Scope
Full backend: OAuth (Strava) + persistence of user accounts, profile, plan, workout history, and settings — replacing the current localStorage-only prototype.

### Stack
- **Database/Auth**: Firebase or Supabase (user's choice between the two is open — either covers auth + a document/relational store + storage for assets).
- **Auth methods**: email/password AND social login (Google + Apple) — needed for whichever provider is chosen (Firebase Auth or Supabase Auth both support this directly).

### Strava integration — step by step
1. Go to strava.com/settings/api and create an app (free, self-serve, instant). You'll get a **Client ID** and **Client Secret**.
2. Set the **Authorization Callback Domain** to your backend's domain (e.g. `api.vantaapp.com`).
3. Implement OAuth2 Authorization Code flow:
   - Redirect user to `https://www.strava.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&scope=activity:read_all`
   - Strava redirects back with a `code`; exchange it server-side for `access_token` + `refresh_token` via `POST https://www.strava.com/oauth/token`.
   - Store tokens server-side (never in the app), tied to the user's account. Access tokens expire (~6h) — use the refresh token to renew.
4. Fetch data via `GET /athlete/activities` (paginated) for historical data, or subscribe to **Strava Webhooks** (push events on new/updated activities) for real-time sync — recommended over polling.
5. Normalize incoming activities (distance, pace, heart rate, type) into VANTA's own workout/evolution data model.

### Garmin
Skipped for now per product decision — Strava only in this phase. Garmin Connect requires a manual developer approval process (not self-serve); revisit later if needed.

### Plan generation
Use an LLM (e.g. Claude) to generate and adapt the weekly plan from the onboarding profile (goal, capacity, availability, equipment) instead of the current fixed/fake "Analisando seu perfil..." animation. Feed it structured profile JSON and have it return a structured plan (days, workout type, duration, zone/intensity) matching the existing plan data shape used by the Plano/Hoje tabs. Re-run on "Recalcular meu plano" and whenever profile fields meaningfully change.

### App icon
Use `assets/vanta-icon.png` as the source for the native app icon and splash screen (already isolated from the wordmark for this purpose).

## Screenshots
See \`screenshots/\` — 01-hoje, 02-plano, 03-treinos, 04-exercicio-detalhe, 05-evolucao, 06-perfil, 07-configuracoes.

## Files
- `VANTA FITNESS APP.dc.html` — full interactive prototype (all screens, state, styles).
- `assets/vanta-logo.png`, `assets/vanta-icon.png` — brand assets.
- `image-slot.js` — drag-and-drop placeholder component used for the athlete photo slot (reference only; reimplement as a native image picker in production).
