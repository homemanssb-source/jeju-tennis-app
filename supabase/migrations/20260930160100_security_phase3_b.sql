-- ============================================================
-- 보안 3단계-B (프론트 배포 "후" 실행)
--  1) 중고장터: 공개 직접 쓰기(글·댓글·좋아요 수정/삭제) 제거 → 서버 함수와 관리자만
--     비밀 댓글은 공개 조회에서 제외(서버 함수 rpc_market_comments 로만)
--  2) 중고장터 사진: 공개 삭제 제거 → 관리자만 (업로드·조회는 그대로)
--  3) 회원 등록: 공개 직접 추가 제거 → rpc_register_member 로만
-- ============================================================

begin;

-- 1) market_posts / market_comments / market_likes
drop policy if exists market_posts_insert    on public.market_posts;
drop policy if exists market_posts_update    on public.market_posts;
drop policy if exists market_posts_delete    on public.market_posts;
drop policy if exists market_comments_insert on public.market_comments;
drop policy if exists market_comments_delete on public.market_comments;
drop policy if exists market_likes_insert    on public.market_likes;
drop policy if exists market_likes_delete    on public.market_likes;

drop policy if exists market_posts_admin    on public.market_posts;
drop policy if exists market_comments_admin on public.market_comments;
drop policy if exists market_likes_admin    on public.market_likes;
drop policy if exists market_reports_admin  on public.market_reports;
create policy market_posts_admin    on public.market_posts    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy market_comments_admin on public.market_comments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy market_likes_admin    on public.market_likes    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy market_reports_admin  on public.market_reports  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 비밀 댓글은 공개 조회에서 제외 (관리자는 market_comments_admin 으로 전체 조회)
alter policy market_comments_select on public.market_comments using (not coalesce(is_private, false));

-- 2) 사진 삭제는 관리자만
drop policy if exists market_images_delete on storage.objects;
create policy market_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'market-images' and public.is_admin());

-- 3) 회원 원본에 공개 직접 추가 금지 (등록은 rpc_register_member)
drop policy if exists anon_insert_members on public.members;
revoke insert, update, delete on public.members from anon;

commit;
