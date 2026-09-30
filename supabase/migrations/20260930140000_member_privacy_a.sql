-- ============================================================
-- 보안 2단계-A: 개인정보 보호 준비 (프론트 배포 "전" 실행 — 기존 화면에 영향 없음)
--
--  1) members_public 뷰: 공개 조회만 허용 (anon 이 뷰를 통해 회원 정보를 수정할 수 있던 문제)
--     + 출생연도(birth_year) 열 추가 (다음 단계에서 생년월일·주소를 빼기 위한 준비)
--  2) 새 RPC: 전화번호 중복 확인, 단체전 명단 수정(대표 PIN 확인)
--  3) 회원 원본을 읽던 공개 함수 2개를 SECURITY DEFINER 로 (다음 단계에서 원본 공개 조회를 막아도 동작)
--  4) 공개로 열려 있던 게시판 1:1 문의 조회·직접 작성, 옛 신청양식(form_entries) 조회 막기
--  5) 단체전 대표 PIN 평문 저장 중단
-- ============================================================

begin;

-- 1) members_public: 쓰기 권한 제거 + birth_year 추가 (기존 열 순서 유지, 맨 뒤에 추가)
create or replace view public.members_public as
select member_id, name, display_name, gender, club, division, registered_at, grade,
       before_grade, grade_changed_at, grade_source, status, membership_paid_until,
       birthdate, address, member_type,
       extract(year from birthdate)::int as birth_year
  from public.members;

revoke all on public.members_public from anon, authenticated;
grant select on public.members_public to anon, authenticated;
revoke insert, update, delete, truncate on public.ranking_view from anon, authenticated;


-- 2-1) 전화번호 중복 확인 (회원 등록 화면) — 이름은 가운데를 가려서 반환
create or replace function public.rpc_check_phone_registered(p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_norm text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_m    members%rowtype;
  v_mask text;
begin
  if length(v_norm) < 10 then
    return jsonb_build_object('registered', false);
  end if;
  select * into v_m from members
   where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_norm
     and coalesce(status, '') <> '삭제'
   limit 1;
  if not found then
    return jsonb_build_object('registered', false);
  end if;
  v_mask := case
    when char_length(v_m.name) <= 1 then v_m.name
    when char_length(v_m.name) = 2 then left(v_m.name, 1) || '*'
    else left(v_m.name, 1) || repeat('*', char_length(v_m.name) - 2) || right(v_m.name, 1)
  end;
  return jsonb_build_object('registered', true, 'masked_name', v_mask, 'status', v_m.status);
end;
$$;
grant execute on function public.rpc_check_phone_registered(text) to anon, authenticated;


-- 2-2) 단체전 명단 수정 — 대표 이름+PIN 확인, 대표 본인 팀만, 마감 전, 활성 회원만
--      (기존 rpc_update_team_roster 는 id 타입(bigint)이 달라 동작하지 않았다)
create or replace function public.rpc_update_team_roster_v2(
  p_entry_id     uuid,
  p_captain_name text,
  p_captain_pin  text,
  p_members      jsonb   -- [{ "member_id": "..." }, ...] 순서대로
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captain members%rowtype;
  v_entry   team_event_entries%rowtype;
  v_close   timestamptz;
  v_m       jsonb;
  v_mid     text;
  v_name    text;
  v_count   int;
begin
  select * into v_captain from members
   where name = p_captain_name and pin_code = p_captain_pin and status = '활성'
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'message', '대표자 이름 또는 PIN이 올바르지 않습니다.');
  end if;

  select * into v_entry from team_event_entries where id = p_entry_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', '신청 내역을 찾을 수 없습니다.');
  end if;
  if v_entry.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', '취소된 신청입니다.');
  end if;
  if v_entry.captain_member_id is distinct from v_captain.member_id then
    return jsonb_build_object('ok', false, 'message', '해당 팀의 대표자만 명단을 수정할 수 있습니다.');
  end if;

  select entry_close_at into v_close from events where event_id = v_entry.event_id;
  if v_close is not null and v_close < now() then
    return jsonb_build_object('ok', false, 'message', '참가신청 마감 후에는 명단을 수정할 수 없습니다. 관리자에게 문의하세요.');
  end if;

  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    return jsonb_build_object('ok', false, 'message', '선수를 1명 이상 등록해주세요.');
  end if;
  v_count := jsonb_array_length(p_members);
  if v_entry.member_limit is not null and v_count > v_entry.member_limit then
    return jsonb_build_object('ok', false, 'message', '인원 제한(' || v_entry.member_limit || '명)을 초과했습니다.');
  end if;
  if (select count(distinct x->>'member_id') from jsonb_array_elements(p_members) x) <> v_count then
    return jsonb_build_object('ok', false, 'message', '같은 선수가 두 번 들어 있습니다.');
  end if;

  for v_m in select value from jsonb_array_elements(p_members) loop
    v_mid := nullif(v_m->>'member_id', '');
    if v_mid is null then
      return jsonb_build_object('ok', false, 'message', '등록된 회원만 명단에 넣을 수 있습니다.');
    end if;
    select name into v_name from members where member_id = v_mid and status = '활성';
    if not found then
      return jsonb_build_object('ok', false, 'message', coalesce(v_m->>'name', v_mid) || ' 선수는 활성 회원이 아닙니다.');
    end if;
    if v_mid <> v_captain.member_id and exists (
      select 1 from team_event_members tem
        join team_event_entries te on te.id = tem.entry_id
       where te.event_id = v_entry.event_id
         and te.id <> p_entry_id
         and te.status <> 'cancelled'
         and tem.member_id = v_mid
    ) then
      return jsonb_build_object('ok', false, 'message', v_name || ' 선수가 이미 다른 팀으로 신청되어 있습니다.');
    end if;
  end loop;

  delete from team_event_members where entry_id = p_entry_id;
  insert into team_event_members (entry_id, member_id, member_name, gender, grade, member_order)
  select p_entry_id, m.member_id, m.name, coalesce(m.gender, ''), coalesce(m.grade, ''), x.ord::int
    from jsonb_array_elements(p_members) with ordinality as x(v, ord)
    join members m on m.member_id = x.v->>'member_id';

  return jsonb_build_object('ok', true, 'message', '선수 명단이 수정되었습니다.');
