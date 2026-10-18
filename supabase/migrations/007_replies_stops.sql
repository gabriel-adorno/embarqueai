-- O passageiro (ou quem o acompanha) escolhe o próprio ponto.
-- Respostas curtas ao aviso de atraso.
-- Rode no SQL Editor depois da 006.

drop policy if exists group_members_point_update on public.group_members;
create policy group_members_point_update on public.group_members
  for update to authenticated
  using (user_id = auth.uid() or public.follows_passenger(user_id))
  with check (user_id = auth.uid() or public.follows_passenger(user_id));

create table if not exists public.trip_alert_replies (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.trip_alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  unique (alert_id, user_id)
);

alter table public.trip_alert_replies enable row level security;

drop policy if exists alert_replies_select on public.trip_alert_replies;
create policy alert_replies_select on public.trip_alert_replies
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_alerts a
      join public.trips t on t.id = a.trip_id
      where a.id = trip_alert_replies.alert_id
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

drop policy if exists alert_replies_insert on public.trip_alert_replies;
create policy alert_replies_insert on public.trip_alert_replies
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and message in ('Já estou no ponto', 'Pode seguir')
    and exists (
      select 1 from public.trip_alerts a
      join public.trips t on t.id = a.trip_id
      where a.id = trip_alert_replies.alert_id
        and (
          public.is_group_member(t.group_id)
          or exists (
            select 1 from public.group_members gm
            where gm.group_id = t.group_id and public.follows_passenger(gm.user_id)
          )
        )
    )
  );

grant select, insert, update on public.trip_alert_replies to authenticated;
grant all on public.trip_alert_replies to service_role;
