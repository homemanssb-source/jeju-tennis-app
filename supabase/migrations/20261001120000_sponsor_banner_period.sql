-- ============================================================
-- 스폰서 배너: 게시 기간 추가
--  - 관리자 화면에서 이미지를 바로 업로드(popup-images 버킷의 sponsors/ 폴더 사용)
--  - start_at / end_at 이 비어 있으면 기간 제한 없음
-- ============================================================

alter table public.sponsor_banners
  add column if not exists start_at timestamptz,
  add column if not exists end_at   timestamptz;
