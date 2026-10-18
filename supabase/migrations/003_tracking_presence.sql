-- GPS real, ausências do dia e embarque/desembarque.
-- Rode no SQL Editor do Supabase depois das migrations anteriores.

alter table public.trip_positions
  add column if not exists source text not null default 'sim';

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  absent_on date not null default ((timezone('America/Sao_Paulo', now()))::date),
  created_at timestamptz not null default now(),
  unique (group_id, user_id, absent_on)
);

create table if not exists public.boardings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('boarded', 'alighted')),
  recorded_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists absences_group_day_idx on public.absences (group_id, absent_on);
create index if not exists boardings_trip_idx on public.boardings (trip_id);

alter table public.absences enable row level security;
alter table public.boardings enable row level security;

drop policy if exists absences_select on public.absences;
create policy absences_select on public.absences
  for select to authenticated
  using (public.owns_group(group_id) or user_id = auth.uid());

drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists boardings_select on public.boardings;
create policy boardings_select on public.boardings
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = boardings.trip_id
        and (public.owns_group(t.group_id) or public.is_group_member(t.group_id))
    )
  );

drop policy if exists boardings_write on public.boardings;
create policy boardings_write on public.boardings
  for all to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = boardings.trip_id and public.owns_group(t.group_id)
    )
    and public.is_transporter()
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = boardings.trip_id and public.owns_group(t.group_id)
    )
    and public.is_transporter()
  );

grant select, insert, update, delete on public.absences to authenticated;
grant select, insert, update, delete on public.boardings to authenticated;
grant all on public.absences to service_role;
grant all on public.boardings to service_role;
