-- 20261105120000_division_gender_rules 되돌리기
-- 트리거 함수를 20261013170000_coach_division_only 상태로 복구한 뒤 컬럼·함수 삭제

create or replace function public.trg_entry_grade_sum()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_t teams%rowtype;
begin
  if coalesce(new.entry_status, '') = '취소' then return new; end if;
  if tg_op = 'UPDATE'
     and new.division_id is not distinct from old.division_id
     and new.team_id     is not distinct from old.team_id
     and coalesce(old.entry_status, '') <> '취소' then
    return new;
  end if;
  select * into v_t from teams where team_id = new.team_id;
  perform public._check_coach_division(new.division_id, v_t.member1_id, v_t.member2_id);
  perform public._check_grade_sum(new.division_id, v_t.member1_id, v_t.member2_id);
  return new;
end; $$;

create or replace function public.trg_team_grade_sum()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_div uuid;
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
end; $$;

drop function if exists public._check_gender_rules(uuid, text, text);
drop function if exists public.gender_code(text);
alter table public.event_divisions drop constraint if exists event_divisions_gender_rule_check;
alter table public.event_divisions
  drop column if exists gender_rule,
  drop column if exists max_male_grade,
  drop column if exists max_female_grade;
