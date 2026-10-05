-- ============================================================
-- 접속 통계 집계 RPC — 관리자 접속 통계 화면용
--
--  기존 화면은 page_views 행을 통째로 받아 브라우저에서 셌는데
--  PostgREST 기본 최대 1,000행 제한에 걸려 7일·30일 차트/페이지별 수치가 잘렸다.
--  또 날짜를 UTC 로 잘라 한국시간 00~09시 방문이 전날로 들어갔다.
--
--  - 관리자 전용 (is_admin)
--  - 날짜는 Asia/Seoul 기준 달력일
--  - page = 'search' 행은 검색어 기록이라 방문 수에서 제외 (검색어 순위에만 사용)
--  - p_days: 0 = 오늘, 7/30 = 오늘 포함 최근 N일, null = 전체
-- ============================================================

create or replace function public.rpc_access_stats(p_days int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_start timestamptz;
  v_chart_days int := case when p_days is null then 30 when p_days = 0 then 1 else p_days end;
  v_chart_start timestamptz;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  v_start := case when p_days is null then null
                  else ((v_today - greatest(p_days - 1, 0))::timestamp at time zone 'Asia/Seoul') end;
  v_chart_start := ((v_today - (v_chart_days - 1))::timestamp at time zone 'Asia/Seoul');

  with v as (
    select visited_at, page, session_id
      from page_views
     where page <> 'search'
  )
  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'today',      count(*) filter (where visited_at >= (v_today::timestamp at time zone 'Asia/Seoul')),
        'week',       count(*) filter (where visited_at >= ((v_today - 6)::timestamp at time zone 'Asia/Seoul')),
        'month',      count(*) filter (where visited_at >= ((v_today - 29)::timestamp at time zone 'Asia/Seoul')),
        'total',      count(*),
        'today_uv',   count(distinct session_id) filter (where visited_at >= (v_today::timestamp at time zone 'Asia/Seoul')),
        'week_uv',    count(distinct session_id) filter (where visited_at >= ((v_today - 6)::timestamp at time zone 'Asia/Seoul')),
        'month_uv',   count(distinct session_id) filter (where visited_at >= ((v_today - 29)::timestamp at time zone 'Asia/Seoul')),
        'total_uv',   count(distinct session_id)
      ) from v
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'count', coalesce(c.cnt, 0), 'uv', coalesce(c.uv, 0)) order by d), '[]'::jsonb)
        from generate_series(v_today - (v_chart_days - 1), v_today, interval '1 day') d
        left join (
          select (visited_at at time zone 'Asia/Seoul')::date as day, count(*) cnt, count(distinct session_id) uv
            from v
           where visited_at >= v_chart_start
           group by 1
        ) c on c.day = d::date
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('page', page, 'count', cnt) order by cnt desc), '[]'::jsonb)
        from (
          select page, count(*) cnt from v
           where v_start is null or visited_at >= v_start
           group by page
        ) p
    ),
    'keywords', (
      select coalesce(jsonb_agg(jsonb_build_object('keyword', keyword, 'count', cnt) order by cnt desc), '[]'::jsonb)
        from (
          select btrim(keyword) keyword, count(*) cnt
            from page_views
           where page = 'search'
             and nullif(btrim(keyword), '') is not null
             and (v_start is null or visited_at >= v_start)
           group by 1
           order by 2 desc
           limit 20
        ) k
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.rpc_access_stats(int) from public, anon;
grant execute on function public.rpc_access_stats(int) to authenticated;
