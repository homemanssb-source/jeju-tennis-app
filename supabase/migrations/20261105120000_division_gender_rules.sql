-- 개인전 부서별 성별 구성·성별 1인 등급 상한
--   gender_rule      : null(제한 없음) | 'mixed'(혼복: 남1+여1) | 'male'(남자만) | 'female'(여자만)
--   max_male_grade   : 남자 선수 1인 등급 상한 (예: 혼복 남자 2점 이하) — null 이면 제한 없음
--   max_female_grade : 여자 선수 1인 등급 상한 — null 이면 제한 없음
-- members.gender 값은 '남' | '여' (예전 데이터 호환을 위해 'M'/'F' 도 인정).
-- 점수 규칙은 grade_points() 와 같음 (등급 없음 → 1점).
-- 20261013150000 의 합산 트리거와 같은 지점(신청 생성·부서 변경·파트너 교체)에서 검사한다.

alter table public.event_divisions
  add column if not exists gender_rule text,
  add column if not exists max_male_grade numeric,
  add column if not exists max_female_grade numeric;

alter table public.event_divisions drop constraint if exists event_divisions_gender_rule_check;
alter table public.event_divisions
  add constraint event_divisions_gender_rule_check
  check (gender_rule is null or gender_rule in ('mixed', 'male', 'female'));

create or replace function public.gender_code(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p in ('남', 'M', 'm', '남자') then '남'
    when p in ('여', 'F', 'f', '여자') then '여'
    else null end
$$;

create or replace function public._check_gender_rules(p_division_id uuid, p_member1_id text, p_member2_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule  text;
  v_maxm  numeric;
  v_maxf  numeric;
  r       record;
  v_cnt_m int := 0;
  v_cnt_f int := 0;
  v_unknown text;
begin
  select gender_rule, max_male_grade, max_female_grade
    into v_rule, v_maxm, v_maxf
    from event_divisions where division_id = p_division_id;
  if v_rule is null and v_maxm is null and v_maxf is null then return; end if;

  for r in
    select name, public.gender_code(gender) as g, public.grade_points(grade) as pts
      from members
     where member_id in (p_member1_id, p_member2_id)
  loop
    if r.g is null then
      v_unknown := r.name;
    elsif r.g = '남' then
      v_cnt_m := v_cnt_m + 1;
      if v_maxm is not null and r.pts > v_maxm then
        raise exception '남자 등급 초과: %(%점) — 이 부서는 남자 %점 이하만 신청할 수 있습니다.',
          r.name, trim_scale(r.pts), trim_scale(v_maxm) using errcode = 'check_violation';
      end if;
    else
      v_cnt_f := v_cnt_f + 1;
      if v_maxf is not null and r.pts > v_maxf then
        raise exception '여자 등급 초과: %(%점) — 이 부서는 여자 %점 이하만 신청할 수 있습니다.',
          r.name, trim_scale(r.pts), trim_scale(v_maxf) using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  if v_rule is null then return; end if;
  if v_unknown is not null then
    raise exception '성별 정보가 없는 회원(%)은 이 부서에 신청할 수 없습니다. 협회에 문의해주세요.', v_unknown
      using errcode = 'check_violation';
  end if;
  if v_rule = 'male' and v_cnt_f > 0 then
    raise exception '남자만 신청할 수 있는 부서입니다.' using errcode = 'check_violation';
  elsif v_rule = 'female' and v_cnt_m > 0 then
    raise exception '여자만 신청할 수 있는 부서입니다.' using errcode = 'check_violation';
  elsif v_rule = 'mixed' and p_member2_id is not null and not (v_cnt_m = 1 and v_cnt_f = 1) then
    raise exception '혼합복식 부서는 남자 1명 + 여자 1명으로 신청해야 합니다.' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function public._check_gender_rules(uuid, text, text) from public, anon, authenticated;

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
  perform public._check_gender_rules(new.division_id, v_t.member1_id, v_t.member2_id);
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
    perform public._check_gender_rules(v_div, new.member1_id, new.member2_id);
    perform public._check_grade_sum(v_div, new.member1_id, new.member2_id);
  end loop;
  return new;
end;
$$;
