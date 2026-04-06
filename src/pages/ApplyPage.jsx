// src/pages/ApplyPage.jsx
// 신청확인: 전체 목록 + 내 신청 내역 (전화번호+PIN 인증)
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function ApplyPage() {
  const showToast = useContext(ToastContext)
  const [tab, setTab] = useState('all') // 'all' | 'mine'

  // ── 전체 신청 현황 ──
  const [events, setEvents]                   = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [entries, setEntries]                 = useState([])
  const [loading, setLoading]                 = useState(false)
  const [activeDivision, setActiveDivision]   = useState('전체')

  // ── 내 신청 내역 ──
  const [phone, setPhone]           = useState('')
  const [pin, setPin]               = useState('')
  const [myEntries, setMyEntries]   = useState([])
  const [myName, setMyName]         = useState('')
  const [myLoading, setMyLoading]   = useState(false)
  const [myError, setMyError]       = useState('')
  const [mySearched, setMySearched] = useState(false)

  // ── 취소 모달 ──
  const [cancelTarget, setCancelTarget]   = useState(null)
  const [refundBank, setRefundBank]       = useState('')
  const [refundAccount, setRefundAccount] = useState('')
  const [refundHolder, setRefundHolder]   = useState('')
  const [cancelling, setCancelling]       = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { if (selectedEventId) fetchEntries() }, [selectedEventId])

  async function fetchEvents() {
    const { data, error } = await supabase.from('events')
      .select('*').order('event_date', { ascending: true })
    if (error || !data || data.length === 0) { setEvents([]); return }
    setEvents(data)
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = data.find(e => e.event_date >= today)
    setSelectedEventId((upcoming || data[data.length - 1]).event_id)
  }

  async function fetchEntries() {
    setLoading(true)
    setActiveDivision('전체')
    const { data } = await supabase
      .from('event_entries')
      .select('*, teams ( team_name ), event_divisions ( division_name )')
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function handleMySearch() {
    if (!phone.trim()) { setMyError('전화번호를 입력해주세요.'); return }
    if (pin.length !== 6) { setMyError('PIN 6자리를 입력해주세요.'); return }
    setMyError('')
    setMyLoading(true)
    setMySearched(false)

    const { data, error } = await supabase.rpc('rpc_get_my_entries', {
      p_phone: phone.replace(/[^0-9]/g, ''),
      p_pin: pin,
    })

    setMyLoading(false)
    setMySearched(true)

    if (error || !data?.ok) {
      setMyError(data?.message || error?.message || '조회 실패')
      setMyEntries([])
      setMyName('')
      return
    }

    setMyName(data.member_name || '')
    setMyEntries(data.entries || [])
  }

  // ── 취소 가능 여부 판단 ──
  // 접수 마감 전이면 취소 가능 (미납·결제완료 모두)
  // 마감 후 또는 이미 취소/환불 상태면 불가
  function getCancelStatus(entry) {
    if (entry.entry_status === 'cancelled') return 'already'
    if (entry.payment_status === '환불대기') return 'refund_pending'
    if (entry.payment_status === '환불완료') return 'refund_done'
    // RPC 반환값에 entry_close_at 포함되어 있으므로 직접 사용
    if (entry.entry_close_at && new Date(entry.entry_close_at) < new Date()) return 'closed'
    return 'ok'
  }

  function openCancelModal(entry) {
    const status = getCancelStatus(entry)
    if (status === 'already')        { showToast('이미 취소된 신청입니다.', 'error'); return }
    if (status === 'refund_pending') { showToast('환불 신청 접수 중입니다.', 'error'); return }
    if (status === 'refund_done')    { showToast('이미 환불 완료된 건입니다.', 'error'); return }
    if (status === 'closed')         { showToast('접수 마감 후에는 취소할 수 없습니다.\n관리자에게 문의하세요.', 'error'); return }
    setRefundBank('')
    setRefundAccount('')
    setRefundHolder('')
    setCancelTarget(entry)
  }

  function closeCancelModal() {
    setCancelTarget(null)
    setRefundBank('')
    setRefundAccount('')
    setRefundHolder('')
  }

  const isPaid = cancelTarget?.payment_status === '결제완료'

  async function handleConfirmCancel() {
    if (!cancelTarget) return

    if (isPaid) {
      if (!refundBank.trim())    { showToast('은행명을 입력해주세요.', 'error'); return }
      if (!refundAccount.trim()) { showToast('계좌번호를 입력해주세요.', 'error'); return }
      if (!refundHolder.trim())  { showToast('예금주를 입력해주세요.', 'error'); return }
    }

    setCancelling(true)

    const updatePayload = {
      entry_status: '취소',
      cancelled_at: new Date().toISOString(),
    }

    if (isPaid) {
      updatePayload.payment_status      = '환불대기'
      updatePayload.refund_bank         = refundBank.trim()
      updatePayload.refund_account      = refundAccount.trim()
      updatePayload.refund_holder       = refundHolder.trim()
      updatePayload.refund_requested_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('event_entries')
      .update(updatePayload)
      .eq('entry_id', cancelTarget.entry_id)

    setCancelling(false)

    if (error) {
      showToast('취소 처리 실패: ' + error.message, 'error')
      return
    }

    showToast(isPaid ? '✅ 취소 및 환불 신청이 접수되었습니다.' : '✅ 신청이 취소되었습니다.')
    closeCancelModal()

    // 목록 낙관적 업데이트
    setMyEntries(prev => prev.map(e =>
      e.entry_id === cancelTarget.entry_id
        ? {
            ...e,
            entry_status:   'cancelled',
            payment_status: isPaid ? '환불대기' : e.payment_status,
          }
        : e
    ))
  }

  // ── 표시 헬퍼 ──
  const selectedEvent = events.find(e => e.event_id === selectedEventId)

  const divCounts = {}
  entries.forEach(e => {
    const d = e.event_divisions?.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })

  const filteredEntries = activeDivision === '전체'
    ? entries
    : entries.filter(e => (e.event_divisions?.division_name || '기타') === activeDivision)

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('ko-KR')
  }
  function formatCloseAt(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    if (!ev?.entry_close_at) return null
    return formatDate(ev.entry_close_at)
  }

  function getStatusStyle(status) {
    if (status === 'confirmed') return 'bg-green-50 text-green-700'
    if (status === 'cancelled') return 'bg-gray-100 text-gray-500'
    return 'bg-yellow-50 text-yellow-700'
  }
  function getStatusLabel(status) {
    if (status === 'confirmed') return '확정'
    if (status === 'cancelled') return '취소'
    return '대기'
  }
  function getPayStyle(status) {
    if (status === '결제완료') return 'bg-green-50 text-green-700'
    if (status === '현장납부') return 'bg-yellow-50 text-yellow-700'
    if (status === '환불대기') return 'bg-orange-50 text-orange-700'
    if (status === '환불완료') return 'bg-gray-100 text-gray-500'
    return 'bg-red-50 text-red-600'
  }

  const sortedEventsForSelect = [...events].sort((a, b) => {
    const today = new Date().toISOString().slice(0, 10)
    const aFuture = a.event_date >= today
    const bFuture = b.event_date >= today
    if (aFuture && bFuture) return a.event_date.localeCompare(b.event_date)
    if (!aFuture && !bFuture) return b.event_date.localeCompare(a.event_date)
    return aFuture ? -1 : 1
  })

  return (
    <div className="pb-20">
      <PageHeader title="📝 신청확인" subtitle="대회 참가 신청 현황" />

      {/* 탭 */}
      <div className="max-w-lg mx-auto px-5 pt-4">
        <div className="flex gap-1 bg-soft rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab('all')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === 'all' ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
            전체 현황
          </button>
          <button
            onClick={() => setTab('mine')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === 'mine' ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
            내 신청 내역
          </button>
        </div>
      </div>

      {/* ── 전체 현황 ── */}
      {tab === 'all' && (
        <div className="max-w-lg mx-auto px-5">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-sm text-sub">등록된 대회가 없습니다.</p>
            </div>
          ) : (
            <>
              <select value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 mb-4 bg-white font-medium">
                {sortedEventsForSelect.map(ev => (
                  <option key={ev.event_id} value={ev.event_id}>
                    {ev.event_name} ({ev.event_date})
                  </option>
                ))}
              </select>

              {selectedEvent && (
                <div className="bg-soft rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold">{selectedEvent.event_name}</p>
                  <p className="text-xs text-sub mt-0.5">
                    📅 {selectedEvent.event_date}
                    {selectedEvent.entry_fee_team > 0 && ` · 💰 ${selectedEvent.entry_fee_team.toLocaleString()}원/팀`}
                    {selectedEvent.status === 'OPEN' ? ' · 🟢 접수중' : ' · 🔴 마감'}
                  </p>
                </div>
              )}

              {Object.keys(divCounts).length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setActiveDivision('전체')}
                    className={`px-3 py-2 rounded-lg transition-colors ${
                      activeDivision === '전체'
                        ? 'bg-accent text-white'
                        : 'bg-white border border-line hover:bg-soft'
                    }`}>
                    <p className="text-[10px] opacity-80">전체</p>
                    <p className="text-lg font-bold">{entries.length}팀</p>
                  </button>
                  {Object.entries(divCounts).map(([div, count]) => (
                    <button key={div}
                      onClick={() => setActiveDivision(activeDivision === div ? '전체' : div)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        activeDivision === div
                          ? 'bg-accent text-white'
                          : 'bg-white border border-line hover:bg-soft'
                      }`}>
                      <p className={`text-[10px] ${activeDivision === div ? 'opacity-80' : 'text-sub'}`}>{div}</p>
                      <p className={`text-lg font-bold ${activeDivision === div ? '' : 'text-gray-800'}`}>{count}팀</p>
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-sub">신청 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEntries.map((entry, idx) => (
                    <div key={entry.entry_id}
                      className="bg-white border border-line rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-sub w-6">{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{entry.teams?.team_name || '-'}</p>
                          <p className="text-xs text-sub">
                            {entry.event_divisions?.division_name || '-'}
                            <span className="ml-2">
                              {entry.applied_at ? new Date(entry.applied_at).toLocaleDateString('ko-KR') : ''}
                            </span>
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPayStyle(entry.payment_status)}`}>
                        {entry.payment_status || '미납'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 내 신청 내역 ── */}
      {tab === 'mine' && (
        <div className="max-w-lg mx-auto px-5">
          <div className="bg-white border border-line rounded-xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">본인 확인</p>
            <div>
              <label className="block text-xs text-sub mb-1">전화번호</label>
              <input
                type="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">PIN (6자리)</label>
              <input
                type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="PIN 6자리"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
              <p className="text-xs text-sub mt-1">PIN 초기값은 전화번호 뒷 6자리입니다.</p>
            </div>
            {myError && <p className="text-xs text-red-500">⚠️ {myError}</p>}
            <button
              onClick={handleMySearch}
              disabled={myLoading}
              className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {myLoading ? '조회 중...' : '🔍 내 신청 내역 조회'}
            </button>
          </div>

          {mySearched && !myError && (
            <div>
              {myName && (
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  {myName}님의 신청 내역 ({myEntries.length}건)
                </p>
              )}

              {myEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm text-sub">신청 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myEntries.map((e, idx) => {
                    const cancelStatus = getCancelStatus(e)
                    const isCancelled  = e.entry_status === 'cancelled'
                    const closeDate    = e.entry_close_at ? formatDate(e.entry_close_at) : null
                    const showCancelBtn = !isCancelled
                      && e.payment_status !== '환불대기'
                      && e.payment_status !== '환불완료'

                    return (
                      <div key={e.entry_id || idx} className="bg-white border border-line rounded-xl p-4">
                        {/* 헤더 */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{e.event_name}</p>
                            <p className="text-xs text-sub mt-0.5">📅 {e.event_date}</p>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${getStatusStyle(e.entry_status)}`}>
                              {getStatusLabel(e.entry_status)}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${getPayStyle(e.payment_status)}`}>
                              {e.payment_status || '미납'}
                            </span>
                          </div>
                        </div>

                        {/* 부서 / 파트너 */}
                        <div className="flex gap-3 text-xs text-sub mb-1">
                          {e.division_name && <span>📋 {e.division_name}</span>}
                          {e.partner_name  && <span>🤝 파트너: {e.partner_name}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mb-2">신청일: {formatDate(e.applied_at)}</p>

                        {/* 환불 상태 안내 */}
                        {e.payment_status === '환불대기' && (
                          <div className="bg-orange-50 rounded-lg px-3 py-2 mt-1">
                            <p className="text-[10px] text-orange-700">환불 신청 접수 완료. 관리자 확인 후 입금됩니다.</p>
                          </div>
                        )}
                        {e.payment_status === '환불완료' && (
                          <p className="text-[10px] text-gray-400 mt-1">환불 처리가 완료되었습니다.</p>
                        )}

                        {/* 취소 버튼 영역 */}
                        {showCancelBtn && (
                          <div className="border-t border-line mt-3 pt-3 flex items-center justify-between">
                            <span className="text-[10px] text-sub">
                              {cancelStatus === 'closed'
                                ? '🔴 마감 후 취소불가 · 관리자 문의'
                                : closeDate ? `마감: ${closeDate}` : ''}
                            </span>
                            {cancelStatus === 'ok' ? (
                              <button
                                onClick={() => openCancelModal(e)}
                                className="text-xs text-red-500 border border-red-200 bg-red-50
                                  hover:bg-red-100 rounded-lg px-3 py-1.5 transition-colors">
                                신청 취소
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 border border-gray-200
                                bg-gray-50 rounded-lg px-3 py-1.5">
                                취소불가
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 취소 확인 모달 (Bottom Sheet) ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="absolute inset-0 bg-black/40" onClick={closeCancelModal} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl px-5 pt-4 pb-8 z-10">
            {/* 핸들 */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {isPaid ? '신청 취소 및 환불 신청' : '신청 취소 확인'}
            </h3>
            <p className="text-xs text-sub mb-4">취소 후에는 되돌릴 수 없습니다.</p>

            {/* 신청 요약 */}
            <div className="bg-soft rounded-xl px-4 py-3 mb-4">
              <p className="text-sm font-semibold text-gray-900">{cancelTarget.event_name}</p>
              <p className="text-xs text-sub mt-0.5">
                {[cancelTarget.division_name, cancelTarget.payment_status || '미납'].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* 결제완료 건: 환불 계좌 입력 */}
            {isPaid && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    결제 완료 건입니다. 환불받을 계좌를 입력해 주세요.
                    관리자 확인 후 입금 처리됩니다.
                  </p>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-sub mb-1">은행명</label>
                    <input
                      type="text" value={refundBank}
                      onChange={e => setRefundBank(e.target.value)}
                      placeholder="예) 농협, 국민, 카카오뱅크"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-sub mb-1">계좌번호</label>
                    <input
                      type="text" inputMode="numeric" value={refundAccount}
                      onChange={e => setRefundAccount(e.target.value.replace(/[^0-9-]/g, ''))}
                      placeholder="숫자만 입력"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-sub mb-1">예금주</label>
                    <input
                      type="text" value={refundHolder}
                      onChange={e => setRefundHolder(e.target.value)}
                      placeholder="예금주 이름"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeCancelModal}
                className="flex-1 py-3 border border-line rounded-xl text-sm text-sub
                  hover:bg-soft transition-colors">
                닫기
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold
                  hover:bg-red-600 disabled:opacity-50 transition-colors">
                {cancelling ? '처리 중...' : isPaid ? '취소 및 환불신청' : '신청 취소'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
