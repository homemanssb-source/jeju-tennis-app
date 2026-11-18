-- 20261118180000_members_name_trim 되돌리기 (트리거만 제거)
-- 이름 공백 정리는 데이터 변경이라 되돌리지 않음 (끝 공백만 지운 것이라 복구할 의미 없음)
drop trigger if exists trg_normalize_member_name on public.members;
drop function if exists public.normalize_member_name();
