-- ============================================================
-- 개인전 신청 쓰기 경로 잠금 — 프론트(신청·취소·파트너 변경 RPC 사용) 배포 "후" 실행
--
--  - rpc_apply_team_to_event : 관리자 직접 등록 전용 (일반 신청은 rpc_apply_team_with_pin)
--  - event_entries 의 anon UPDATE 정책 제거 (취소는 rpc_cancel_my_entry)
-- ============================================================

create or replace function public.rpc_apply_team_to_event(
  p_event_id    uuid,
  p_division_id uuid,
  p_member1_id  text,
  p_member2_id  text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._apply_individual_entry(p_event_id, p_division_id, p_member1_id, p_member2_id, false);
end;
$$;

revoke execute on function public.rpc_apply_team_to_event(uuid, uuid, text, text) from public, anon;
grant  execute on function public.rpc_apply_team_to_event(uuid, uuid, text, text) to authenticated;

drop policy if exists "anon can update own entry for cancel" on public.event_entries;
