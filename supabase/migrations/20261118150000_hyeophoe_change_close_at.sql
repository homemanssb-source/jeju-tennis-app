-- 제4회 협회장배(동호인 개인복식·주니어 선수권) 취소·변경 마감 설정
--  우천 순연 대비: 11/21(토) 17:00 KST 까지 본인 취소·파트너 변경 허용
--  신규 신청 마감(entry_close_at)은 건드리지 않는다. 멱등.

update public.events
   set change_close_at = timestamptz '2026-11-21 17:00+09'
 where event_date = date '2026-11-21'
   and event_name in (
     '제4회 제주시테니스협회장배 동호인 개인복식 대회',
     '제4회 제주시테니스협회장배 주니어 선수권 대회'
   );
