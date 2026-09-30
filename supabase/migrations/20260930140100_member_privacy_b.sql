-- ============================================================
-- 보안 2단계-B: 개인정보 잠금 — 프론트(전화번호 조회 RPC·명단 RPC·birth_year) 배포 "후" 실행
--
--  1) members 원본: 공개(anon)로는 이름·클럽·등급 등 공개 열만 조회 가능
--     (PIN·전화번호·보호자 전화·생년월일·주소 열은 anon 조회 불가. 관리자는 그대로 전체)
--  2) members_public: 주소·생년월일 제거(출생연도만), 삭제 회원 제외
--  3) 외부대회 신고: 공개 조회에서 회원 전화번호 열 제외
--  4) 단체전 신청·명단: 공개 직접 쓰기 제거 → RPC(신청·명단수정) 와 관리자만
-- ============================================================

begin;

-- 1) members: 열 단위 공개 조회
revoke select on public.members from anon;
grant select (member_id, name, display_name, gender, club, division, grade, status, member_type)
  on public.members to anon;

-- 2) members_public 재생성 (열을 빼려면 뷰를 다시 만들어야 함)
drop view public.members_public;
create view public.members_public as
select member_id, name, display_name, gender, club, division, registered_at, grade,
       before_grade, grade_changed_at, grade_source, status, membership_paid_until,
       member_type,
       extract(year from birthdate)::int as birth_year
  from public.members
 where coalesce(status, '') <> '삭제';
revoke all on public.members_public from anon, authenticated;
grant select on public.members_public to anon, authenticated;

-- 3) external_report_log: anon 은 member_phone 제외 열만 조회
revoke select on public.external_report_log from anon;
grant select (id, member_id, member_name, reported_at, tournament_name, tournament_date,
              tournament_type, tournament_division, result, before_grade, expected_grade,
              admin_applied, admin_applied_at, admin_note)
  on public.external_report_log to anon;

-- 4) 단체전: 공개 전체 허용 정책 제거 → 관리자만 쓰기 (조회 정책 allow_read_* 는 유지)
drop policy if exists team_entry_all  on public.team_event_entries;
drop policy if exists team_member_all on public.team_event_members;
drop policy if exists team_entries_admin_write on public.team_event_entries;
drop policy if exists team_members_admin_write on public.team_event_members;
create policy team_entries_admin_write on public.team_event_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_members_admin_write on public.team_event_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
