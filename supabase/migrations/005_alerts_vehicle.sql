-- Capacidade e foto do veículo, e avisos do transportador durante a viagem.
-- Rode no SQL Editor depois da 004.

alter table public.vehicles
  add column if not exists capacity integer,
  add column if not exists photo text;

create table if not exists public.trip_alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists trip_alerts_trip_idx on public.trip_alerts (trip_id, created_at desc);

alter table public.trip_alerts enable row level security;

drop policy if exists trip_alerts_select on public.trip_alerts;
create policy trip_alerts_select on public.trip_alerts
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_alerts.trip_id
        and (
          public.owns_group(t.group_id)
          or public.is_group_member(t.group_id)
          or exists (
            select 1 from public.group_members gm
            where gm.group_id = t.group_id and public.follows_passenger(gm.user_id)
          )
        )
    )
  );

drop policy if exists trip_alerts_insert on public.trip_alerts;
create policy trip_alerts_insert on public.trip_alerts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_alerts.trip_id
        and public.owns_group(t.group_id)
        and public.is_transporter()
    )
  );

grant select, insert on public.trip_alerts to authenticated;
grant all on public.trip_alerts to service_role;
