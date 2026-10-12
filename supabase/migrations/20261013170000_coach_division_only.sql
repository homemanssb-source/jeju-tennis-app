-- 지도자 등급(예: "지도자3") 회원은 지도자부(부서명에 '지도자' 포함)에만 출전 가능
-- 지도자부는 지도자 + 동호인 페어가 가능하므로 일반 회원은 막지 않는다.
-- 20261013150000 의 등급 합산 트리거와 같은 지점(신청 생성·부서 변경·파트너 교체)에서 검사한다.

create or replace function public._check_coach_division(p_division_id uuid, p_member1_id text, p_member2_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_div_name text;
  v_coach    text;
begin
  select division_name into v_div_name from event_divisions where division_id = p_division_id;
  if coalesce(v_div_name, '') like '%지도자%' then return; end if;

  select name into v_coach from members
   where member_id in (p_member1_id, p_member2_id)
     and coalesce(grade, '') like '지도자%'
   limit 1;
  if v_coach is not null then
    raise exception '지도자 등급 회원(%)은 지도자부에만 신청할 수 있습니다.', v_coach
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public._check_coach_division(uuid, text, text) from public, anon, authenticated;

create or replace function public.trg_entry_grade_sum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t teams%rowtype;
begin
  if coalesce(new.entry_status, '') = '취소' then return new; end if;
  if tg_op = 'UPDATE'
     and new.division_id is not distinct from old.division_id
     and new.team_id     is not distinct from old.team_id
     and coalesce(old.entry_status, '') <> '취소' then
    return new;  -- 결제 상태 변경 등은 검사하지 않음 (상한을 나중에 바꿔도 기존 신청이 막히지 않게)
  end if;
  select * into v_t from teams where team_id = new.team_id;
  perform public._check_coach_division(new.division_id, v_t.member1_id, v_t.member2_id);
  perform public._check_grade_sum(new.division_id, v_t.member1_id, v_t.member2_id);
  return new;
end;
$$;

create or replace function public.trg_team_grade_sum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_div uuid;
begin
  if new.member1_id is not distinct from old.member1_id
     and new.member2_id is not distinct from old.member2_id then
    return new;
  end if;
  for v_div in
    select division_id from event_entries
     where team_id = new.team_id and coalesce(entry_status, '') <> '취소'
  loop
    perform public._check_coach_division(v_div, new.member1_id, new.member2_id);
    perform public._check_grade_sum(v_div, new.member1_id, new.member2_id);
  end loop;
  return new;
end;
$$;
