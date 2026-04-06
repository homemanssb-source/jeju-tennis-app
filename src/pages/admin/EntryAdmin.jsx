// src/pages/admin/EntryAdmin.jsx
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function EntryAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents]           = useState([])
  const [entries, setEntries]         = useState([])       // 개인전
  const [teamEntries, setTeamEntries] = useState([])       // 단체전
  const [selectedEventId, setSelectedEventId] = useState('')
  const [filterPayment, setFilterPayment]     = useState('')
  const [filterType, setFilterType]           = useState('')
  const [filterName, setFilterName]           = useState('')  // ★ 이름 검색
  const [loading, setLoading]                 = useState(false)

  // ── 취소 확인 모달 (관리자) ──
  const [confirmModal, setConfirmModal] = useState(null) // { message, onConfirm }

  // ── 환불 처리 모달 ──
  const [refundModal, setRefundModal] = useState(null) // entry 객체 (_raw 포함)
  const [refunding, setRefunding]     = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => {
    if (selectedEventId) { fetchEntries(); fetchTeamEntries() }
  }, [selectedEventId])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    // 일반 신청 건 (취소 제외)
    const { data: normalData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })

    // 환불대기/환불완료 건 (취소됐지만 관리자가 처리해야 할 건)
    const { data: refundData } = await supabase
      .from('event_entries')
      .select('*, teams ( team_id, team_name, member1_id, member2_id ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .eq('entry_status', '취소')
      .in('payment_status', ['환불대기', '환불완료'])
      .order('applied_at', { ascending: false })

    const merged = [
      ...(normalData || []),
      ...(refundData || []),
    ]
    setEntries(merged)
    setLoading(false)
  }

  async function fetchTeamEntries() {
    const { data } = await supabase
      .from('team_event_entries')
      .select('*')
      .eq('event_id', selectedEventId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setTeamEntries(data || [])
  }

  // ── 통합 목록 ──
  const allEntries = [
    ...entries.map(e => ({
      id:             e.entry_id,
      type:           '개인',
      name:           e.teams?.team_name || '-',
      division:       e.event_divisions?.division_name || '-',
      status:         e.entry_status,
      payment_status: e.payment_status,
      date:           e.applied_at,
      _source:        'individual',
      _raw:           e,
    })),
    ...teamEntries.map(e => ({
      id:             e.id,
      type:           '단체',
      name:           e.club_name || '-',
      division:       e.division_name || '-',
      status:         e.status === 'confirmed' ? '확정' : e.status === 'pending' ? '대기' : e.status,
      payment_status: e.payment_status || '미납',
      date:           e.created_at,
      _source:        'team',
      _raw:           e,
    })),
  ]

  // 취소 건 제외한 카운트 기준 목록
  const activeEntries = allEntries.filter(e =>
    e.status !== '취소' && e.payment_status !== '환불완료'
  )

  const totalCount   = activeEntries.length
  const paidCount    = activeEntries.filter(e => e.payment_status === '결제완료').length
  const unpaidCount  = activeEntries.filter(e => e.payment_status === '미납').length
  const refundCount  = allEntries.filter(e => e.payment_status === '환불대기').length

  // ★ 필터 적용 (이름 검색 포함)
  const filtered = allEntries.filter(e => {
    if (filterPayment && e.payment_status !== filterPayment) return false
    if (filterType === '개인' && e.type !== '개인') return false
    if (filterType === '단체' && e.type !== '단체') return false
    if (filterName.trim() && !e.name.toLowerCase().includes(filterName.trim().toLowerCase())) return false
    return true
  })

  // ── 결제 상태 변경 ──
  async function handlePaymentSet(entry, status) {
    if (entry._source === 'individual') {
      await supabase.from('event_entries')
        .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
        .eq('entry_id', entry.id)
    } else {
      await supabase.from('team_event_entries')
        .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
        .eq('id', entry.id)
    }
    showToast?.('결제 상태 변경: ' + status)
    fetchEntries(); fetchTeamEntries()
  }

  // ── 신청 취소 (관리자) ──
  function handleCancelConfirm(entry) {
    setConfirmModal({
      message: `"${entry.name}" 신청을 취소하시겠습니까?`,
      onConfirm: async () => {
        if (entry._source === 'individual') {
          await supabase.from('event_entries')
            .update({ entry_status: '취소', cancelled_at: new Date().toISOString() })
            .eq('entry_id', entry.id)
        } else {
          await supabase.from('team_event_entries')
            .update({ status: 'cancelled' })
            .eq('id', entry.id)
        }
        showToast?.('신청 취소됨')
        setConfirmModal(null)
        fetchEntries(); fetchTeamEntries()
      }
    })
  }

  // ── 환불 완료 처리 ──
  async function handleRefundComplete() {
    if (!refundModal) return
    setRefunding(true)
    const { error } = await supabase.from('event_entries')
      .update({
        payment_status:      '환불완료',
        refund_completed_at: new Date().toISOString(),
      })
      .eq('entry_id', refundModal.id)

    setRefunding(false)
    if (error) { showToast?.('환불 처리 실패: ' + error.message, 'error'); return }
    showToast?.('✅ 환불 완료 처리되었습니다.')
    setRefundModal(null)
    fetchEntries()
  }

  function formatDate(str) {
    if (!str) return '-'
    return new Date(str).toLocaleDateString('ko-KR')
  }

  function payBadgeClass(status) {
    if (status === '결제완료') return 'bg-green-50 text-green-700'
    if (status === '현장납부') return 'bg-yellow-50 text-yellow-700'
    if (status === '환불대기') return 'bg-orange-50 text-orange-700'
    if (status === '환불완료') return 'bg-gray-100 text-gray-500'
    return 'bg-red-50 text-red-600'
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">📋 참가신청 관리</h2>

      {/* 대회 선택 + 유형/결제 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={selectedEventId}
          onChange={e => { setSelectedEventId(e.target.value); setEntries([]); setTeamEntries([]) }}
          className="flex-1 min-w-[200px] text-sm border border-line rounded-lg px-3 py-2">
          <option value="">대회 선택</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date})
            </option>
          ))}
        </select>

        {/* ★ 이름 검색 */}
        <input
          type="text"
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
          placeholder="이름 검색..."
          className="text-sm border border-line rounded-lg px-3 py-2 w-32"
        />

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 유형</option>
          <option value="개인">개인전만</option>
          <option value="단체">단체전만</option>
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 결제상태</option>
          <option value="미납">미납만</option>
          <option value="결제완료">결제완료만</option>
          <option value="현장납부">현장납부</option>
          <option value="환불대기">환불대기만</option>
          <option value="환불완료">환불완료만</option>
        </select>
      </div>

      {/* ── 카운트 탭 ── */}
      {selectedEventId && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterPayment('')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '' ? 'bg-accent text-white' : 'bg-soft text-gray-700 hover:bg-soft2'
            }`}>
            <p className="text-[10px] opacity-80">전체</p>
            <p className="text-lg font-bold">{totalCount}팀</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '결제완료' ? '' : '결제완료')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '결제완료' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}>
            <p className="text-[10px] opacity-80">결제완료</p>
            <p className="text-lg font-bold">{paidCount}팀</p>
          </button>
          <button
            onClick={() => setFilterPayment(filterPayment === '미납' ? '' : '미납')}
            className={`px-3 py-2 rounded-lg text-left transition-colors ${
              filterPayment === '미납' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}>
            <p className="text-[10px] opacity-80">미납</p>
            <p className="text-lg font-bold">{unpaidCount}팀</p>
          </button>
          {refundCount > 0 && (
            <button
              onClick={() => setFilterPayment(filterPayment === '환불대기' ? '' : '환불대기')}
              className={`px-3 py-2 rounded-lg text-left transition-colors ${
                filterPayment === '환불대기'
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
              }`}>
              <p className="text-[10px] opacity-80">환불대기</p>
              <p className="text-lg font-bold">{refundCount}팀</p>
            </button>
          )}
        </div>
      )}

      {/* ── 엔트리 목록 ── */}
      {!selectedEventId ? (
        <p className="text-center py-8 text-sub text-sm">대회를 선택해주세요.</p>
      ) : loading ? (
        <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
      ) : (
        <div className="bg-white rounded-r border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-center text-sub font-medium">유형</th>
                <th className="px-3 py-2 text-left text-sub font-medium">부서</th>
                <th className="px-3 py-2 text-left text-sub font-medium">팀/클럽</th>
                <th className="px-3 py-2 text-center text-sub font-medium">상태</th>
                <th className="px-3 py-2 text-center text-sub font-medium">결제</th>
                <th className="px-3 py-2 text-left text-sub font-medium">신청일</th>
                <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sub">신청 내역 없음</td>
                </tr>
              ) : filtered.map(e => (
                <tr
                  key={`${e._source}-${e.id}`}
                  className={`border-t border-line hover:bg-soft ${
                    e.payment_status === '환불대기' ? 'bg-orange-50/40' : ''
                  }`}>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.type === '단체' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{e.type}</span>
                  </td>
                  <td className="px-3 py-2">{e.division}</td>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${payBadgeClass(e.payment_status)}`}>
                      {e.payment_status || '미납'}
                    </span>
                    {/* 환불대기: 계좌 정보 미리보기 */}
                    {e.payment_status === '환불대기' && e._raw && (
                      <div className="text-[10px] text-orange-700 mt-0.5 text-left">
                        {e._raw.refund_bank} {e._raw.refund_account}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-sub">
                    {e.date ? new Date(e.date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {/* 환불대기 → 환불 처리 버튼만 표시 */}
                      {e.payment_status === '환불대기' ? (
                        <button
                          onClick={() => setRefundModal(e)}
                          className="text-xs text-orange-600 border border-orange-200 bg-orange-50
                            hover:bg-orange-100 rounded px-2 py-0.5 font-medium">
                          환불 처리
                        </button>
                      ) : e.payment_status === '환불완료' ? (
                        <span className="text-xs text-gray-400">완료</span>
                      ) : (
                        <>
                          {e.payment_status !== '결제완료' && (
                            <button onClick={() => handlePaymentSet(e, '결제완료')}
                              className="text-xs text-green-600 hover:underline">결제확인</button>
                          )}
                          {e.payment_status !== '현장납부' && e.payment_status !== '결제완료' && (
                            <button onClick={() => handlePaymentSet(e, '현장납부')}
                              className="text-xs text-yellow-600 hover:underline">현장납부</button>
                          )}
                          <button onClick={() => handleCancelConfirm(e)}
                            className="text-xs text-red-500 hover:underline">취소</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 관리자 취소 확인 모달 ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <p className="text-sm text-gray-800 mb-5 whitespace-pre-line">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                취소
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 환불 처리 모달 ── */}
      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRefundModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm z-10">
            <h3 className="text-base font-semibold text-gray-900 mb-4">환불 처리 확인</h3>

            {/* 신청 정보 */}
            <div className="bg-soft rounded-xl px-4 py-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-sub">회원</span>
                <span className="font-medium">{refundModal.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">부서</span>
                <span>{refundModal.division}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sub">신청일</span>
                <span>{formatDate(refundModal.date)}</span>
              </div>
              {refundModal._raw?.refund_requested_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-sub">취소 신청일</span>
                  <span>{formatDate(refundModal._raw.refund_requested_at)}</span>
                </div>
              )}
            </div>

            {/* 환불 계좌 */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5 space-y-1.5">
              <p className="text-xs font-semibold text-orange-800 mb-1">환불 계좌 (회원 입력)</p>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">은행</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_bank || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">계좌번호</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_account || '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-orange-700">예금주</span>
                <span className="font-medium text-orange-900">{refundModal._raw?.refund_holder || '-'}</span>
              </div>
            </div>

            <p className="text-xs text-sub mb-5 leading-relaxed">
              위 계좌로 환불 입금 후 "환불 완료" 버튼을 눌러주세요.
              처리 후 결제 상태가 "환불완료"로 변경됩니다.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setRefundModal(null)}
                className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft">
                닫기
              </button>
              <button
                onClick={handleRefundComplete}
                disabled={refunding}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold
                  hover:bg-green-700 disabled:opacity-50">
                {refunding ? '처리 중...' : '환불 완료 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
