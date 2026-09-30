alter table public.sponsor_banners
  drop column if exists start_at,
  drop column if exists end_at;
