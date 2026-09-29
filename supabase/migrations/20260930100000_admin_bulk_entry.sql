-- ============================================================
-- 관리자 개인전 일괄 신청 — 클럽·학교 단위로 여러 팀(단식은 1명)을 한 번에 등록
--
--  - 관리자 전용 (is_admin)
--  - 전부 성공하거나 전부 취소: 한 줄이라도 실패하면 예외로 전체 롤백
--  - 줄마다 _apply_individual_entry(관리자 모드) 로 단식/복식·활성·중복 검증
--    (같은 요청 안의 중복도 앞서 넣은 줄이 보이므로 걸러진다)
-- ============================================================

create or replace function public.rpc_admin_bulk_apply(
  p_event_id    uuid,
  p_division_id uuid,
  p_entries     jsonb   -- [{ "member1_id": "...", "member2_id": "..." | null }, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   jsonb;
  v_i     int := 0;
  v_res   jsonb;
  v_name  text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('ok', false, 'message', '등록할 선수가 없습니다.');
  end if;
  if jsonb_array_length(p_entries) > 200 then
    return jsonb_build_object('ok', false, 'message', '한 번에 200팀까지 등록할 수 있습니다.');
  end if;

  for v_row in select value from jsonb_array_elements(p_entries) loop
    v_i := v_i + 1;
    v_res := public._apply_individual_entry(
      p_event_id, p_division_id, v_row->>'member1_id', v_row->>'member2_id', false);
    if not coalesce((v_res->>'ok')::boolean, false) then
      select name into v_name from members where member_id = v_row->>'member1_id';
      raise exception '%번째 줄(%): %', v_i, coalesce(v_name, '?'), v_res->>'message';
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'count', v_i);
end;
$$;

revoke execute on function public.rpc_admin_bulk_apply(uuid, uuid, jsonb) from public, anon;
grant  execute on function public.rpc_admin_bulk_apply(uuid, uuid, jsonb) to authenticated;
