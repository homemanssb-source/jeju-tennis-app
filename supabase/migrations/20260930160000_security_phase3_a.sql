-- ============================================================
-- 보안 3단계-A (프론트 배포 "전" 실행 — 기존 화면·함수 시그니처 그대로라 영향 없음)
--
--  1) PIN 연속 실패 잠금: 같은 이름/전화번호/회원ID 로 15분 안에 5번 틀리면 10분간 잠금
--     → PIN 을 확인하는 공개 함수가 모두 공통 확인 함수를 쓰도록 다시 작성
--  2) 중고장터 서버 함수: 글 저장·상태·삭제, 댓글 등록·삭제·조회(비밀 댓글 서버 필터), 좋아요
--  3) 회원 등록 서버 함수: 상태(동호인 '휴면' / 학생선수 '활성')·PIN 규칙을 서버에서 결정
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) PIN 시도 기록 + 공통 확인 함수
-- ------------------------------------------------------------
create table if not exists public.pin_attempts (
  key          text primary key,
  fails        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.pin_attempts enable row level security;   -- 정책 없음: 소유자 권한 함수만 접근
revoke all on public.pin_attempts from anon, authenticated;

create or replace function public._pin_locked(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pin_attempts where key = p_key and locked_until > now())
$$;

create or replace function public._pin_record(p_key text, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_fails int;
begin
  if p_ok then
    delete from pin_attempts where key = p_key;
    return;
  end if;
  insert into pin_attempts as a (key, fails, updated_at)
  values (p_key, 1, now())
  on conflict (key) do update
     set fails = case when a.updated_at < now() - interval '15 minutes' then 1 else a.fails + 1 end,
         updated_at = now()
  returning fails into v_fails;
  if v_fails >= 5 then
    update pin_attempts set locked_until = now() + interval '10 minutes' where key = p_key;
  end if;
end;
$$;

-- 이름 + PIN (활성 회원)
create or replace function public._pin_auth_name(p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := 'name:' || lower(trim(coalesce(p_name, '')));
  v_id  text;
begin
  if public._pin_locked(v_key) then
    return jsonb_build_object('ok', false, 'locked', true,
      'message', 'PIN을 여러 번 잘못 입력했습니다. 10분 후 다시 시도해주세요.');
  end if;
  select member_id into v_id from members
   where name = p_name and pin_code = p_pin and status = '활성'
     and coalesce(p_pin, '') <> ''
   limit 1;
  perform public._pin_record(v_key, v_id is not null);
  if v_id is null then
    return jsonb_build_object('ok', false, 'message', '이름 또는 PIN이 일치하지 않습니다.');
  end if;
  return jsonb_build_object('ok', true, 'member_id', v_id);
end;
$$;

-- 회원ID + PIN (활성 회원)
create or replace function public._pin_auth_id(p_member_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key text := 'mid:' || coalesce(p_member_id, '');
  v_ok  boolean;
begin
  if public._pin_locked(v_key) then
    return jsonb_build_object('ok', false, 'locked', true,
      'message', 'PIN을 여러 번 잘못 입력했습니다. 10분 후 다시 시도해주세요.');
  end if;
  v_ok := exists (select 1 from members
                   where member_id = p_member_id and pin_code = p_pin and status = '활성'
                     and coalesce(p_pin, '') <> '');
  perform public._pin_record(v_key, v_ok);
  if not v_ok then
    return jsonb_build_object('ok', false, 'message', 'PIN이 일치하지 않습니다.');
  end if;
  return jsonb_build_object('ok', true, 'member_id', p_member_id);
end;
$$;

revoke all on function public._pin_locked(text)            from public, anon, authenticated;
revoke all on function public._pin_record(text, boolean)   from public, anon, authenticated;
revoke all on function public._pin_auth_name(text, text)   from public, anon, authenticated;
revoke all on function public._pin_auth_id(text, text)     from public, anon, authenticated;

-- 전화번호 + PIN (신청 취소·파트너 변경에서 사용) — 잠금 적용, 반환 형식은 그대로
create or replace function public._member_by_phone_pin(p_phone text, p_pin text)
returns members language plpgsql security definer set search_path = public as $$
declare
  v_norm text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_key  text := 'phone:' || v_norm;
  v_m    members%rowtype;
begin
  if coalesce(p_pin, '') = '' or public._pin_locked(v_key) then
    return null;
  end if;
  select * into v_m from members
   where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_norm
     and pin_code = p_pin
     and coalesce(status, '') <> '탈퇴'
   limit 1;
  perform public._pin_record(v_key, v_m.member_id is not null);
  return v_m;
end;
$$;
revoke all on function public._member_by_phone_pin(text, text) from public, anon, authenticated;

-- 기존 공개 함수들: 같은 이름·인자·반환형으로 다시 작성 (PIN 확인만 공통 함수로 교체)

create or replace function public.rpc_verify_member_pin(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
  v_m    members%rowtype;
begin
  if not (v_auth->>'ok')::boolean then
    return json_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  select * into v_m from members where member_id = v_auth->>'member_id';
  return json_build_object('ok', true, 'member_id', v_m.member_id, 'name', v_m.name,
                           'club', v_m.club, 'grade', v_m.grade, 'gender', v_m.gender);
end;
$$;

create or replace function public.rpc_apply_team_with_pin(
  p_event_id uuid, p_division_id uuid, p_member1_id text, p_member1_pin text, p_member2_id text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_id(p_member1_id, p_member1_pin);
begin
  if not (v_auth->>'ok')::boolean then
    return json_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  return public._apply_individual_entry(p_event_id, p_division_id, p_member1_id, p_member2_id, true)::json;
end;
$$;

create or replace function public.rpc_change_pin(p_name text, p_current_pin text, p_new_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_current_pin);
begin
  if not (v_auth->>'ok')::boolean then
    return json_build_object('ok', false, 'message',
      case when (v_auth->>'locked')::boolean then v_auth->>'message'
           else '이름 또는 현재 PIN이 일치하지 않습니다.' end);
  end if;
  if coalesce(p_new_pin, '') !~ '^[0-9]{6}$' then
    return json_build_object('ok', false, 'message', 'PIN은 숫자 6자리여야 합니다.');
  end if;
  update members set pin_code = p_new_pin where member_id = v_auth->>'member_id';
  return json_build_object('ok', true, 'message', 'PIN이 변경되었습니다.');
end;
$$;

create or replace function public.rpc_create_board_post(
  p_name text, p_pin text, p_category text, p_title text, p_content text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
  v_m    members%rowtype;
begin
  if not (v_auth->>'ok')::boolean then
    return json_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  select * into v_m from members where member_id = v_auth->>'member_id';
  insert into board_posts (member_id, member_name, category, title, content)
  values (v_m.member_id, v_m.name, p_category, p_title, p_content);
  return json_build_object('ok', true, 'message', '글이 등록되었습니다.');
end;
$$;

create or replace function public.rpc_get_my_board_posts(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_auth  jsonb := public._pin_auth_name(p_name, p_pin);
  v_posts json;
begin
  if not (v_auth->>'ok')::boolean then
    return json_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  select json_agg(row_to_json(t)) into v_posts from (
    select id, category, title, content, is_read, admin_reply, admin_replied_at, created_at
      from board_posts
     where member_id = v_auth->>'member_id'
     order by created_at desc
  ) t;
  return json_build_object('ok', true, 'posts', coalesce(v_posts, '[]'::json));
end;
$$;

-- 단체전 신청 (로직은 기존과 동일, 대표 PIN 확인만 공통 함수로)
create or replace function public.rpc_submit_team_entry(
  p_event_id uuid, p_captain_name text, p_captain_pin text, p_club_name text, p_members jsonb,
  p_division_id uuid default null, p_division_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth         jsonb := public._pin_auth_name(p_captain_name, p_captain_pin);
  v_captain      members%rowtype;
  v_entry_id     uuid;
  v_member       jsonb;
  v_rec          members%rowtype;
  v_member_limit int;
  v_member_count int;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message',
      case when (v_auth->>'locked')::boolean then v_auth->>'message'
           else '대표자 이름 또는 PIN이 일치하지 않습니다.' end);
  end if;
  select * into v_captain from members where member_id = v_auth->>'member_id';

  select team_member_limit into v_member_limit from events where event_id = p_event_id;
  v_member_count := jsonb_array_length(p_members);
  if v_member_limit is not null and v_member_count > v_member_limit then
    return jsonb_build_object('ok', false, 'message',
      '인원 제한(' || v_member_limit || '명)을 초과했습니다. 현재 ' || v_member_count || '명');
  end if;

  for v_member in select value from jsonb_array_elements(p_members) loop
    if coalesce(v_member->>'member_id', '') <> '' then
      select * into v_rec from members where member_id = v_member->>'member_id' and status = '활성';
      if not found then
        return jsonb_build_object('ok', false, 'message', (v_member->>'name') || ' 선수는 활성 회원이 아닙니다.');
      end if;
    else
      return jsonb_build_object('ok', false, 'message', (v_member->>'name') || ' 선수는 동호인등록이 되어 있지 않습니다.');
    end if;
  end loop;

  if exists (
    select 1 from team_event_entries
     where event_id = p_event_id and club_name = p_club_name and status <> 'cancelled'
       and division_id is not distinct from p_division_id
  ) then
    return jsonb_build_object('ok', false, 'message', '이미 해당 클럽으로 신청된 내역이 있습니다.');
  end if;

  insert into team_event_entries (event_id, club_name, captain_member_id, captain_name, captain_pin,
                                  member_limit, division_id, division_name)
  values (p_event_id, p_club_name, v_captain.member_id, v_captain.name, '',
          v_member_limit, p_division_id, p_division_name)
  returning id into v_entry_id;

  for v_member in select value from jsonb_array_elements(p_members) loop
    insert into team_event_members (entry_id, member_id, member_name, gender, grade, member_order)
    values (v_entry_id, v_member->>'member_id', v_member->>'name', v_member->>'gender',
            v_member->>'grade', (v_member->>'order')::int);
  end loop;

  return jsonb_build_object('ok', true, 'message', '단체전 참가 신청이 완료되었습니다.', 'entry_id', v_entry_id);
end;
$$;

-- 단체전 명단 수정 v2: 대표 확인을 공통 함수로 (나머지 동일)
create or replace function public.rpc_update_team_roster_v2(
  p_entry_id uuid, p_captain_name text, p_captain_pin text, p_members jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth    jsonb := public._pin_auth_name(p_captain_name, p_captain_pin);
  v_captain members%rowtype;
  v_entry   team_event_entries%rowtype;
  v_close   timestamptz;
  v_m       jsonb;
  v_mid     text;
  v_name    text;
  v_count   int;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message',
      case when (v_auth->>'locked')::boolean then v_auth->>'message'
           else '대표자 이름 또는 PIN이 올바르지 않습니다.' end);
  end if;
  select * into v_captain from members where member_id = v_auth->>'member_id';

  select * into v_entry from team_event_entries where id = p_entry_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', '신청 내역을 찾을 수 없습니다.');
  end if;
  if v_entry.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'message', '취소된 신청입니다.');
  end if;
  if v_entry.captain_member_id is distinct from v_captain.member_id then
    return jsonb_build_object('ok', false, 'message', '해당 팀의 대표자만 명단을 수정할 수 있습니다.');
  end if;

  select entry_close_at into v_close from events where event_id = v_entry.event_id;
  if v_close is not null and v_close < now() then
    return jsonb_build_object('ok', false, 'message', '참가신청 마감 후에는 명단을 수정할 수 없습니다. 관리자에게 문의하세요.');
  end if;

  if p_members is null or jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    return jsonb_build_object('ok', false, 'message', '선수를 1명 이상 등록해주세요.');
  end if;
  v_count := jsonb_array_length(p_members);
  if v_entry.member_limit is not null and v_count > v_entry.member_limit then
    return jsonb_build_object('ok', false, 'message', '인원 제한(' || v_entry.member_limit || '명)을 초과했습니다.');
  end if;
  if (select count(distinct x->>'member_id') from jsonb_array_elements(p_members) x) <> v_count then
    return jsonb_build_object('ok', false, 'message', '같은 선수가 두 번 들어 있습니다.');
  end if;

  for v_m in select value from jsonb_array_elements(p_members) loop
    v_mid := nullif(v_m->>'member_id', '');
    if v_mid is null then
      return jsonb_build_object('ok', false, 'message', '등록된 회원만 명단에 넣을 수 있습니다.');
    end if;
    select name into v_name from members where member_id = v_mid and status = '활성';
    if not found then
      return jsonb_build_object('ok', false, 'message', coalesce(v_m->>'name', v_mid) || ' 선수는 활성 회원이 아닙니다.');
    end if;
    if v_mid <> v_captain.member_id and exists (
      select 1 from team_event_members tem
        join team_event_entries te on te.id = tem.entry_id
       where te.event_id = v_entry.event_id and te.id <> p_entry_id
         and te.status <> 'cancelled' and tem.member_id = v_mid
    ) then
      return jsonb_build_object('ok', false, 'message', v_name || ' 선수가 이미 다른 팀으로 신청되어 있습니다.');
    end if;
  end loop;

  delete from team_event_members where entry_id = p_entry_id;
  insert into team_event_members (entry_id, member_id, member_name, gender, grade, member_order)
  select p_entry_id, m.member_id, m.name, coalesce(m.gender, ''), coalesce(m.grade, ''), x.ord::int
    from jsonb_array_elements(p_members) with ordinality as x(v, ord)
    join members m on m.member_id = x.v->>'member_id';

  return jsonb_build_object('ok', true, 'message', '선수 명단이 수정되었습니다.');
end;
$$;

-- 동작하지 않던 옛 명단 수정 함수(id 타입 불일치)는 공개 실행 권한 제거
revoke all on function public.rpc_update_team_roster(bigint, text, text, jsonb) from public, anon;


-- ------------------------------------------------------------
-- 2) 중고장터 서버 함수 (이름 + PIN 으로 본인 확인)
-- ------------------------------------------------------------
create or replace function public.rpc_market_save_post(
  p_name text, p_pin text, p_post_id uuid,
  p_title text, p_content text, p_price int, p_category text, p_condition text, p_images text[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
  v_m    members%rowtype;
  v_id   uuid;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  select * into v_m from members where member_id = v_auth->>'member_id';
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_content), '') = '' or p_price is null or p_price < 0 then
    return jsonb_build_object('ok', false, 'message', '제목·가격·설명을 확인해주세요.');
  end if;
  if coalesce(array_length(p_images, 1), 0) > 4 then
    return jsonb_build_object('ok', false, 'message', '사진은 최대 4장까지 등록할 수 있습니다.');
  end if;

  if p_post_id is null then
    insert into market_posts (member_id, author_name, club, title, content, price, category, condition, images)
    values (v_m.member_id, v_m.name, coalesce(v_m.club, ''), trim(p_title), trim(p_content),
            p_price, p_category, p_condition, coalesce(p_images, '{}'))
    returning post_id into v_id;
  else
    update market_posts
       set title = trim(p_title), content = trim(p_content), price = p_price,
           category = p_category, condition = p_condition, images = coalesce(p_images, '{}'),
           updated_at = now()
     where post_id = p_post_id and member_id = v_m.member_id
    returning post_id into v_id;
    if v_id is null then
      return jsonb_build_object('ok', false, 'message', '본인 게시물만 수정할 수 있습니다.');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'post_id', v_id);
end;
$$;

create or replace function public.rpc_market_set_status(p_name text, p_pin text, p_post_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  if p_status not in ('판매중', '예약중', '거래완료') then
    return jsonb_build_object('ok', false, 'message', '잘못된 상태입니다.');
  end if;
  update market_posts set status = p_status, updated_at = now()
   where post_id = p_post_id and member_id = v_auth->>'member_id';
  if not found then
    return jsonb_build_object('ok', false, 'message', '본인 게시물만 변경 가능합니다.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rpc_market_delete_post(p_name text, p_pin text, p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth   jsonb := public._pin_auth_name(p_name, p_pin);
  v_images text[];
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  delete from market_posts where post_id = p_post_id and member_id = v_auth->>'member_id'
  returning images into v_images;
  if not found then
    return jsonb_build_object('ok', false, 'message', '본인 게시물만 삭제 가능합니다.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rpc_market_add_comment(
  p_name text, p_pin text, p_post_id uuid, p_content text, p_is_private boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
  v_m    members%rowtype;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  if coalesce(trim(p_content), '') = '' then
    return jsonb_build_object('ok', false, 'message', '댓글 내용을 입력해주세요.');
  end if;
  if not exists (select 1 from market_posts where post_id = p_post_id) then
    return jsonb_build_object('ok', false, 'message', '게시물을 찾을 수 없습니다.');
  end if;
  select * into v_m from members where member_id = v_auth->>'member_id';
  insert into market_comments (post_id, member_id, author_name, content, is_private)
  values (p_post_id, v_m.member_id, v_m.name, trim(p_content), coalesce(p_is_private, false));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rpc_market_delete_comment(p_name text, p_pin text, p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  delete from market_comments where comment_id = p_comment_id and member_id = v_auth->>'member_id';
  if not found then
    return jsonb_build_object('ok', false, 'message', '본인 댓글만 삭제할 수 있습니다.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.rpc_market_toggle_like(p_name text, p_pin text, p_post_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._pin_auth_name(p_name, p_pin);
  v_mid  text;
begin
  if not (v_auth->>'ok')::boolean then
    return jsonb_build_object('ok', false, 'message', v_auth->>'message');
  end if;
  v_mid := v_auth->>'member_id';
  if exists (select 1 from market_likes where post_id = p_post_id and member_id = v_mid) then
    delete from market_likes where post_id = p_post_id and member_id = v_mid;
    return jsonb_build_object('ok', true, 'liked', false);
  end if;
  insert into market_likes (post_id, member_id) values (p_post_id, v_mid)
  on conflict (post_id, member_id) do nothing;
  return jsonb_build_object('ok', true, 'liked', true);
end;
$$;

-- 댓글 조회: 비밀 댓글은 작성자·판매자에게만 (인증 정보가 없으면 공개 댓글만)
create or replace function public.rpc_market_comments(p_post_id uuid, p_name text default null, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_viewer text;
  v_owner  text;
  v_auth   jsonb;
begin
  if coalesce(p_name, '') <> '' and coalesce(p_pin, '') <> '' then
    v_auth := public._pin_auth_name(p_name, p_pin);
    if (v_auth->>'ok')::boolean then v_viewer := v_auth->>'member_id'; end if;
  end if;
  select member_id into v_owner from market_posts where post_id = p_post_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'comment_id', c.comment_id, 'post_id', c.post_id, 'member_id', c.member_id,
             'author_name', c.author_name, 'content', c.content, 'is_private', c.is_private,
             'created_at', c.created_at) order by c.created_at)
      from market_comments c
     where c.post_id = p_post_id
       and (not coalesce(c.is_private, false)
            or (v_viewer is not null and (c.member_id = v_viewer or v_owner = v_viewer)))
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.rpc_market_save_post(text, text, uuid, text, text, int, text, text, text[]) to anon, authenticated;
grant execute on function public.rpc_market_set_status(text, text, uuid, text)     to anon, authenticated;
grant execute on function public.rpc_market_delete_post(text, text, uuid)          to anon, authenticated;
grant execute on function public.rpc_market_add_comment(text, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.rpc_market_delete_comment(text, text, uuid)       to anon, authenticated;
grant execute on function public.rpc_market_toggle_like(text, text, uuid)          to anon, authenticated;
grant execute on function public.rpc_market_comments(uuid, text, text)             to anon, authenticated;


-- ------------------------------------------------------------
-- 3) 회원 등록 (등록 화면에서 사용) — 상태·PIN 을 서버가 결정
--    동호인: '휴면'(등록비 확인 후 관리자가 활성) / 학생선수: '활성'(등록비 면제)
--    PIN: 본인 전화 뒷 6자리, 학생선수는 없으면 보호자 전화 뒷 6자리
-- ------------------------------------------------------------
create or replace function public.rpc_register_member(
  p_name text, p_gender text, p_phone text, p_guardian_phone text, p_club text,
  p_member_type text, p_division text, p_grade text, p_birthdate date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_type     text := case when p_member_type = '선수' then '선수' else '동호인' end;
  v_phone    text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_guardian text := nullif(regexp_replace(coalesce(p_guardian_phone, ''), '[^0-9]', '', 'g'), '');
  v_id       text;
  v_try      int := 0;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(p_gender, '') = '' or coalesce(trim(p_club), '') = '' then
    return jsonb_build_object('ok', false, 'message', '이름, 성별, 소속은 필수입니다.');
  end if;
  if v_type = '선수' then
    if v_guardian is null or length(v_guardian) < 10 then
      return jsonb_build_object('ok', false, 'message', '보호자 연락처를 입력해주세요.');
    end if;
    if v_phone is not null and length(v_phone) < 10 then
      return jsonb_build_object('ok', false, 'message', '학생선수 연락처를 확인해주세요.');
    end if;
    if p_birthdate is null or p_birthdate > current_date or p_birthdate < date '1900-01-01' then
      return jsonb_build_object('ok', false, 'message', '생년월일을 확인해주세요.');
    end if;
  else
    if v_phone is null or length(v_phone) < 10 then
      return jsonb_build_object('ok', false, 'message', '전화번호는 필수입니다.');
    end if;
    if coalesce(p_division, '') = '' or coalesce(p_grade, '') = '' then
      return jsonb_build_object('ok', false, 'message', '랭킹부서, 등급은 필수입니다.');
    end if;
  end if;

  if v_phone is not null and exists (
    select 1 from members
     where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_phone
       and coalesce(status, '') <> '삭제'
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_phone', 'message', '이미 등록된 전화번호입니다.');
  end if;

  loop
    v_id := 'M' || lpad(((extract(epoch from clock_timestamp()) * 1000)::bigint % 100000000)::text, 8, '0');
    exit when not exists (select 1 from members where member_id = v_id);
    v_try := v_try + 1;
    if v_try > 20 then
      return jsonb_build_object('ok', false, 'message', '잠시 후 다시 시도해주세요.');
    end if;
    perform pg_sleep(0.002);
  end loop;

  insert into members (member_id, name, display_name, name_norm, gender, phone, guardian_phone, pin_code,
                       club, member_type, division, grade, birthdate, status, grade_source, registered_at)
  values (
    v_id, trim(p_name), trim(p_name),
    lower(regexp_replace(trim(p_name), '[^가-힣a-zA-Z0-9]', '', 'g')),
    p_gender, v_phone,
    case when v_type = '선수' then v_guardian else null end,
    right(coalesce(v_phone, v_guardian), 6),
    trim(p_club), v_type,
    case when v_type = '선수' then null else p_division end,
    case when v_type = '선수' then null else regexp_replace(p_grade, '점$', '') end,
    case when v_type = '선수' then p_birthdate else null end,
    case when v_type = '선수' then '활성' else '휴면' end,
    'auto', now()::text
  );
  return jsonb_build_object('ok', true, 'member_id', v_id);
end;
$$;
grant execute on function public.rpc_register_member(text, text, text, text, text, text, text, text, date) to anon, authenticated;

commit;
