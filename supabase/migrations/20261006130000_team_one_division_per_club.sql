-- ============================================================
-- 클럽대항전: 한 클럽은 한 부서만 신청 (경기 요일이 달라도 중복 출전 불가)
-- (Supabase CLI: supabase db push / 또는 SQL Editor 에서 직접 실행)
--
-- 규칙
--  · 클럽은 '중복 제한' 부서 중 딱 1개에만 신청할 수 있다.
--  · 같은 부서 안에서 2팀 이상(영주클럽 / 영주클럽 B)은 지금처럼 허용한다.
--  · 부서에 allow_multi_entry = true 를 주면 그 부서는 제한에서 빠진다.
--    (여성부처럼 성별이 달라 중복 출전으로 보지 않는 트랙용)
--  · 취소(cancelled) 건은 제한 계산에서 제외한다.
--
-- 함께 수정: rpc_submit_team_entry 가 인원 한도를 events.team_member_limit 만
--            보고 있어서, 20260929120000 에서 추가한 부서별 member_limit 이
--            서버에서는 무시되고 있었다. 부서 값 우선으로 바로잡는다.
-- ============================================================

-- 1) 부서별 '다른 부서와 중복 허용' 플래그
alter table public.event_divisions
  add column if not exists allow_multi_entry boolean not null default false;

-- 2) 클럽명 정규화 — 자동 팀 suffix(' B' ~ ' Z') 를 떼고 공백을 제거한 값.
--    신청 화면의 clubBaseKey() 와 같은 기준이다.
create or replace function public.team_club_base(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(coalesce(p_name, ''), '\s+[B-Z]$', ''),
           '\s', '', 'g'
         )
$$;

-- 3) 단체전 신청 RPC — 부서 중복 차단 + 부서별 인원 한도 반영
--    (20260930160000_security_phase3_a.sql 의 본문에서 위 두 가지만 추가)
create or replace function public.rpc_submit_team_entry(
  p_event_id uuid, p_captain_name text, p_captain_pin text, p_club_name text, p_members jsonb,
  p_division_id uuid default null, p_division_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth         jsonb := public._pin_auth_name(p_captain_name, p_captain_pin);
  v_captain      members%rowtype;
  v_entry_id     uuid;
  v_member       jsonb;
  v_rec          members%rowtype;
  v_member_limit int;
  v_member_count int;
  v_allow_multi  boolean;
  v_other_div    text;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message',
      case when (v_auth->>'locked')::boolean then v_auth->>'message'
           else '대표자 이름 또는 PIN이 일치하지 않습니다.' end);
  end if;
  select * into v_captain from members where member_id = v_auth->>'member_id';

  -- 인원 한도: 부서 값이 있으면 부서 값, 없으면 대회 기본값
  select coalesce(d.member_limit, e.team_member_limit)
    into v_member_limit
    from events e
    left join event_divisions d on d.division_id = p_division_id
   where e.event_id = p_event_id;

  v_member_count := jsonb_array_length(p_members);
  if v_member_limit is not null and v_member_count > v_member_limit then
    return jsonb_build_object('ok', false, 'message',
      '인원 제한(' || v_member_limit || '명)을 초과했습니다. 현재 ' || v_member_count || '명');
  end if;

  for v_member in select value from jsonb_array_elements(p_members) loop
    if coalesce(v_member->>'member_id', '') <> '' then
      select * into v_rec from members where member_id = v_member->>'member_id' and status = '활성';
      if not found then
        return jsonb_build_object('ok', false, 'message', (v_member->>'name') || ' 선수는 활성 회원이 아닙니다.');
      end if;
    else
      return jsonb_build_object('ok', false, 'message', (v_member->>'name') || ' 선수는 동호인등록이 되어 있지 않습니다.');
    end if;
  end loop;

  -- 한 클럽은 한 부서만 — 다른 '중복 제한' 부서에 이미 신청이 있으면 거절
  if p_division_id is not null then
    select coalesce(allow_multi_entry, false) into v_allow_multi
      from event_divisions where division_id = p_division_id;

    if not coalesce(v_allow_multi, false) then
      select d.division_name into v_other_div
        from team_event_entries e
        join event_divisions   d on d.division_id = e.division_id
       where e.event_id = p_event_id
         and e.division_id is distinct from p_division_id
         and e.status <> 'cancelled'
         and coalesce(d.allow_multi_entry, false) = false
         and public.team_club_base(e.club_name) = public.team_club_base(p_club_name)
       limit 1;

      if v_other_div is not null then
        return jsonb_build_object('ok', false, 'message',
          '이미 ' || v_other_div || '에 신청한 클럽입니다. 클럽대항전은 한 부서만 신청할 수 있습니다. (경기 요일이 달라도 중복 신청 불가)');
      end if;
    end if;
  end if;

  if exists (
    select 1 from team_event_entries
     where event_id = p_event_id and club_name = p_club_name and status <> 'cancelled'
       and division_id is not distinct from p_division_id
  ) then
    return jsonb_build_object('ok', false, 'message', '이미 해당 클럽으로 신청된 내역이 있습니다.');
  end if;

  insert into team_event_entries (event_id, club_name, captain_member_id, captain_name, captain_pin,
                                  member_limit, division_id, division_name)
  values (p_event_id, p_club_name, v_captain.member_id, v_captain.name, '',
          v_member_limit, p_division_id, p_division_name)
  returning id into v_entry_id;

  for v_member in select value from jsonb_array_elements(p_members) loop
    insert into team_event_members (entry_id, member_id, member_name, gender, grade, member_order)
    values (v_entry_id, v_member->>'member_id', v_member->>'name', v_member->>'gender',
            v_member->>'grade', (v_member->>'order')::int);
  end loop;

  return jsonb_build_object('ok', true, 'message', '단체전 참가 신청이 완료되었습니다.', 'entry_id', v_entry_id);
