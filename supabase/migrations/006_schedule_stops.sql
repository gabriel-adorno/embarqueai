-- Ida e volta da rota, e o ponto de cada passageiro.
-- Rode no SQL Editor depois da 005.

alter table public.routes
  add column if not exists outbound_time text,
  add column if not exists return_time text;

alter table public.trips
  add column if not exists leg text;

alter table public.group_members
  add column if not exists point_id uuid references public.route_points (id) on delete set null;

drop policy if exists boardings_select on public.boardings;
create policy boardings_select on public.boardings
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = boardings.trip_id
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

do $$ begin
  alter table public.trips
    add constraint trips_leg_check check (leg is null or leg in ('outbound', 'return'));
exception
  when duplicate_object then null;
end $$;
