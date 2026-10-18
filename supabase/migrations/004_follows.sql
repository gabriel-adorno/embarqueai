-- Responsável acompanha um passageiro. Não é um terceiro tipo de login.
-- Rode no SQL Editor depois das migrations anteriores.

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  passenger_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (guardian_id, passenger_id),
  check (guardian_id <> passenger_id)
);

create index if not exists follows_guardian_idx on public.follows (guardian_id, status);
create index if not exists follows_passenger_idx on public.follows (passenger_id, status);

create or replace function public.follows_passenger(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows f
    where f.guardian_id = auth.uid()
      and f.passenger_id = pid
      and f.status = 'accepted'
  );
$$;

alter table public.follows enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows
  for select to authenticated
  using (guardian_id = auth.uid() or passenger_id = auth.uid());

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (guardian_id = auth.uid() and status = 'pending');

drop policy if exists follows_update on public.follows;
create policy follows_update on public.follows
  for update to authenticated
  using (passenger_id = auth.uid())
  with check (passenger_id = auth.uid() and status = 'accepted');

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete to authenticated
  using (guardian_id = auth.uid() or passenger_id = auth.uid());

grant select, insert, update, delete on public.follows to authenticated;
grant all on public.follows to service_role;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.follows_passenger(id)
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.transporter_id = auth.uid() and gm.user_id = profiles.id
    )
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.transporter_id = profiles.id
        and (gm.user_id = auth.uid() or public.follows_passenger(gm.user_id))
    )
  );

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
  for select to authenticated
  using (
    transporter_id = auth.uid()
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.vehicle_id = vehicles.id
        and (gm.user_id = auth.uid() or public.follows_passenger(gm.user_id))
    )
  );

drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes
  for select to authenticated
  using (
    transporter_id = auth.uid()
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.route_id = routes.id
        and (gm.user_id = auth.uid() or public.follows_passenger(gm.user_id))
    )
  );

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (
    transporter_id = auth.uid()
    or public.is_group_member(id)
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and public.follows_passenger(gm.user_id)
    )
  );

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (
    public.owns_group(group_id)
    or user_id = auth.uid()
    or public.follows_passenger(user_id)
  );

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (
    public.owns_group(group_id)
    or public.is_group_member(group_id)
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = trips.group_id and public.follows_passenger(gm.user_id)
    )
  );

drop policy if exists trip_positions_select on public.trip_positions;
create policy trip_positions_select on public.trip_positions
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_positions.trip_id
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
