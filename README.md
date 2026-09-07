# EmbarqueAI

App mobile de **transporte escolar / van**: a família acompanha a van no mapa; o transportador organiza rotas, veículos e grupos.

Idioma **pt-BR**. Expo SDK 57. Sem `EXPO_PUBLIC_API_URL` o app usa **mock local**. Com a URL do Worker, Auth/dados vão para **Supabase** via **Cloudflare Worker**, e o mapa usa **Google Maps**.

<p>
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black" />
</p>

## O que o app faz

| Cliente | Transportador |
| --- | --- |
| Entra com o papel de família | Entra com o papel de operação |
| Vê a van no mapa quando a rota está ao vivo | Cadastra veículo (tipo e placa) |
| Acompanha o grupo / van vinculada | Cria rota com pontos (lat/lng) |
| | Monta grupo (van + rota + membros por e-mail) |
| | Inicia e encerra o trajeto |

**Mock:** recuperação de senha usa o código `123456`.  
**Backend real:** o código chega no e-mail do Supabase Auth.

## Como rodar (mock, do zero)

Node.js 20+ e Expo Go (ou simulador). Sem `.env` o mock basta.

```bash
git clone https://github.com/gabriel-adorno/embarqueai.git
cd embarqueai
npm install
npx expo start
```

O mapa nativo só no celular/simulador. Web é fallback.

### Contas de teste (mock e seed)

| Papel | E-mail | Senha |
| --- | --- | --- |
| Cliente | `cliente@embarqueai.com` | `senha123` |
| Transportador | `transportador@embarqueai.com` | `senha123` |

Fluxo no transportador: **veículo → rota → grupo (membros) → iniciar rota**. No cliente: entrar e acompanhar.

## Backend (Supabase + Worker + Google Maps)

```
Expo app  →  Cloudflare Worker  →  Supabase (Auth + Postgres + RLS)
                 ↓
         Google Geocoding / Directions
Expo app  →  Google Maps SDK (tiles)
```

A chave de **servidor** do Google fica só no Worker. O app só leva a chave de **SDK** (iOS/Android).

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Authentication → Providers → Email ligado. Para o seed funcionar fácil, desligue **Confirm email** (ou confirme os usuários no dashboard).
3. SQL Editor: cole e rode [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
4. Settings → API: copie URL, `anon` e `service_role`.

### 2. Cloudflare Worker

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
# preencha SUPABASE_* e GOOGLE_MAPS_SERVER_KEY
npx wrangler login
npx wrangler dev          # http://localhost:8787
npx wrangler deploy       # URL pública *.workers.dev
```

Secrets em produção (não commitar `.dev.vars`):

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GOOGLE_MAPS_SERVER_KEY
```

Seed das contas demo (depois da migration):

```bash
cd worker && npm run seed
```

### 3. Google Cloud

Ative: **Maps SDK for Android**, **Maps SDK for iOS**, **Geocoding API**, **Directions API**.

- Chave **SDK** (restrita ao bundle/package `com.vango.app`) → `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Chave **servidor** (Geocoding + Directions) → `GOOGLE_MAPS_SERVER_KEY` no Worker

No SDK 57 o **Google Maps não funciona no Expo Go**. Use development build:

```bash
npx expo run:ios
# ou
npx expo run:android
```

### 4. App apontando para o Worker

Copie `.env.example` para `.env.local`. Produção:

```
EXPO_PUBLIC_API_URL=https://embarqueai-api.gabrielviniciusadorno.workers.dev
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Worker local: `EXPO_PUBLIC_API_URL=http://localhost:8787` (emulador Android `http://10.0.2.2:8787`; celular físico, IP da LAN e `wrangler dev --ip 0.0.0.0`). Reinicie o Expo depois de mudar a URL.

## Credenciais para enviar (checklist)

Não envie senha da conta Google/Cloudflare. Envie:

1. Cloudflare: login `wrangler` feito (ou API token de Workers) + Account ID se pedir
2. `SUPABASE_URL` (`https://xxxx.supabase.co`)
3. `SUPABASE_ANON_KEY`
4. `SUPABASE_SERVICE_ROLE_KEY` (só Worker/seed)
5. `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (SDK)
6. `GOOGLE_MAPS_SERVER_KEY` (Geocoding + Directions)

## Stack

- Expo SDK 57 + Expo Router + TypeScript
- Worker: Hono em Cloudflare Workers
- Supabase Auth + Postgres (RLS)
- `react-native-maps` com `PROVIDER_GOOGLE` quando a chave SDK existe

## Pastas

```
app/                 telas
src/services/        mock + remote (Worker)
worker/              API Cloudflare
supabase/migrations  SQL
```

## Licença

O template Expo neste repositório segue a licença MIT do Expo (veja `LICENSE`).
