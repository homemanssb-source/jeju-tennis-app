-- ============================================================
-- 단체전 신청 — 같은 선수가 명단에 두 번 들어가는 것을 DB 에서도 막는다
-- (명단 수정 rpc_update_team_roster_v2 는 이미 검사 중. 신청은 화면에서만 막고 있었음)
-- 20261013210000 의 rpc_submit_team_entry 본문에 중복·빈 명단 검사만 추가.
-- ============================================================

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

  -- 소속 클럽으로만 신청 (복수 소속이면 그중 하나)
  if cardinality(public.member_clubs(v_captain.club)) = 0 then
    return jsonb_build_object('ok', false, 'message', '주장의 소속 클럽이 등록되어 있지 않아 단체전을 신청할 수 없습니다.');
  end if;
  v_club_key := public.team_club_base(p_club_name);
  if not (v_club_key = any(public.member_clubs(v_captain.club))) then
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
  if v_member_count = 0 then
    return jsonb_build_object('ok', false, 'message', '선수를 1명 이상 추가해주세요.');
  end if;
  if (select count(distinct x->>'member_id') from jsonb_array_elements(p_members) x) <> v_member_count then
    return jsonb_build_object('ok', false, 'message', '같은 선수가 명단에 두 번 들어 있습니다.');
  end if;
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
      if not (v_club_key = any(public.member_clubs(v_rec.club))) then
        return jsonb_build_object('ok', false, 'message',
          v_rec.name || ' 선수는 ' || v_club_key || ' 소속이 아닙니다. 소속 클럽 회원만 신청할 수 있습니다.');
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
