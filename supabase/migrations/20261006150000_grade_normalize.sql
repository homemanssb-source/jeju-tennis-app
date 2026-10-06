-- 등급 표기 통일: "5점" / "5.0점" / "4.0" / "5" 가 섞여 있던 문제
-- 원인: 등급 드롭다운(grade_options)이 "N점" 형태라 회원가입·관리자 수정에서 고르면 '점'이 붙어 저장됐고,
--       엑셀 업로드에서는 "5.0점", "4.0" 같은 값이 들어왔다.
--       '점'이 붙은 값은 Number("4.5점") = NaN 이 되어 승급 계산·등급 검색·외부대회 신고 등급이 깨졌었다(2026-03).
--       당시엔 가입 화면 한 곳만 '점'을 떼도록 고쳐서 다른 경로로 계속 섞여 들어왔다.
-- 규칙(프론트 src/lib/grade.js normalizeGrade 와 동일): 공백 제거 → 끝의 '점' 제거 → 끝의 ".0" 제거
--   "5.0점" → "5", "4.5점" → "4.5", "지도자3점" → "지도자3", "" → null
-- 1) 기존 데이터 정리  2) 이후 어느 경로로 저장해도 트리거가 같은 규칙으로 정리

create or replace function public.normalize_grade_text(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    regexp_replace(
      regexp_replace(regexp_replace(coalesce(p, ''), '\s+', '', 'g'), '점$', ''),
      '^(.*\d)\.0$', '\1'),
    '')
$$;

create or replace function public.normalize_grade_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.grade := public.normalize_grade_text(new.grade);
  return new;
end;
$$;

drop trigger if exists trg_normalize_member_grade on public.members;
create trigger trg_normalize_member_grade
  before insert or update of grade on public.members
  for each row execute function public.normalize_grade_trigger();

drop trigger if exists trg_normalize_result_grade on public.tournament_results;
create trigger trg_normalize_result_grade
  before insert or update of grade on public.tournament_results
  for each row execute function public.normalize_grade_trigger();

update public.members
   set grade = public.normalize_grade_text(grade)
 where grade is distinct from public.normalize_grade_text(grade);

update public.tournament_results
   set grade = public.normalize_grade_text(grade)
 where grade is distinct from public.normalize_grade_text(grade);
