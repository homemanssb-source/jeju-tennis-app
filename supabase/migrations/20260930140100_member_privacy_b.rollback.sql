-- 20260930140100_member_privacy_b 되돌리기 (가져오기 등이 깨졌을 때만 실행)
begin;

-- 1) members: anon 전체 열 조회 복구
grant select on public.members to anon;

-- 2) members_public: SQL-A 상태로 복구 (조회 전용 유지)
drop view public.members_public;
create view public.members_public as
select member_id, name, display_name, gender, club, division, registered_at, grade,
       before_grade, grade_changed_at, grade_source, status, membership_paid_until,
       birthdate, address, member_type,
       extract(year from birthdate)::int as birth_year
  from public.members;
revoke all on public.members_public from anon, authenticated;
grant select on public.members_public to anon, authenticated;

-- 3) external_report_log: anon 전체 열 조회 복구
grant select on public.external_report_log to anon;

-- 4) 단체전: 이전 정책 복구
drop policy if exists team_entries_admin_write on public.team_event_entries;
drop policy if exists team_members_admin_write on public.team_event_members;
create policy team_entry_all  on public.team_event_entries for all using (true) with check (true);
create policy team_member_all on public.team_event_members for all using (true) with check (true);

commit;
