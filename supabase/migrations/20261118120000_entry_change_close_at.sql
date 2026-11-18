-- 취소·파트너 변경 마감을 접수 마감과 분리
--  - events.change_close_at 추가: 본인 취소·파트너 변경이 가능한 마지막 시각
--  - 비어 있으면 기존처럼 entry_close_at(접수 마감)을 따른다
--  - 우천 순연 등으로 접수 마감 뒤에도 취소·선수 변경을 받아야 할 때 관리자가 설정
--  - 신규 신청 마감(entry_close_at)에는 영향 없음

alter table public.events
  add column if not exists change_close_at timestamptz;

comment on column public.events.change_close_at is
  '본인 취소·파트너 변경 마감 시각. null 이면 entry_close_at 을 따른다.';


-- 1) 내 신청 취소 — 마감 기준만 coalesce(change_close_at, entry_close_at) 로 변경
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

  select coalesce(change_close_at, entry_close_at) into v_close
    from events where event_id = v_entry.event_id;
  if v_close is not null and v_close < now() then
    return jsonb_build_object('ok', false, 'message', '취소 마감 후에는 취소할 수 없습니다. 관리자에게 문의하세요.');
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


-- 2) 내 신청 파트너 변경 — 마감 기준만 coalesce(change_close_at, entry_close_at) 로 변경
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
  v_close   timestamptz;
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
  v_close := coalesce(v_event.change_close_at, v_event.entry_close_at);
  if v_close is not null and v_close < now() then
    return jsonb_build_object('ok', false, 'message', '변경 마감 후에는 변경할 수 없습니다.');
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
