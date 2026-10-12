-- 개인전 복식 부서별 등급 합산 상한
-- 예) max_grade_sum = 10 → 5점+5점 가능, 5점+6점 불가 (합 ≤ 상한)
-- null 이면 제한 없음.
-- 점수 규칙(프론트 src/lib/grade.js gradeNumber 와 동일): "지도자3" → 3, 등급 없음 → 1 (신규 등록 기본 1점)
--
-- 신청 RPC 를 각각 고치지 않고 트리거로 검사한다 → 일반 신청·파트너 변경·관리자 등록/수정·일괄 등록 모두 적용.

alter table public.event_divisions
  add column if not exists max_grade_sum numeric;

create or replace function public.grade_points(p text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select coalesce(substring(coalesce(p, '') from '[0-9]+\.?[0-9]*')::numeric, 1)
$$;

-- 팀(2명)이 부서 상한을 넘으면 예외
create or replace function public._check_grade_sum(p_division_id uuid, p_member1_id text, p_member2_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max numeric;
  v_n1  text;  v_n2 text;
  v_g1  numeric; v_g2 numeric;
begin
  if p_member2_id is null then return; end if;  -- 단식
  select max_grade_sum into v_max from event_divisions where division_id = p_division_id;
  if v_max is null then return; end if;

  select name, public.grade_points(grade) into v_n1, v_g1 from members where member_id = p_member1_id;
  select name, public.grade_points(grade) into v_n2, v_g2 from members where member_id = p_member2_id;

  if coalesce(v_g1, 1) + coalesce(v_g2, 1) > v_max then
    raise exception '등급 합산 초과: %(%점) + %(%점) = %점 — 이 부서는 합산 %점 이하만 신청할 수 있습니다.',
      coalesce(v_n1, '?'), trim_scale(coalesce(v_g1, 1)),
      coalesce(v_n2, '?'), trim_scale(coalesce(v_g2, 1)),
      trim_scale(coalesce(v_g1, 1) + coalesce(v_g2, 1)), trim_scale(v_max)
      using errcode = 'check_violation';
  end if;
end;
$$;

-- 신청 생성/부서 변경 시
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
  perform public._check_grade_sum(new.division_id, v_t.member1_id, v_t.member2_id);
  return new;
end;
$$;

drop trigger if exists trg_entry_grade_sum on public.event_entries;
create trigger trg_entry_grade_sum
  before insert or update on public.event_entries
  for each row execute function public.trg_entry_grade_sum();

-- 파트너 교체(팀 구성 변경) 시 — 그 팀이 들어가 있는 모든 유효 신청의 부서 기준으로 검사
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
    perform public._check_grade_sum(v_div, new.member1_id, new.member2_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_team_grade_sum on public.teams;
create trigger trg_team_grade_sum
  before update on public.teams
  for each row execute function public.trg_team_grade_sum();

revoke all on function public._check_grade_sum(uuid, text, text) from public, anon, authenticated;
