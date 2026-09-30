-- 20260930120000_admin_lockdown 되돌리기 (문제 발생 시에만 실행)
begin;

alter policy admin_write_adjustments      on public.adjustments        using (true) with check (true);
alter policy admin_write_divisions        on public.event_divisions    using (true) with check (true);
alter policy admin_write_entries          on public.event_entries      using (true) with check (true);
alter policy admin_write_events           on public.events             using (true) with check (true);
alter policy admin_write_form             on public.form_entries       using (true) with check (true);
alter policy admin_only_grade_log         on public.grade_change_log   using (true) with check (true);
alter policy admin_write_grades           on public.grade_options      using (true) with check (true);
alter policy admin_full_members           on public.members            using (true) with check (true);
alter policy admin_only_membership_log    on public.membership_log     using (true) with check (true);
alter policy admin_write_notices          on public.notices            using (true) with check (true);
alter policy admin_only_aliases           on public.payer_aliases      using (true) with check (true);
alter policy admin_only_payments          on public.payments           using (true) with check (true);
alter policy admin_write_point_rules      on public.point_rules        using (true) with check (true);
alter policy admin_only_promotion_log     on public.promotion_log      using (true) with check (true);
alter policy admin_write_promotion_rules  on public.promotion_rules    using (true) with check (true);
alter policy admin_only_promotion_runs    on public.promotion_runs     using (true) with check (true);
alter policy admin_write_teams            on public.teams              using (true) with check (true);
alter policy admin_write_results          on public.tournament_results using (true) with check (true);
alter policy admin_write_tournaments      on public.tournaments_master using (true) with check (true);

alter policy admin_logs_authenticated on public.admin_logs to public using (auth.role() = 'authenticated') with check (true);
alter policy "admin select" on public.page_views to public using (auth.role() = 'authenticated');

drop policy if exists admin_users_admin_read  on public.admin_users;
drop policy if exists admin_users_super_write on public.admin_users;
create policy admin_users_authenticated on public.admin_users for all to public using (auth.role() = 'authenticated');

-- (결제 삭제·배너·신고·게시판 공개 쓰기 정책은 보안상 되돌리지 않는다)

-- 함수: 래퍼 제거 후 원본 이름 복구
drop function public.admin_reset_member_pin(text);
drop function public.admin_manual_match_payment(uuid, text, text);
drop function public.admin_set_member_grade(text, text, text, text);
drop function public.admin_set_membership(text, text, date, text, text);
drop function public.match_payment(uuid);
alter function public._admin_reset_member_pin_impl(text)                       rename to admin_reset_member_pin;
alter function public._admin_manual_match_payment_impl(uuid, text, text)       rename to admin_manual_match_payment;
alter function public._admin_set_member_grade_impl(text, text, text, text)     rename to admin_set_member_grade;
alter function public._admin_set_membership_impl(text, text, date, text, text) rename to admin_set_membership;
alter function public._match_payment_impl(uuid)                                rename to match_payment;
grant execute on function public.admin_reset_member_pin(text)                       to authenticated;
grant execute on function public.admin_manual_match_payment(uuid, text, text)       to authenticated;
grant execute on function public.admin_set_member_grade(text, text, text, text)     to authenticated;
grant execute on function public.admin_set_membership(text, text, date, text, text) to authenticated;
grant execute on function public.match_payment(uuid)                                to authenticated;

commit;