end;
$$;

-- 4) 트리거 백스톱 — RPC 외의 경로로 들어오는 삽입도 막는다.
--    security definer: RLS 와 무관하게 대회 전체 신청 내역을 봐야 정확히 막힌다.
create or replace function public.trg_team_entry_one_division()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow_multi boolean;
  v_base        text;
  v_other       text;
begin
  if new.division_id is null then return new; end if;
  if coalesce(new.status, '') = 'cancelled' then return new; end if;

  select coalesce(allow_multi_entry, false) into v_allow_multi
    from public.event_divisions where division_id = new.division_id;
  if coalesce(v_allow_multi, false) then return new; end if;

  v_base := public.team_club_base(new.club_name);
  if v_base = '' then return new; end if;

  select d.division_name into v_other
    from public.team_event_entries e
    join public.event_divisions   d on d.division_id = e.division_id
   where e.event_id = new.event_id
     and e.division_id is distinct from new.division_id
     and coalesce(e.status, '') <> 'cancelled'
     and coalesce(d.allow_multi_entry, false) = false
     and public.team_club_base(e.club_name) = v_base
   limit 1;

  if v_other is not null then
    raise exception
      '이미 %에 신청한 클럽입니다. 클럽대항전은 한 부서만 신청할 수 있습니다. (경기 요일이 달라도 중복 신청 불가)',
      v_other
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists team_entry_one_division on public.team_event_entries;
create trigger team_entry_one_division
  before insert on public.team_event_entries
  for each row execute function public.trg_team_entry_one_division();

-- 5) 기존 부서 일회성 기본값 — 지난 대회(제6회)에서 '2부 + 여성부' 처럼
--    성별이 다른 트랙에 함께 신청한 클럽이 7개였다. 이미 등록된 여성/여자 부서는
--    중복 허용으로 열어 둔다. 앞으로 추가되는 부서는 기본 '제한' 이므로
--    필요하면 관리자 화면에서 직접 체크한다.
update public.event_divisions
   set allow_multi_entry = true
 where allow_multi_entry = false
   and (division_name like '%여성%' or division_name like '%여자%');
