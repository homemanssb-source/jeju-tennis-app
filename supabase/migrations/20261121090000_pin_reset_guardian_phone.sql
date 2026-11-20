-- ============================================================
-- 회원 PIN 초기화: 본인 전화가 없는 학생선수는 보호자 전화 뒷 6자리로 초기화
--
--  - 기존 _admin_reset_member_pin_impl 은 학생선수(본인 전화 없음) 도입 전에 만든 함수라
--    본인 전화번호가 없는 회원을 초기화하지 못했다. (예: 방하윤 M28691244)
--  - 등록 함수(rpc_register_member)의 PIN 규칙과 같게 맞춘다:
--    본인 전화 뒷 6자리, 없으면 보호자 전화 뒷 6자리
--  - 실패 사유를 구분해서 알려준다 (회원 없음 / 전화번호 없음)
--  - _admin_reset_member_pin_impl 은 그대로 두되 더 이상 호출하지 않는다.
-- ============================================================

create or replace function public.admin_reset_member_pin(p_member_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name     text;
  v_status   text;
  v_phone    text;
  v_guardian text;
  v_digits   text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;

  select name, status,
         nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), ''),
         nullif(regexp_replace(coalesce(guardian_phone, ''), '[^0-9]', '', 'g'), '')
    into v_name, v_status, v_phone, v_guardian
    from members
   where member_id = p_member_id;

  if not found or coalesce(v_status, '') in ('삭제', '탈퇴') then
    return jsonb_build_object('ok', false, 'message', '회원을 찾을 수 없습니다.');
  end if;

  v_digits := coalesce(v_phone, v_guardian);
  if v_digits is null or length(v_digits) < 6 then
    return jsonb_build_object('ok', false, 'message',
      '등록된 전화번호(본인·보호자)가 없어 PIN을 초기화할 수 없습니다. 회원 정보에 전화번호를 먼저 입력해주세요.');
  end if;

  update members set pin_code = right(v_digits, 6) where member_id = p_member_id;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'source', case when v_phone is not null then 'phone' else 'guardian_phone' end
  );
end;
$$;

revoke all on function public.admin_reset_member_pin(text) from public, anon;
grant execute on function public.admin_reset_member_pin(text) to authenticated;
