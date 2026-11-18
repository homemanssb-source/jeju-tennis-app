-- 제4회 협회장배(동호인 개인복식·주니어 선수권) 취소·변경 마감 해제
--  순연이 확정되기 전에는 닫아 둔다(null → entry_close_at 을 따름).
--  순연 확정 시 관리자 화면에서 해당 대회의 취소·변경 마감을 다시 입력한다. 멱등.

update public.events
   set change_close_at = null
 where event_date = date '2026-11-21'
   and event_name in (
     '제4회 제주시테니스협회장배 동호인 개인복식 대회',
     '제4회 제주시테니스협회장배 주니어 선수권 대회'
   );
