-- ============================================================
-- 단체전(클럽대항전) 신청 규칙 정리
--
-- 1) 주장은 여러 팀을 신청할 수 있다 — 같은 부서(영주클럽 / 영주클럽 B)도, 다른 부서도.
--    20261006130000 의 '한 클럽 한 부서' 제한이 모든 부서에 기본으로 걸려 있어
--    다른 부서 신청이 전부 막혔다. 기본값을 '중복 허용' 으로 바꾸고 기존 부서도 연다.
--    (특정 부서만 제한하고 싶으면 관리자 화면에서 '중복허용' 체크를 해제)
--
-- 2) 소속 클럽으로만 신청 — 클럽명은 주장 본인의 소속 클럽(+ 자동 B·C… 팀 표기)이어야 하고,
--    선수 명단도 같은 소속 클럽 회원만 넣을 수 있다. 명단 수정도 동일.
--    클럽 비교는 team_club_base() (자동 suffix·공백 제거) 기준.
--    관리자 등록(AdminTeamEntryPage)은 이 RPC 를 거치지 않으므로 예외 처리 가능.
--
-- 3) 한 선수는 한 대회에서 한 팀만 — 같은 부서든 다른 부서든 두 팀에 들어갈 수 없다.
--    (주장도 선수로 명단에 있으면 동일. 명단에 없는 주장은 여러 팀을 관리할 수 있다.)
-- ============================================================

-- 1) 중복 허용 기본값
alter table public.event_divisions
  alter column allow_multi_entry set default true;

update public.event_divisions
   set allow_multi_entry = true
 where allow_multi_entry = false;

-- 2) 단체전 신청 RPC — 소속 클럽 검사 추가 (20261006130000 본문 기준)
create or replace function public.rpc_submit_team_entry(
  p_event_id uuid, p_captain_name text, p_captain_pin text, p_club_name text, p_members jsonb,
  p_division_id uuid default null, p_division_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth         jsonb := public._pin_auth_name(p_captain_name, p_captain_pin);
  v_captain      members%rowtype;
  v_club_key     text;
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

  -- 소속 클럽으로만 신청
  v_club_key := public.team_club_base(v_captain.club);
  if v_club_key = '' then
    return jsonb_build_object('ok', false, 'message', '주장의 소속 클럽이 등록되어 있지 않아 단체전을 신청할 수 없습니다.');
  end if;
  if public.team_club_base(p_club_name) <> v_club_key then
    return jsonb_build_object('ok', false, 'message',
      '소속 클럽(' || v_captain.club || ') 이름으로만 신청할 수 있습니다.');
  end if;

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
      if public.team_club_base(v_rec.club) <> v_club_key then
        return jsonb_build_object('ok', false, 'message',
          v_rec.name || ' 선수는 ' || v_captain.club || ' 소속이 아닙니다. 소속 클럽 회원만 신청할 수 있습니다.');
      end if;
      select te.club_name || ' (' || coalesce(te.division_name, '-') || ')' into v_other_div
        from team_event_members tem
        join team_event_entries te on te.id = tem.entry_id
       where te.event_id = p_event_id and te.status <> 'cancelled' and tem.member_id = v_rec.member_id
       limit 1;
      if v_other_div is not null then
        return jsonb_build_object('ok', false, 'message',
          v_rec.name || ' 선수는 이미 ' || v_other_div || ' 팀으로 신청되어 있습니다. 한 선수는 한 팀(한 부서)만 출전할 수 있습니다.');
      end if;
      v_other_div := null;
    else
      return jsonb_build_object('ok', false, 'message', (v_member->>'name') || ' 선수는 동호인등록이 되어 있지 않습니다.');
    end if;
  end loop;

  -- 한 클럽은 한 부서만 — '중복허용' 을 끈 부서끼리만 적용
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
          '이미 ' || v_other_div || '에 신청한 클럽입니다. 이 부서는 다른 부서와 중복 신청할 수 없습니다.');
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

-- 3) 명단 수정 — 소속 클럽 회원만 (20260930160000 본문 기준)
create or replace function public.rpc_update_team_roster_v2(
  p_entry_id uuid, p_captain_name text, p_captain_pin text, p_members jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth     jsonb := public._pin_auth_name(p_captain_name, p_captain_pin);
  v_captain  members%rowtype;
  v_entry    team_event_entries%rowtype;
  v_close    timestamptz;
  v_m        jsonb;
  v_mid      text;
  v_name     text;
  v_club     text;
  v_club_key text;
  v_count    int;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message',
      case when (v_auth->>'locked')::boolean then v_auth->>'message'
           else '대표자 이름 또는 PIN이 올바르지 않습니다.' end);
  end if;
  select * into v_captain from members where member_id = v_auth->>'member_id';

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

  -- 주장 소속 클럽 기준 (팀명은 예전 신청에 '테우클럽A' 처럼 자유 입력된 것이 있어 쓰지 않는다)
  v_club_key := public.team_club_base(v_captain.club);
  if v_club_key = '' then
    return jsonb_build_object('ok', false, 'message', '주장의 소속 클럽이 등록되어 있지 않아 명단을 수정할 수 없습니다.');
  end if;

  for v_m in select value from jsonb_array_elements(p_members) loop
    v_mid := nullif(v_m->>'member_id', '');
    if v_mid is null then
      return jsonb_build_object('ok', false, 'message', '등록된 회원만 명단에 넣을 수 있습니다.');
    end if;
    select name, club into v_name, v_club from members where member_id = v_mid and status = '활성';
    if not found then
      return jsonb_build_object('ok', false, 'message', coalesce(v_m->>'name', v_mid) || ' 선수는 활성 회원이 아닙니다.');
    end if;
    if public.team_club_base(v_club) <> v_club_key then
      return jsonb_build_object('ok', false, 'message',
        v_name || ' 선수는 ' || coalesce(v_captain.club, '-') || ' 소속이 아닙니다. 소속 클럽 회원만 넣을 수 있습니다.');
    end if;
    if exists (
      select 1 from team_event_members tem
        join team_event_entries te on te.id = tem.entry_id
       where te.event_id = v_entry.event_id and te.id <> p_entry_id
         and te.status <> 'cancelled' and tem.member_id = v_mid
    ) then
      return jsonb_build_object('ok', false, 'message', v_name || ' 선수가 이미 다른 팀으로 신청되어 있습니다. 한 선수는 한 팀(한 부서)만 출전할 수 있습니다.');
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
