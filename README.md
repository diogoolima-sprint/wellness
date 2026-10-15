# VANTA — app de treino (corrida + força)

App mobile (Android/APK via **Capacitor**) recriado a partir do design em [`docs/`](docs/README.md), com:

- **Firebase Auth**: e-mail/senha, Google e (opcional) Apple
- **Firestore**: perfil, configurações, plano, histórico de treinos e atividades do Strava (com cache offline)
- **Cloud Functions**: geração do plano por IA (Claude) e integração **Strava** (OAuth + webhook)
- Execução de treino com cronômetro real (pausa, recuperação automática), **distância por GPS** e lembretes por notificação

```
src/            app React (telas, estado, integrações nativas)
shared/         regras de domínio usadas pelo app e pelas functions (tipos, plano, estatísticas) + testes
functions/      Cloud Functions (generatePlan, strava*)
android/        projeto Android gerado pelo Capacitor
docs/           pacote de handoff do Claude Design (protótipo, screenshots, README)
```

## Como os dados funcionam

| Dado | Onde fica | Quem escreve |
|---|---|---|
| Perfil, configurações, etapa do onboarding | `users/{uid}` | app |
| Plano semanal | `users/{uid}.plan` | function `generatePlan` (ou o app, com o plano por regras, se estiver offline) |
| Treinos feitos no app | `users/{uid}/workouts` | app |
| Atividades do Strava | `users/{uid}/activities` | functions |
| Tokens do Strava | `stravaTokens/{uid}` | só functions (regras bloqueiam o app) |

**Aderência** = quão perto o treino ficou do planejado (tempo, repetições; força = séries feitas / planejadas).
**Distância e pace** vêm do GPS do app e/ou do Strava (se houver os dois no mesmo dia, vale o Strava).
O Strava não fornece **sono** nem **VO2 max** — esses campos aparecem como “requer Garmin” até a integração Garmin existir.

## Plano por IA

`generatePlan` lê o perfil salvo + o histórico das últimas 4 semanas e pede ao **Claude Opus 5.5**
(`claude-opus-5-5`, saída estruturada) um modelo de semana que se repete por N semanas. A resposta é
validada (`shared/plan.ts → sanitizePlan`): só entram os dias escolhidos e exercícios compatíveis com os equipamentos.
Se a IA falhar ou estiver sem chave, cai para o **plano por regras** (`buildRulePlan`) — o app nunca fica travado.
O plano é recalculado em “Recalcular meu plano” e automaticamente quando você altera Objetivo, Capacidade,
Disponibilidade ou Equipamentos no Perfil.

---

## Passo a passo de configuração

### 1. Firebase

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Plano Blaze** (pago por uso; o uso pessoal fica na cota gratuita): necessário para Cloud Functions e para chamar Strava/Claude.
3. **Authentication → Sign-in method**: ative *E-mail/senha* e *Google*.
4. **Firestore Database**: crie o banco (modo produção, região `southamerica-east1`).
5. **Configurações do projeto → Seus apps**:
   - adicione um **app Web** e copie a configuração para `.env` (modelo em `.env.example`);
   - adicione um **app Android** com o pacote `app.vanta.fitness`, informe o **SHA-1** da chave de assinatura
     (`cd android && ./gradlew signingReport`) e baixe o `google-services.json` para `android/app/` (não versionado).
6. Instale a CLI e associe o projeto:
   ```bash
   npm i -g firebase-tools
   firebase login
   cp .firebaserc.example .firebaserc   # troque pelo ID do seu projeto
   ```

### 2. Strava

1. Em <https://www.strava.com/settings/api> crie um app.
2. **Authorization Callback Domain**: `southamerica-east1-SEU-PROJETO.cloudfunctions.net`
3. Copie o **Client ID** para `functions/.env` (modelo em `functions/.env.example`).
4. Guarde o **Client Secret** como segredo (próximo passo).

### 3. Chave da IA (Claude)

Crie uma API key em <https://console.anthropic.com>.

### 4. Segredos e deploy das functions

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set STRAVA_CLIENT_SECRET
firebase functions:secrets:set STRAVA_WEBHOOK_VERIFY_TOKEN   # qualquer texto aleatório
firebase deploy --only firestore:rules,functions
```

### 5. Webhook do Strava (sincronização em tempo real)

Depois do deploy, registre a assinatura uma única vez:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=SEU_CLIENT_ID \
  -F client_secret=SEU_CLIENT_SECRET \
  -F callback_url=https://southamerica-east1-SEU-PROJETO.cloudfunctions.net/stravaWebhook \
  -F verify_token=O_MESMO_STRAVA_WEBHOOK_VERIFY_TOKEN
```

Sem o webhook o app ainda funciona: ao conectar, importa os últimos 120 dias, e o botão **Sincronizar** (Perfil → Integrações) busca o que faltar.

### 6. Gerar o APK

**Opção A — GitHub Actions (sem instalar nada):**
1. Em *Settings → Secrets and variables → Actions* do repositório, crie:
   - `FIREBASE_WEB_ENV`: o conteúdo inteiro do seu `.env`
   - `GOOGLE_SERVICES_JSON`: o conteúdo do `google-services.json`
2. Em *Actions → Android APK → Run workflow*. Ao terminar, baixe o artefato `vanta-debug-apk` e instale no celular.

> O APK de debug é assinado com a chave de debug do runner, que muda a cada execução. Para o login com Google
> funcionar, cadastre o SHA-1 dessa chave no Firebase — ou, melhor, gere uma keystore própria e use a Opção B.

**Opção B — Android Studio:**
```bash
npm install
npm run android        # build + cap sync + abre o Android Studio
```
Depois: *Build → Build APK(s)*.

Ícone e splash saem de `assets/` (ícone “V” da marca). Para regerar: `npm run cap:assets`.

### Apple (opcional)

Exige conta Apple Developer (US$ 99/ano) e configuração do provedor Apple no Firebase. Depois disso, defina `VITE_ENABLE_APPLE=true`.

---

## Desenvolvimento local

```bash
npm install && (cd functions && npm install)
cp .env.example .env.local    # use VITE_FIREBASE_PROJECT_ID=demo-vanta e VITE_USE_EMULATORS=true
printf 'STRAVA_CLIENT_ID=0\n' > functions/.env.local
printf 'ANTHROPIC_API_KEY=sua-chave\nSTRAVA_CLIENT_SECRET=x\nSTRAVA_WEBHOOK_VERIFY_TOKEN=x\n' > functions/.secret.local
firebase emulators:start --project demo-vanta --only auth,firestore,functions
npm run dev
```

```bash
npm test           # regras de plano, aderência, estatísticas, normalização do Strava
npm run typecheck
```

## Limitações conhecidas

- **GPS só em primeiro plano**: com a tela apagada ou o app em segundo plano o Android pode pausar a contagem de distância. Para rastreio em background será preciso um plugin de localização em background. O cronômetro usa horário real, então o tempo continua correto.
- **GIFs** vêm do ExerciseDB (AscendAPI, plano gratuito, uso não comercial, atribuição na tela Sobre). Precisam de internet.
- **Garmin**: fora desta fase (exige aprovação manual da Garmin).
