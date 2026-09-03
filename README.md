# EmbarqueAI

App mobile de **transporte escolar / van** para duas pontas do mesmo trajeto: a família acompanha a van no mapa, o transportador organiza rotas, veículos e grupos.

Idioma **pt-BR**. MVP em Expo (SDK 57), com dados mock no aparelho. Ainda **não** usa Google Maps Platform, Supabase nem Cloudflare — a UI e os serviços já estão no formato para encaixar isso depois.

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

Recuperação de senha no MVP: informe o e-mail → código **`123456`** → nova senha.

## Como rodar (do zero)

Você precisa de **Node.js 20+** e do app **Expo Go** no celular (ou um simulador iOS/Android).

```bash
git clone https://github.com/gabriel-adorno/embarqueai.git
cd embarqueai
npm install
npx expo start
```

Depois:

1. Abra o **Expo Go** e leia o QR code do terminal  
   - iOS: câmera nativa também funciona  
   - Android: QR pelo próprio Expo Go
2. No computador, atalhos do Metro: `i` (simulador iOS) · `a` (emulador Android)

O **mapa de verdade** só aparece no celular ou no simulador. Web é só fallback. Não é obrigatório ter arquivo `.env` para este MVP.

### Contas de teste

| Papel | E-mail | Senha |
| --- | --- | --- |
| Cliente | `cliente@embarqueai.com` | `senha123` |
| Transportador | `transportador@embarqueai.com` | `senha123` |

Fluxo sugerido no transportador: **veículo → rota → grupo (membros) → iniciar rota**. No cliente: entrar e acompanhar o grupo / a viagem ao vivo.

## Stack

- **Expo SDK 57** + Expo Router + TypeScript
- React Native, Zustand, TanStack Query, React Hook Form + Zod
- Mapa: `react-native-maps` por um adapter (sem `PROVIDER_GOOGLE` neste MVP)
- Persistência local: memória + AsyncStorage (API no estilo Supabase)

## Pastas

```
app/                 telas (Expo Router)
src/components/      UI e mapa
src/services/        auth, vans, rotas, grupos, viagem (mock)
src/store/           sessão e toasts
src/theme/           cores e layout
```

Trocar o **corpo** dos arquivos em `src/services/` pelo backend real; a UI pode permanecer.

## Depois do MVP

Quando for integrar de verdade:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Copie `.env.example` para `.env.local`. A chave do Google Maps entra no **app nativo** (SDK), não em Worker.

1. **App** → EAS → App Store / Google Play  
2. **Supabase** → Auth e-mail/senha, Postgres, RLS, Realtime na viagem  
3. **Google Maps** → `PROVIDER_GOOGLE` + Directions/Geocoding no adapter  
4. **Cloudflare** → site/admin (Pages), CDN; não substitui o banco do Supabase  

## Licença

O template Expo neste repositório segue a licença MIT do Expo (veja `LICENSE`).
