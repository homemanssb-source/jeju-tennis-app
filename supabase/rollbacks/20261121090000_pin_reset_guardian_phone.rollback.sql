-- 20261121090000_pin_reset_guardian_phone 되돌리기: 래퍼가 다시 기존 _impl 을 호출
create or replace function public.admin_reset_member_pin(p_member_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._admin_reset_member_pin_impl(p_member_id);
end;
$$;

revoke all on function public.admin_reset_member_pin(text) from public, anon;
grant execute on function public.admin_reset_member_pin(text) to authenticated;
