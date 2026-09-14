-- ============================================================
-- 동호인 / 선수 구분 + 선수 보호자 연락처 + 대회 대상 구분
-- (Supabase CLI: supabase db push / 또는 SQL Editor 에서 직접 실행)
-- ============================================================

-- 1) 회원 구분: 기존 회원은 전부 '동호인' 으로 자동 채워짐
alter table public.members
  add column if not exists member_type text not null default '동호인';

alter table public.members
  drop constraint if exists members_member_type_check;
alter table public.members
  add constraint members_member_type_check
  check (member_type in ('동호인', '선수'));

create index if not exists members_member_type_idx
  on public.members (member_type);

-- 2) 생년월일은 기존 birthdate 컬럼(date) 을 그대로 사용

-- 3) 선수 보호자 연락처 — 형제 선수가 같은 보호자 번호를 쓸 수 있도록
--    phone(유니크) 과 분리. 선수 본인 연락처는 없을 수 있으므로 NOT NULL 해제.
alter table public.members
  add column if not exists guardian_phone text;
alter table public.members
  alter column phone drop not null;

-- 4) members_public 뷰에 member_type 노출 (기존 컬럼 순서 유지, 끝에 추가)
--    guardian_phone 은 개인정보이므로 공개 뷰에 넣지 않음
create or replace view public.members_public as
select
  member_id, name, display_name, gender, club, division, registered_at,
  grade, before_grade, grade_changed_at, grade_source, status,
  membership_paid_until, birthdate, address,
  member_type
from public.members;

-- 5) 대회 대상 구분: 동호인 대회 / 선수 대회 / 전체
alter table public.events
  add column if not exists target_type text not null default '동호인';
alter table public.events
  drop constraint if exists events_target_type_check;
alter table public.events
  add constraint events_target_type_check
  check (target_type in ('동호인', '선수', '전체'));
