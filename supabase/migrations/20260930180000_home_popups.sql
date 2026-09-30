-- ============================================================
-- 메인 화면 팝업
--  - 관리자가 이미지/문구/링크 팝업을 등록하고 게시 기간을 지정
--  - 공개(anon)는 "활성 + 게시 기간 안" 인 팝업만 조회
--  - 이미지는 public 버킷 popup-images (쓰기는 관리자만)
-- ============================================================

begin;

create table if not exists public.home_popups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text,
  image_url   text,
  link_url    text,
  start_at    timestamptz,
  end_at      timestamptz,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.home_popups enable row level security;

drop policy if exists public_read_home_popups on public.home_popups;
create policy public_read_home_popups on public.home_popups
  for select to anon, authenticated
  using (
    is_active
    and (start_at is null or start_at <= now())
    and (end_at   is null or end_at   >  now())
  );

drop policy if exists admin_write_home_popups on public.home_popups;
create policy admin_write_home_popups on public.home_popups
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.home_popups to anon, authenticated;
grant insert, update, delete on public.home_popups to authenticated;


-- 이미지 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('popup-images', 'popup-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists popup_images_insert on storage.objects;
create policy popup_images_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'popup-images' and public.is_admin());

drop policy if exists popup_images_update on storage.objects;
create policy popup_images_update on storage.objects
  for update to authenticated using (bucket_id = 'popup-images' and public.is_admin());

drop policy if exists popup_images_delete on storage.objects;
create policy popup_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'popup-images' and public.is_admin());

commit;
