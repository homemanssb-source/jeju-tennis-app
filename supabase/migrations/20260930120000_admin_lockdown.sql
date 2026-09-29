-- ============================================================
-- 보안 1단계: 관리자 권한 잠금
--
-- 배경 (2026-09-30 점검):
--  - Supabase Auth 회원가입이 열려 있고 이메일 확인이 꺼져 있어, 누구나 가입만 하면
--    'authenticated' 가 된다. 그런데 관리자용 RLS 대부분이 "authenticated 면 전부 허용"
--    이라 회원·대회·신청·결제·랭킹·관리자 목록까지 누구나 수정할 수 있었다.
--  - 관리자용 SECURITY DEFINER 함수에 관리자 확인이 없었고, PIN 초기화는 anon 도 실행 가능.
--  - payments 전체 삭제, sponsor_banners 쓰기가 anon 에게 열려 있었고
--    app_b_match_results 는 RLS 가 꺼져 있었다.
--
-- 방침: "authenticated" 대신 실제 관리자(is_admin(): admin_users.email = 로그인 이메일)만 허용.
-- (회원가입 비활성화는 대시보드 Authentication 설정에서 별도로 한다)
-- ============================================================

begin;

-- 슈퍼관리자 여부 (관리자 계정 관리용)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
     where email = (auth.jwt() ->> 'email') and is_super is true
  )
$$;


-- 1) 관리자 쓰기 정책: authenticated 전체 허용 → is_admin()
alter policy admin_write_adjustments      on public.adjustments        using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_divisions        on public.event_divisions    using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_entries          on public.event_entries      using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_events           on public.events             using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_form             on public.form_entries       using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_grade_log         on public.grade_change_log   using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_grades           on public.grade_options      using (public.is_admin()) with check (public.is_admin());
alter policy admin_full_members           on public.members            using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_membership_log    on public.membership_log     using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_notices          on public.notices            using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_aliases           on public.payer_aliases      using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_payments          on public.payments           using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_point_rules      on public.point_rules        using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_promotion_log     on public.promotion_log      using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_promotion_rules  on public.promotion_rules    using (public.is_admin()) with check (public.is_admin());
alter policy admin_only_promotion_runs    on public.promotion_runs     using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_teams            on public.teams              using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_results          on public.tournament_results using (public.is_admin()) with check (public.is_admin());
alter policy admin_write_tournaments      on public.tournaments_master using (public.is_admin()) with check (public.is_admin());

-- 2) 관리자 로그·접속통계
alter policy admin_logs_authenticated on public.admin_logs
  to authenticated using (public.is_admin()) with check (public.is_admin());
alter policy "admin select" on public.page_views
  to authenticated using (public.is_admin());

-- 3) 관리자 계정 목록: 조회는 관리자, 추가·수정·삭제는 슈퍼관리자만
drop policy if exists admin_users_authenticated on public.admin_users;
drop policy if exists admin_users_admin_read   on public.admin_users;
drop policy if exists admin_users_super_write  on public.admin_users;
create policy admin_users_admin_read on public.admin_users
  for select to authenticated using (public.is_admin());
create policy admin_users_super_write on public.admin_users
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- 4) anon 에게 열려 있던 파괴적 정책
drop policy if exists "관리자 결제 삭제 허용" on public.payments;          -- payments 삭제는 admin_only_payments 로 충분
alter policy "관리자 쓰기" on public.sponsor_banners
  to authenticated using (public.is_admin()) with check (public.is_admin());
alter policy "anon update reports" on public.external_report_log
  to authenticated using (public.is_admin()) with check (public.is_admin());
alter policy "anon delete reports" on public.external_report_log
  to authenticated using (public.is_admin());
alter policy board_update_all on public.board_posts
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) app_b_match_results: RLS 켜기 (조회는 그대로 공개, 쓰기는 관리자만)
alter table public.app_b_match_results enable row level security;
drop policy if exists app_b_results_read        on public.app_b_match_results;
drop policy if exists app_b_results_admin_write on public.app_b_match_results;
create policy app_b_results_read on public.app_b_match_results
  for select using (true);
create policy app_b_results_admin_write on public.app_b_match_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- 6) 관리자용 함수: 원본을 _impl 로 옮기고, 같은 이름의 래퍼가 관리자 확인 후 호출
--    (원본 본문은 그대로 유지)
alter function public.admin_reset_member_pin(text)
  rename to _admin_reset_member_pin_impl;
alter function public.admin_manual_match_payment(uuid, text, text)
  rename to _admin_manual_match_payment_impl;
alter function public.admin_set_member_grade(text, text, text, text)
  rename to _admin_set_member_grade_impl;
alter function public.admin_set_membership(text, text, date, text, text)
  rename to _admin_set_membership_impl;
alter function public.match_payment(uuid)
  rename to _match_payment_impl;

revoke all on function public._admin_reset_member_pin_impl(text)                     from public, anon, authenticated;
revoke all on function public._admin_manual_match_payment_impl(uuid, text, text)     from public, anon, authenticated;
revoke all on function public._admin_set_member_grade_impl(text, text, text, text)   from public, anon, authenticated;
revoke all on function public._admin_set_membership_impl(text, text, date, text, text) from public, anon, authenticated;
revoke all on function public._match_payment_impl(uuid)                              from public, anon, authenticated;

create function public.admin_reset_member_pin(p_member_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._admin_reset_member_pin_impl(p_member_id);
end;
$$;

create function public.admin_manual_match_payment(p_payment_id uuid, p_member_id text, p_entered_by text default 'admin')
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._admin_manual_match_payment_impl(p_payment_id, p_member_id, p_entered_by);
end;
$$;

create function public.admin_set_member_grade(p_member_id text, p_new_grade text, p_reason text, p_entered_by text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._admin_set_member_grade_impl(p_member_id, p_new_grade, p_reason, p_entered_by);
end;
$$;

create function public.admin_set_membership(p_member_id text, p_status text, p_until date, p_reason text, p_entered_by text default 'admin')
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return json_build_object('ok', false, 'message', '관리자만 사용할 수 있습니다.');
  end if;
  return public._admin_set_membership_impl(p_member_id, p_status, p_until, p_reason, p_entered_by);
end;
$$;

create function public.match_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  return public._match_payment_impl(p_payment_id);
end;
$$;

revoke all on function public.admin_reset_member_pin(text)                        from public, anon;
revoke all on function public.admin_manual_match_payment(uuid, text, text)        from public, anon;
revoke all on function public.admin_set_member_grade(text, text, text, text)      from public, anon;
revoke all on function public.admin_set_membership(text, text, date, text, text)  from public, anon;
revoke all on function public.match_payment(uuid)                                 from public, anon;
grant execute on function public.admin_reset_member_pin(text)                       to authenticated;
grant execute on function public.admin_manual_match_payment(uuid, text, text)       to authenticated;
grant execute on function public.admin_set_member_grade(text, text, text, text)     to authenticated;
grant execute on function public.admin_set_membership(text, text, date, text, text) to authenticated;
grant execute on function public.match_payment(uuid)                                to authenticated;

-- 월간 승급 실행(SECURITY INVOKER — 위 is_admin RLS 로 보호됨): anon 실행 권한만 제거
revoke all on function public.run_monthly_promotions(integer, integer, text) from public, anon;
grant execute on function public.run_monthly_promotions(integer, integer, text) to authenticated;

commit;
