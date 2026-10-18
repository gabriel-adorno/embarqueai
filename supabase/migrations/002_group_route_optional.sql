-- Grupos podem existir sem rota; a rota escolhe 1+ grupos na criação.
alter table public.groups
  alter column route_id drop not null;
