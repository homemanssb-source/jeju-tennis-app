-- ============================================================
-- 부서별 단식/복식 + 개인전 신청·취소·파트너 변경 서버 검증
-- (SQL Editor 에서 실행. 다음 파일 20260930090100 은 프론트 배포 후 실행)
--
-- 배경:
--  - 학생선수 대회는 부서마다 단식(1명)/복식(2명)이 섞인다.
--  - 신청 RPC 가 PIN·대회/부서 일치·활성 회원을 서버에서 확인하지 않았고,
--    선수2 가 없으면 team_name 이 NULL 이 되었다.
--  - 신청 취소는 anon 이 event_entries 를 직접 UPDATE (모든 행 수정 가능),
--    파트너 변경은 anon 이 teams 를 직접 UPDATE → RLS 에 막혀 조용히 무시되고 있었다.
-- ============================================================

-- 1) 부서별 경기 형태 — 기존 부서는 모두 복식
alter table public.event_divisions
  add column if not exists play_format text not null default 'doubles';

alter table public.event_divisions
  drop constraint if exists event_divisions_play_format_check;
alter table public.event_divisions
  add constraint event_divisions_play_format_check
  check (play_format in ('doubles', 'singles'));


-- 2) 개인전 신청 공통 로직 (내부 전용)
--    p_public = true  : 일반 신청 (접수 기간·대회 상태·대회 대상 확인)
--    p_public = false : 관리자 직접 등록 (위 확인 생략)
create or replace function public._apply_individual_entry(
  p_event_id    uuid,
  p_division_id uuid,
  p_member1_id  text,
  p_member2_id  text,
  p_public      boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event   events%rowtype;
  v_div     event_divisions%rowtype;
  v_m1      members%rowtype;
  v_m2      members%rowtype;
  v_m2_id   text := nullif(trim(coalesce(p_member2_id, '')), '');
  v_target  text;
  v_team_id uuid;
  v_entry_id uuid;
begin
  select * into v_event from events where event_id = p_event_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', '대회를 찾을 수 없습니다.');
  end if;

  select * into v_div from event_divisions
   where division_id = p_division_id and event_id = p_event_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', '부서를 찾을 수 없습니다.');
  end if;

  if p_public then
    if upper(coalesce(v_event.status, 'OPEN')) <> 'OPEN' then
      return jsonb_build_object('ok', false, 'message', '접수가 마감된 대회입니다.');
    end if;
    if v_event.entry_open_at is not null and v_event.entry_open_at > now() then
      return jsonb_build_object('ok', false, 'message', '아직 참가신청 기간이 아닙니다.');
    end if;
    if v_event.entry_close_at is not null and v_event.entry_close_at < now() then
      return jsonb_build_object('ok', false, 'message', '참가신청 마감된 대회입니다.');
    end if;
  end if;

  select * into v_m1 from members where member_id = p_member1_id and status = '활성';
  if not found then
    return jsonb_build_object('ok', false, 'message', '선수1이 활성 회원이 아닙니다.');
  end if;

  if v_div.play_format = 'singles' and v_m2_id is not null then
    return jsonb_build_object('ok', false, 'message', '단식 부서는 1명만 신청합니다.');
  end if;
  if v_div.play_format = 'doubles' and v_m2_id is null then
    return jsonb_build_object('ok', false, 'message', '복식 부서는 선수 2명이 필요합니다.');
  end if;

  if v_m2_id is not null then
    if v_m2_id = p_member1_id then
      return jsonb_build_object('ok', false, 'message', '같은 선수를 두 번 선택할 수 없습니다.');
    end if;
    select * into v_m2 from members where member_id = v_m2_id and status = '활성';
    if not found then
      return jsonb_build_object('ok', false, 'message', '선수2가 활성 회원이 아닙니다.');
    end if;
  end if;

  if p_public then
    v_target := coalesce(v_event.target_type, '동호인');
    if v_target <> '전체' and (
         coalesce(v_m1.member_type, '동호인') <> v_target
      or (v_m2_id is not null and coalesce(v_m2.member_type, '동호인') <> v_target)
    ) then
      return jsonb_build_object('ok', false, 'message',
        '이 대회는 ' || case when v_target = '선수' then '학생선수' else v_target end || '만 신청할 수 있습니다.');
    end if;
  end if;

  -- 같은 부서 동시 신청 직렬화 (중복 체크와 insert 사이 경합 방지)
  perform pg_advisory_xact_lock(hashtext('entry:' || p_division_id::text));

  if exists (
    select 1
      from event_entries ee
      join teams t on t.team_id = ee.team_id
     where ee.event_id = p_event_id
       and ee.division_id = p_division_id
       and coalesce(ee.entry_status, '') <> '취소'
       and (t.member1_id in (p_member1_id, v_m2_id) or t.member2_id in (p_member1_id, v_m2_id))
  ) then
    return jsonb_build_object('ok', false, 'message', '이미 해당 부서에 신청된 선수가 있습니다.');
  end if;

  insert into teams (member1_id, member2_id, team_name)
  values (
    p_member1_id,
    v_m2_id,
    case when v_m2_id is null then v_m1.name else v_m1.name || '/' || v_m2.name end
  )
  returning team_id into v_team_id;

  insert into event_entries (event_id, division_id, team_id, entry_status, payment_status)
  values (p_event_id, p_division_id, v_team_id, '신청', '미납')
  returning entry_id into v_entry_id;

  return jsonb_build_object('ok', true, 'entry_id', v_entry_id, 'team_id', v_team_id);
end;
$$;

revoke all on function public._apply_individual_entry(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;


-- 3) 일반 신청 — 선수1 PIN 을 서버에서 확인 (선수2 는 단식이면 null)
create or replace function public.rpc_apply_team_with_pin(
  p_event_id    uuid,
  p_division_id uuid,
  p_member1_id  text,
  p_member1_pin text,
  p_member2_id  text
) returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from members
     where member_id = p_member1_id
       and pin_code = p_member1_pin
       and status = '활성'
  ) then
    return json_build_object('ok', false, 'message', 'PIN이 일치하지 않습니다.');
  end if;
  return public._apply_individual_entry(p_event_id, p_division_id, p_member1_id, p_member2_id, true)::json;
