-- 회원 이름 앞뒤 공백 정리 + 재발 방지
--  '강향주 ' 처럼 끝에 공백이 붙은 이름이 9건 있어, 이름 완전 일치로 찾는
--  내 랭킹 조회·엑셀 업로드 매칭에서 빠질 수 있었다.
--  club 과 같은 방식(20261001150000_members_club_trim)으로 저장 시 자동 정리. 멱등.

create or replace function public.normalize_member_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is not null then
    new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  end if;
  if new.display_name is not null then
    new.display_name := btrim(regexp_replace(new.display_name, '\s+', ' ', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_member_name on public.members;
create trigger trg_normalize_member_name
  before insert or update of name, display_name on public.members
  for each row execute function public.normalize_member_name();

update public.members
   set name = btrim(regexp_replace(name, '\s+', ' ', 'g')),
       display_name = btrim(regexp_replace(display_name, '\s+', ' ', 'g'))
 where name is distinct from btrim(regexp_replace(name, '\s+', ' ', 'g'))
    or display_name is distinct from btrim(regexp_replace(display_name, '\s+', ' ', 'g'));
