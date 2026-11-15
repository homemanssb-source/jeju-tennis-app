-- 20261115120000_rolling_ranking 롤백: get_rankings / get_member_history 를 적용 전 정의로 되돌리고 새 함수 3개 삭제
-- (적용 전 정의는 2026-11-15 라이브 DB 에서 읽은 것)

create or replace function public.get_rankings(p_division text, p_season_year integer default null::integer, p_limit integer default 10, p_offset integer default 0)
returns table(member_id text, name text, display_name text, club text, division text, grade text, total_points bigint, tournament_count bigint, last_date date, season_year integer)
language sql
stable security definer
as $function$
  WITH sy AS (
    SELECT COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER) AS yr
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
        AND a.season_year = (SELECT yr FROM sy)
    ), 0) AS total_points,
    COUNT(DISTINCT t.id) AS tournament_count,
    MAX(t.date) AS last_date,
    (SELECT yr FROM sy) AS season_year
  FROM members m
  LEFT JOIN tournament_results t
    ON m.member_id = t.member_id
    AND t.season_year = (SELECT yr FROM sy)
  WHERE m.status = '활성'
    AND m.division = p_division
  GROUP BY m.member_id, m.name, m.display_name, m.club, m.division, m.grade
  ORDER BY total_points DESC, tournament_count DESC, last_date DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$function$;

create or replace function public.get_member_history(p_member_id text, p_season_year integer default null::integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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
          ) AS grade
        FROM tournament_results t
        WHERE t.member_id = p_member_id
          AND t.season_year = COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER)
      ) h
    ), '[]'::json),
    'total_points', COALESCE((
      SELECT SUM(t.points) FROM tournament_results t
      WHERE t.member_id = p_member_id
        AND t.season_year = COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER)
    ), 0) + COALESCE((
      SELECT SUM(a.score_change) FROM adjustments a
      WHERE a.member_id = p_member_id
        AND a.season_year = COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER)
    ), 0),
    'season_year', COALESCE(p_season_year, EXTRACT(YEAR FROM NOW())::INTEGER)
  );
END;
$function$;

drop function if exists public.ranking_current_points();
drop function if exists public.ranking_current_tournaments();
drop function if exists public.tournament_series_key(text);

select 'rolling ranking rolled back' as result;
