-- 클럽명 공백 정리
-- 앞뒤 공백이 붙은 표기("탐라클럽 " 등) 때문에 같은 클럽이 둘로 갈라져 필터에서 회원이 빠지던 문제.
-- 1) 기존 데이터: 앞뒤 공백 제거 + 연속 공백을 한 칸으로
-- 2) 이후 저장: 어느 경로(관리자 화면·가입 RPC·업로드)든 DB 트리거가 같은 규칙으로 정리

create or replace function public.normalize_member_club()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.club is not null then
    new.club := btrim(regexp_replace(new.club, '\s+', ' ', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_member_club on public.members;
create trigger trg_normalize_member_club
  before insert or update of club on public.members
  for each row execute function public.normalize_member_club();

update public.members
   set club = btrim(regexp_replace(club, '\s+', ' ', 'g'))
 where club is not null
   and club <> btrim(regexp_replace(club, '\s+', ' ', 'g'));
