-- 대회별 결제 확인 필요 여부
-- 참가비를 받지 않는 대회(예: 청소년 대회)는 false 로 두면
-- 신청 화면·관리 화면에서 결제 상태/입금 안내/결제확인 버튼이 모두 숨겨진다.
-- 참가비 0원 ≠ 무료 (클럽대항전 등은 금액 미입력 상태로 운영되므로) 라서 별도 플래그로 둔다.
alter table public.events
  add column if not exists payment_required boolean not null default true;
