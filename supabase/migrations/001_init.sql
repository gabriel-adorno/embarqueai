-- EmbarqueAI: Auth trigger + tabelas + RLS
-- Cole no SQL Editor do Supabase (ou: supabase db push)

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('client', 'transporter');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.route_status as enum ('draft', 'active', 'stopped');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.trip_status as enum ('in_progress', 'ended');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  transporter_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  plate text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  transporter_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  status public.route_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.route_points (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  sort_order integer not null default 0
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  route_id uuid not null references public.routes (id) on delete restrict,
  transporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, user_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.trip_status not null default 'in_progress',
  polyline jsonb not null default '[]'::jsonb
);

create table if not exists public.trip_positions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  remaining_m integer,
  recorded_at timestamptz not null default now()
);

create index if not exists vehicles_transporter_idx on public.vehicles (transporter_id);
create index if not exists routes_transporter_idx on public.routes (transporter_id);
create index if not exists route_points_route_idx on public.route_points (route_id, sort_order);
create index if not exists groups_transporter_idx on public.groups (transporter_id);
create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists trips_group_idx on public.trips (group_id, status);
create index if not exists trips_route_idx on public.trips (route_id, status);
create index if not exists trip_positions_trip_idx on public.trip_positions (trip_id, recorded_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'client');
  if meta_role not in ('client', 'transporter') then
    meta_role := 'client';
  end if;

  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    meta_role::public.user_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_transporter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'transporter'
  );
$$;

create or replace function public.owns_group(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.transporter_id = auth.uid()
  );
$$;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.routes enable row level security;
alter table public.route_points enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.trips enable row level security;
alter table public.trip_positions enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.transporter_id = auth.uid() and gm.user_id = profiles.id
    )
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.transporter_id = profiles.id and gm.user_id = auth.uid()
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
  for select to authenticated
  using (
    transporter_id = auth.uid()
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.vehicle_id = vehicles.id and gm.user_id = auth.uid()
    )
  );

drop policy if exists vehicles_write on public.vehicles;
create policy vehicles_write on public.vehicles
  for all to authenticated
  using (transporter_id = auth.uid() and public.is_transporter())
  with check (transporter_id = auth.uid() and public.is_transporter());

drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes
  for select to authenticated
  using (
    transporter_id = auth.uid()
    or exists (
      select 1 from public.groups g
      join public.group_members gm on gm.group_id = g.id
      where g.route_id = routes.id and gm.user_id = auth.uid()
    )
  );

drop policy if exists routes_write on public.routes;
create policy routes_write on public.routes
  for all to authenticated
  using (transporter_id = auth.uid() and public.is_transporter())
  with check (transporter_id = auth.uid() and public.is_transporter());

drop policy if exists route_points_select on public.route_points;
create policy route_points_select on public.route_points
  for select to authenticated
  using (
    exists (select 1 from public.routes r where r.id = route_points.route_id)
  );

drop policy if exists route_points_write on public.route_points;
create policy route_points_write on public.route_points
  for all to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_points.route_id
        and r.transporter_id = auth.uid()
        and public.is_transporter()
    )
  )
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_points.route_id
        and r.transporter_id = auth.uid()
        and public.is_transporter()
    )
  );

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (
    transporter_id = auth.uid() or public.is_group_member(id)
  );

drop policy if exists groups_write on public.groups;
create policy groups_write on public.groups
  for all to authenticated
  using (transporter_id = auth.uid() and public.is_transporter())
  with check (transporter_id = auth.uid() and public.is_transporter());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to authenticated
  using (
    public.owns_group(group_id) or user_id = auth.uid()
  );

drop policy if exists group_members_write on public.group_members;
create policy group_members_write on public.group_members
  for all to authenticated
  using (public.owns_group(group_id) and public.is_transporter())
  with check (public.owns_group(group_id) and public.is_transporter());

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips
  for select to authenticated
  using (
    public.owns_group(group_id) or public.is_group_member(group_id)
  );

drop policy if exists trips_write on public.trips;
create policy trips_write on public.trips
  for all to authenticated
  using (public.owns_group(group_id) and public.is_transporter())
  with check (public.owns_group(group_id) and public.is_transporter());

drop policy if exists trip_positions_select on public.trip_positions;
create policy trip_positions_select on public.trip_positions
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_positions.trip_id
        and (public.owns_group(t.group_id) or public.is_group_member(t.group_id))
    )
  );

drop policy if exists trip_positions_write on public.trip_positions;
create policy trip_positions_write on public.trip_positions
  for all to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_positions.trip_id and public.owns_group(t.group_id)
    )
    and public.is_transporter()
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_positions.trip_id and public.owns_group(t.group_id)
    )
    and public.is_transporter()
  );

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.trip_positions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
