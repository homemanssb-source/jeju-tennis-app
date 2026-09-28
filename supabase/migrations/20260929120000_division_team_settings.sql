-- ============================================================
-- 부서별 팀전 설정 — 경기방식(3복식/5복식)·인원 한도·팀전 부서 여부
-- (Supabase CLI: supabase db push / 또는 SQL Editor 에서 직접 실행)
--
-- 배경: 경기방식은 events.team_match_type 에 대회당 1개만 저장되어
--       "남성부 5복식 / 여성부 3복식" 처럼 부서별로 다른 대회를 표현할 수 없었음.
--       대회 값은 '기본값' 으로 남기고, 부서에 값이 있으면 부서 값이 우선한다.
-- ============================================================

-- 1) 부서별 경기방식 — NULL 이면 events.team_match_type(대회 기본값) 을 따른다
alter table public.event_divisions
  add column if not exists team_match_type text;

alter table public.event_divisions
  drop constraint if exists event_divisions_team_match_type_check;
alter table public.event_divisions
  add constraint event_divisions_team_match_type_check
  check (team_match_type is null or team_match_type in ('3_doubles', '5_doubles'));

-- 2) 부서별 팀 인원 한도 — NULL 이면 events.team_member_limit(대회 기본값) 을 따른다
alter table public.event_divisions
  add column if not exists member_limit int;

alter table public.event_divisions
  drop constraint if exists event_divisions_member_limit_check;
alter table public.event_divisions
  add constraint event_divisions_member_limit_check
  check (member_limit is null or member_limit > 0);

-- 3) 팀전 부서 여부 — '개인+팀' 대회에서 팀전 신청 화면에 노출할 부서를 지정
alter table public.event_divisions
  add column if not exists is_team_division boolean not null default false;

-- 4) 대회 기본 인원 한도 — 신청 화면은 이미 이 컬럼을 읽고 있으나 관리자 UI 가 없었음
alter table public.events
  add column if not exists team_member_limit int;

alter table public.events
  drop constraint if exists events_team_member_limit_check;
alter table public.events
  add constraint events_team_member_limit_check
  check (team_member_limit is null or team_member_limit > 0);

-- 5) 기존 데이터 이관 — events.team_division_id 로 지정해 둔 부서를 플래그로 옮긴다
update public.event_divisions d
   set is_team_division = true
  from public.events e
 where e.team_division_id = d.division_id
   and d.is_team_division = false;

-- 6) 팀전 전용 대회(event_type='team') 는 모든 부서가 팀전 부서
update public.event_divisions d
   set is_team_division = true
  from public.events e
 where e.event_id = d.event_id
   and e.event_type = 'team'
   and d.is_team_division = false;

-- events.team_division_id 는 남겨 두지만 앱에서는 더 이상 읽지 않는다.
