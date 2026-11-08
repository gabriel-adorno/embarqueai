-- Fecha as funções auxiliares (SECURITY DEFINER) para quem não está logado.
-- Rode no SQL Editor depois das migrations anteriores.
--
-- As funções abaixo são usadas pelas policies de RLS, então continuam
-- liberadas para "authenticated"; só saem de PUBLIC/anon.
revoke execute on function public.follows_passenger(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.owns_group(uuid) from public, anon;
revoke execute on function public.is_transporter() from public, anon;
grant execute on function public.follows_passenger(uuid) to authenticated, service_role;
grant execute on function public.is_group_member(uuid) to authenticated, service_role;
grant execute on function public.owns_group(uuid) to authenticated, service_role;
grant execute on function public.is_transporter() to authenticated, service_role;

-- handle_new_user só roda pelo trigger de cadastro; ninguém precisa chamá-la.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