end;
$$;


-- 4) 기존 신청 RPC — 관리자는 관리자 등록, 그 외(배포 전 구버전 화면)는 일반 규칙.
--    프론트 배포 후 20260930090100 에서 관리자 전용으로 잠근다.
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
  return public._apply_individual_entry(
    p_event_id, p_division_id, p_member1_id, p_member2_id, not public.is_admin());
end;
$$;


-- 5) 본인 확인 (전화번호 + PIN) — 내부 전용
create or replace function public._member_by_phone_pin(p_phone text, p_pin text)
returns members
language sql
stable
security definer
set search_path = public
as $$
  select *
    from members
   where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
     and pin_code = p_pin
     and coalesce(status, '') <> '탈퇴'
     and coalesce(p_pin, '') <> ''
   limit 1;
$$;

revoke all on function public._member_by_phone_pin(text, text)
  from public, anon, authenticated;


-- 6) 내 신청 취소 (결제완료 건은 환불계좌 필수 → 환불대기)
create or replace function public.rpc_cancel_my_entry(
  p_phone          text,
  p_pin            text,
  p_entry_id       uuid,
  p_refund_bank    text default null,
  p_refund_account text default null,
  p_refund_holder  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    members%rowtype;
  v_entry event_entries%rowtype;
  v_team  teams%rowtype;
  v_close timestamptz;
  v_paid  boolean;
begin
  v_me := public._member_by_phone_pin(p_phone, p_pin);
  if v_me.member_id is null then
    return jsonb_build_object('ok', false, 'message', '전화번호 또는 PIN이 올바르지 않습니다.');
  end if;

  select * into v_entry from event_entries where entry_id = p_entry_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', '신청 내역을 찾을 수 없습니다.');
  end if;
  select * into v_team from teams where team_id = v_entry.team_id;
  if v_team.team_id is null
     or (v_team.member1_id is distinct from v_me.member_id and v_team.member2_id is distinct from v_me.member_id) then
    return jsonb_build_object('ok', false, 'message', '본인의 신청만 취소할 수 있습니다.');
  end if;

  if v_entry.entry_status = '취소' then
    return jsonb_build_object('ok', false, 'message', '이미 취소된 신청입니다.');
  end if;
  if v_entry.payment_status in ('환불대기', '환불완료') then
    return jsonb_build_object('ok', false, 'message', '이미 환불 처리 중인 신청입니다.');
  end if;

  select entry_close_at into v_close from events where event_id = v_entry.event_id;
  if v_close is not null and v_close < now() then
    return jsonb_build_object('ok', false, 'message', '접수 마감 후에는 취소할 수 없습니다. 관리자에게 문의하세요.');
  end if;

  v_paid := v_entry.payment_status = '결제완료';
  if v_paid and (
       nullif(trim(coalesce(p_refund_bank, '')), '') is null
    or nullif(trim(coalesce(p_refund_account, '')), '') is null
    or nullif(trim(coalesce(p_refund_holder, '')), '') is null
  ) then
    return jsonb_build_object('ok', false, 'message', '환불받을 은행·계좌번호·예금주를 입력해주세요.');
  end if;

  update event_entries
     set entry_status        = '취소',
         cancelled_at        = now(),
         payment_status      = case when v_paid then '환불대기' else payment_status end,
         refund_bank         = case when v_paid then trim(p_refund_bank) else refund_bank end,
         refund_account      = case when v_paid then trim(p_refund_account) else refund_account end,
         refund_holder       = case when v_paid then trim(p_refund_holder) else refund_holder end,
         refund_requested_at = case when v_paid then now() else refund_requested_at end
   where entry_id = p_entry_id;

  return jsonb_build_object('ok', true, 'refund_requested', v_paid);
end;
$$;

grant execute on function public.rpc_cancel_my_entry(text, text, uuid, text, text, text) to anon, authenticated;


-- 7) 내 신청 파트너 변경 (복식만) — 호출한 본인은 그대로, 상대 선수를 교체
create or replace function public.rpc_change_my_partner(
  p_phone          text,
  p_pin            text,
  p_entry_id       uuid,
  p_new_partner_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me      members%rowtype;
  v_new     members%rowtype;
  v_entry   event_entries%rowtype;
  v_team    teams%rowtype;
  v_event   events%rowtype;
  v_format  text;
  v_target  text;
  v_m1_name text;
  v_m2_name text;
begin
  v_me := public._member_by_phone_pin(p_phone, p_pin);
  if v_me.member_id is null then
    return jsonb_build_object('ok', false, 'message', '전화번호 또는 PIN이 올바르지 않습니다.');
  end if;

  select * into v_entry from event_entries where entry_id = p_entry_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', '신청 내역을 찾을 수 없습니다.');
  end if;
  select * into v_team from teams where team_id = v_entry.team_id for update;
  if v_team.team_id is null
     or (v_team.member1_id is distinct from v_me.member_id and v_team.member2_id is distinct from v_me.member_id) then
    return jsonb_build_object('ok', false, 'message', '본인의 신청만 변경할 수 있습니다.');
  end if;
  if v_entry.entry_status = '취소' then
    return jsonb_build_object('ok', false, 'message', '취소된 신청입니다.');
  end if;

  select * into v_event from events where event_id = v_entry.event_id;
  if v_event.entry_close_at is not null and v_event.entry_close_at < now() then
    return jsonb_build_object('ok', false, 'message', '접수 마감 후에는 변경할 수 없습니다.');
  end if;

  select play_format into v_format from event_divisions where division_id = v_entry.division_id;
  if coalesce(v_format, 'doubles') <> 'doubles' then
    return jsonb_build_object('ok', false, 'message', '단식 부서는 파트너가 없습니다.');
  end if;

  select * into v_new from members where member_id = p_new_partner_id and status = '활성';
  if not found then
    return jsonb_build_object('ok', false, 'message', '새 파트너가 활성 회원이 아닙니다.');
  end if;
  if v_new.member_id = v_me.member_id then
    return jsonb_build_object('ok', false, 'message', '본인을 파트너로 선택할 수 없습니다.');
  end if;

  v_target := coalesce(v_event.target_type, '동호인');
  if v_target <> '전체' and coalesce(v_new.member_type, '동호인') <> v_target then
    return jsonb_build_object('ok', false, 'message',
      '이 대회는 ' || case when v_target = '선수' then '학생선수' else v_target end || '만 신청할 수 있습니다.');
  end if;

  perform pg_advisory_xact_lock(hashtext('entry:' || v_entry.division_id::text));

  if exists (
    select 1
      from event_entries ee
      join teams t on t.team_id = ee.team_id
     where ee.event_id = v_entry.event_id
       and ee.division_id = v_entry.division_id
       and ee.entry_id <> p_entry_id
       and coalesce(ee.entry_status, '') <> '취소'
       and (t.member1_id = v_new.member_id or t.member2_id = v_new.member_id)
  ) then
    return jsonb_build_object('ok', false, 'message', '새 파트너가 이미 이 부서에 신청되어 있습니다.');
  end if;

  if v_team.member1_id = v_me.member_id then
    v_team.member2_id := v_new.member_id;
  else
    v_team.member1_id := v_new.member_id;
  end if;
  select name into v_m1_name from members where member_id = v_team.member1_id;
  select name into v_m2_name from members where member_id = v_team.member2_id;

  update teams
     set member1_id = v_team.member1_id,
         member2_id = v_team.member2_id,
         team_name  = v_m1_name || '/' || v_m2_name
   where team_id = v_team.team_id;

  return jsonb_build_object('ok', true, 'partner_name', v_new.name);
end;
$$;

grant execute on function public.rpc_change_my_partner(text, text, uuid, text) to anon, authenticated;


-- 8) 내 신청 조회 — 부서 경기 형태·대회 대상을 함께 반환 (그 외 로직은 기존 라이브 정의 그대로)
create or replace function public.rpc_get_my_entries(p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_member members%rowtype;
  v_pin_result jsonb;
  v_individual jsonb;
  v_team jsonb;
  v_all jsonb;
begin
  select * into v_member from members
   where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
     and status != '탈퇴'
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'message', '등록된 전화번호가 없습니다.');
  end if;

  select rpc_verify_member_pin(v_member.name, p_pin) into v_pin_result;
  if not (v_pin_result->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', 'PIN이 올바르지 않습니다.');
  end if;

  -- ① 개인전 (취소된 건도 환불대기/환불완료면 포함)
  select jsonb_agg(
    jsonb_build_object(
      'entry_type', 'individual',
      'entry_id', ee.entry_id,
      'event_id', ee.event_id,
      'event_name', ev.event_name,
      'event_date', ev.event_date,
      'event_date_end', ev.event_date_end,
      'division_name', ed.division_name,
      'play_format', coalesce(ed.play_format, 'doubles'),
      'target_type', ev.target_type,
      'partner_name', case when t.member1_id = v_member.member_id then m2.name else m1.name end,
      'entry_status', ee.entry_status,
      'payment_status', ee.payment_status,
      'applied_at', ee.applied_at,
      'entry_close_at', ev.entry_close_at,
      'refund_bank', ee.refund_bank,
      'refund_account', ee.refund_account,
      'refund_holder', ee.refund_holder,
      'refund_requested_at', ee.refund_requested_at,
      'refund_completed_at', ee.refund_completed_at
    ) order by ev.event_date desc, ee.applied_at desc
  ) into v_individual
  from event_entries ee
  join teams t on t.team_id = ee.team_id
  join events ev on ev.event_id = ee.event_id
  left join event_divisions ed on ed.division_id = ee.division_id
  left join members m1 on m1.member_id = t.member1_id
  left join members m2 on m2.member_id = t.member2_id
  where (t.member1_id = v_member.member_id or t.member2_id = v_member.member_id)
    and (ee.entry_status != '취소' or ee.payment_status in ('환불대기', '환불완료'));

  -- ② 단체전 (team_event_members에 name 컬럼 없으므로 members 테이블 JOIN)
  select jsonb_agg(
    jsonb_build_object(
      'entry_type', 'team',
      'entry_id', te.id,
      'event_id', te.event_id,
      'event_name', ev.event_name,
      'event_date', ev.event_date,
      'event_date_end', ev.event_date_end,
      'division_name', te.division_name,
      'club_name', te.club_name,
      'is_captain', (te.captain_member_id = v_member.member_id),
      'entry_status', te.status,
      'payment_status', te.payment_status,
      'applied_at', te.created_at,
      'entry_close_at', ev.entry_close_at,
      'roster', (
        select jsonb_agg(
          jsonb_build_object(
            'member_id', tem.member_id,
            'name', mb.name,
            'gender', mb.gender,
            'grade', mb.grade,
            'order', tem.member_order
          ) order by tem.member_order
        )
        from team_event_members tem
        join members mb on mb.member_id = tem.member_id
        where tem.entry_id = te.id
      )
    ) order by ev.event_date desc, te.created_at desc
  ) into v_team
  from team_event_entries te
  join events ev on ev.event_id = te.event_id
  join team_event_members tem2 on tem2.entry_id = te.id and tem2.member_id = v_member.member_id
  where te.status != 'cancelled';

  v_all := coalesce(v_individual, '[]'::jsonb) || coalesce(v_team, '[]'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'member_name', v_member.name,
    'member_id', v_member.member_id,
    'entries', v_all
  );
end;
$function$;
