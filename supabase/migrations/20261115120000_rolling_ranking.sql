-- 현재 랭킹 = 대회별 "가장 최근 회차" 포인트만 합산 (연도 리셋 → 대회별 리셋)
--   같은 대회의 다음 회차 결과가 들어오면 이전 회차 점수만 빠진다. 해가 바뀌어도 다음 회차 전까지는 유지.
--   같은 대회 판정: 대회명에서 "제N회"·연도·공백을 뺀 이름이 같으면 같은 대회.
--   수동 조정(adjustments)은 대회에 묶이지 않으므로 조정일로부터 1년간 유효.
--
-- 호출 방법: p_season_year = 0 → 현재 랭킹(새 규칙). 연도를 주면 기존과 완전히 같다(시즌 기록 조회).
--   NULL(= 올해 시즌) 동작도 그대로 — 예전 화면이 떠 있어도 깨지지 않는다.
-- 대회 앱(시드 배정)도 ranking_current_points() 를 불러 같은 숫자를 쓴다.
-- 데이터·테이블 변경 없음. 멱등.

-- 1) 같은 대회 묶음 키
create or replace function public.tournament_series_key(p_name text)
returns text
language sql
immutable
as $function$
  select coalesce(
    nullif(lower(regexp_replace(regexp_replace(regexp_replace(
      btrim(coalesce(p_name, '')),
      '제\s*\d+\s*회', '', 'g'),
      '(19|20)\d{2}\s*년?(도)?', '', 'g'),
      '\s+', '', 'g')), ''),
    lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', '', 'g')))
$function$;

-- 2) 대회(회차) 목록 + 현재 랭킹에 반영되는지
create or replace function public.ranking_current_tournaments()
returns table(tournament_name text, last_date date, series text, counted boolean, replaced_by text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with ed as (
    select btrim(t.tournament_name) as tn, max(t.date) as last_date
    from tournament_results t
    where btrim(coalesce(t.tournament_name, '')) <> ''
    group by 1
  ), k as (
    select tn, last_date, tournament_series_key(tn) as series from ed
  ), r as (
    select k.*, first_value(tn) over (partition by series order by last_date desc nulls last, tn desc) as top
    from k
  )
  select r.tn, r.last_date, r.series, (r.tn = r.top), case when r.tn = r.top then null else r.top end
  from r
  order by r.last_date desc nulls last, r.tn;
$function$;

-- 3) 회원별 현재 포인트 (대회 앱 시드 배정용 — 포인트가 있는 회원만)
create or replace function public.ranking_current_points()
returns table(member_id text, total_points bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select x.member_id, sum(x.pts)::bigint
  from (
    select t.member_id, coalesce(t.points, 0)::bigint as pts
    from tournament_results t
    where t.member_id is not null
      and btrim(t.tournament_name) in (select c.tournament_name from ranking_current_tournaments() c where c.counted)
    union all
    select a.member_id, coalesce(a.score_change, 0)::bigint
    from adjustments a
    where a.member_id is not null and a.date::date > (current_date - interval '1 year')
  ) x
  group by x.member_id
  order by x.member_id;
$function$;

-- 4) 랭킹: p_season_year = 0 이면 현재 랭킹, 그 외는 기존과 동일
create or replace function public.get_rankings(p_division text, p_season_year integer default null::integer, p_limit integer default 10, p_offset integer default 0)
returns table(member_id text, name text, display_name text, club text, division text, grade text, total_points bigint, tournament_count bigint, last_date date, season_year integer)
language sql
stable security definer
as $function$
  WITH sy AS (
    SELECT COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER) AS yr
  ), cur AS (
    SELECT c.tournament_name FROM public.ranking_current_tournaments() c WHERE c.counted
  )
  SELECT
    m.member_id,
    m.name,
    m.display_name,
    m.club,
    m.division,
    m.grade,
    COALESCE(SUM(t.points), 0) + COALESCE((
      SELECT SUM(a.score_change)
      FROM adjustments a
      WHERE a.member_id = m.member_id
        AND CASE WHEN (SELECT yr FROM sy) = 0
              THEN a.date::date > (CURRENT_DATE - INTERVAL '1 year')
              ELSE a.season_year = (SELECT yr FROM sy) END
    ), 0) AS total_points,
    COUNT(DISTINCT t.id) AS tournament_count,
    MAX(t.date) AS last_date,
    (SELECT yr FROM sy) AS season_year
  FROM members m
  LEFT JOIN tournament_results t
    ON m.member_id = t.member_id
    AND CASE WHEN (SELECT yr FROM sy) = 0
          THEN btrim(t.tournament_name) IN (SELECT tournament_name FROM cur)
          ELSE t.season_year = (SELECT yr FROM sy) END
  WHERE m.status = '활성'
    AND m.division = p_division
  GROUP BY m.member_id, m.name, m.display_name, m.club, m.division, m.grade
  ORDER BY total_points DESC, tournament_count DESC, last_date DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$function$;

-- 5) 회원 상세: p_season_year = 0 이면 전체 대회 이력 + 현재 포인트. 이력마다 counted(현재 랭킹 반영 여부) 추가
create or replace function public.get_member_history(p_member_id text, p_season_year integer default null::integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_yr integer := COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM members
    WHERE member_id = p_member_id AND status != '삭제'
  ) THEN
    RETURN json_build_object('ok', false, 'message', '회원을 찾을 수 없습니다.');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'member', (
      SELECT row_to_json(m) FROM (
        SELECT member_id, name, display_name, gender, club, division,
               registered_at, grade, before_grade, grade_changed_at, grade_source, status
        FROM members WHERE member_id = p_member_id
      ) m
    ),
    'history', COALESCE((
      SELECT json_agg(row_to_json(h) ORDER BY h.date DESC) FROM (
        SELECT
          t.tournament_name, t.date, t.division, t.rank, t.points,
          COALESCE(
            (SELECT gcl.before_grade FROM grade_change_log gcl
             WHERE gcl.member_id = p_member_id
               AND gcl.changed_at::date > t.date
             ORDER BY gcl.changed_at ASC LIMIT 1),
            t.grade,
            (SELECT grade FROM members WHERE member_id = p_member_id)
          ) AS grade,
          COALESCE(c.counted, false) AS counted
        FROM tournament_results t
        LEFT JOIN ranking_current_tournaments() c ON c.tournament_name = btrim(t.tournament_name)
        WHERE t.member_id = p_member_id
          AND (v_yr = 0 OR t.season_year = v_yr)
      ) h
    ), '[]'::json),
    'total_points', COALESCE((
      SELECT SUM(t.points) FROM tournament_results t
      WHERE t.member_id = p_member_id
        AND CASE WHEN v_yr = 0
              THEN btrim(t.tournament_name) IN (SELECT c.tournament_name FROM ranking_current_tournaments() c WHERE c.counted)
              ELSE t.season_year = v_yr END
    ), 0) + COALESCE((
      SELECT SUM(a.score_change) FROM adjustments a
      WHERE a.member_id = p_member_id
        AND CASE WHEN v_yr = 0
              THEN a.date::date > (CURRENT_DATE - INTERVAL '1 year')
              ELSE a.season_year = v_yr END
    ), 0),
    'season_year', v_yr
  );
END;
$function$;

-- 6) 실행 권한 (공개 랭킹 정보 — 기존 get_rankings 와 같은 범위)
grant execute on function public.tournament_series_key(text) to anon, authenticated, service_role;
grant execute on function public.ranking_current_tournaments() to anon, authenticated, service_role;
grant execute on function public.ranking_current_points() to anon, authenticated, service_role;

select 'rolling ranking applied' as result;