end;
$$;
grant execute on function public.rpc_update_team_roster_v2(uuid, text, text, jsonb) to anon, authenticated;


-- 3) 회원 원본을 읽던 공개 함수: 호출자 권한 → 소유자 권한 (반환 열은 기존과 동일)
alter function public.get_member_history(text, integer) security definer;
alter function public.get_member_history(text, integer) set search_path = public;
alter function public.rpc_find_member_by_name_phone(text, text) security definer;
alter function public.rpc_find_member_by_name_phone(text, text) set search_path = public;


-- 4) 게시판 1:1 문의: 조회·직접 작성은 관리자만 (회원은 PIN 확인 RPC 로 작성·조회)
alter policy board_select_all on public.board_posts
  to authenticated using (public.is_admin());
alter policy board_insert_all on public.board_posts
  to authenticated with check (public.is_admin());

--    옛 신청 양식: 공개 조회 제거 (앱에서 쓰지 않음, 관리자는 admin_write_form 으로 조회)
drop policy if exists anon_read_form           on public.form_entries;
drop policy if exists public_read_form_entries on public.form_entries;


-- 5) 단체전 대표 PIN 평문 저장 중단 (본인 확인은 members 의 PIN 으로 함)
create or replace function public._clear_captain_pin()
returns trigger
language plpgsql
as $$
begin
  new.captain_pin := '';   -- NOT NULL 열이라 빈 문자열
  return new;
end;
$$;
drop trigger if exists trg_clear_captain_pin on public.team_event_entries;
create trigger trg_clear_captain_pin
  before insert or update of captain_pin on public.team_event_entries
  for each row execute function public._clear_captain_pin();
update public.team_event_entries set captain_pin = '' where captain_pin <> '';

commit;
