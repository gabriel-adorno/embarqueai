-- Notificações push (Expo Push Service).
-- Rode no SQL Editor depois das migrations anteriores.

-- Um token por aparelho. O Worker grava e lê com a service_role,
-- então nenhum usuário acessa esta tabela diretamente.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

revoke all on public.push_tokens from anon, authenticated;
grant all on public.push_tokens to service_role;

-- Marca quando o aviso "a van está chegando" já foi enviado na viagem,
-- para não repetir a cada posição recebida.
alter table public.trips
  add column if not exists arrival_notified_at timestamptz;
