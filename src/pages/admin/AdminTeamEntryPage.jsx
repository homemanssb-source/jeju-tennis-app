import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const STATUS_MAP = {
  pending: { label: '대기', color: 'text-yellow-600 bg-yellow-50' },
  confirmed: { label: '확정', color: 'text-green-600 bg-green-50' },
  cancelled: { label: '취소', color: 'text-red-600 bg-red-50' },
}

const PAYMENT_MAP = {
  '미납': { label: '미납', color: 'text-red-600 bg-red-50' },
  '결제완료': { label: '결제완료', color: 'text-green-600 bg-green-50' },
  '현장납부': { label: '현장납부', color: 'text-yellow-600 bg-yellow-50' },
}

function getMatchTypeLabel(type) {
  if (type === '5_doubles') return '5복식 (3승 선승)'
  if (type === '3_doubles') return '3복식 (2승 선승)'
  return '-'
}

export default function AdminTeamEntryPage() {
  const showToast = useContext(ToastContext)
  const [entries, setEntries] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [members, setMembers] = useState([])

  // ── 체크박스 일괄 처리 ──
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkConfirmModal, setBulkConfirmModal] = useState(null) // { type: 'confirm'|'payment', label }

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('event_id, event_name, event_date, status, event_type, team_match_type')
      .order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchEntries(eventId) {
    if (!eventId) { setEntries([]); return }
    setLoading(true)
    const { data } = await supabase.from('team_event_entries')
      .select('*').eq('event_id', eventId).order('created_at', { ascending: false })
    setEntries(data || [])
    setCheckedIds(new Set())
    setLoading(false)
  }

  async function fetchMembers(entryId) {
    const { data } = await supabase.from('team_event_members')
      .select('*').eq('entry_id', entryId).order('member_order')
    setMembers(data || [])
  }

  function handleEventChange(eventId) {
    setSelectedEventId(eventId)
    setSelectedEntry(null); setMembers([])
    setCheckedIds(new Set())
    setBulkMode(false)
    fetchEntries(eventId)
  }

  async function handleSelectEntry(entry) {
    if (bulkMode) return // 일괄모드에서는 상세 열기 금지
    setSelectedEntry(entry)
    await fetchMembers(entry.id)
  }

  async function handleUpdateStatus(entryId, newStatus) {
    const { error } = await supabase.from('team_event_entries')
      .update({ status: newStatus }).eq('id', entryId)
    if (error) { showToast?.('상태 변경 실패: ' + error.message, 'error'); return }
    showToast?.('상태 변경: ' + newStatus)
    fetchEntries(selectedEventId)
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(prev => ({ ...prev, status: newStatus }))
    }
  }

  async function handlePaymentUpdate(entryId, status) {
    const { error } = await supabase.from('team_event_entries')
      .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
      .eq('id', entryId)
    if (error) { showToast?.('결제 상태 변경 실패: ' + error.message, 'error'); return }
    showToast?.('결제 상태 변경: ' + status)
    fetchEntries(selectedEventId)
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(prev => ({ ...prev, payment_status: status }))
    }
  }

  // ── 체크박스 토글 ──
  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 전체 선택/해제 (취소 제외) ──
  const activeEntries = entries.filter(e => e.status !== 'cancelled')
  function toggleAll() {
    if (checkedIds.size === activeEntries.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(activeEntries.map(e => e.id)))
    }
  }

  // ── 일괄 확정 처리 ──
  async function handleBulkConfirm() {
    if (checkedIds.size === 0) return
    setBulkLoading(true)
    const ids = [...checkedIds]
    const { error } = await supabase.from('team_event_entries')
      .update({ status: 'confirmed' })
      .in('id', ids)
    if (error) { showToast?.('일괄 확정 실패: ' + error.message, 'error') }
    else { showToast?.(`✅ ${ids.length}팀 확정 완료`) }
    setBulkLoading(false)
    setBulkConfirmModal(null)
    setCheckedIds(new Set())
    fetchEntries(selectedEventId)
  }

  // ── 일괄 결제완료 처리 ──
  async function handleBulkPayment() {
    if (checkedIds.size === 0) return
    setBulkLoading(true)
    const ids = [...checkedIds]
    const { error } = await supabase.from('team_event_entries')
      .update({ payment_status: '결제완료', paid_at: new Date().toISOString() })
      .in('id', ids)
    if (error) { showToast?.('일괄 결제완료 실패: ' + error.message, 'error') }
    else { showToast?.(`💰 ${ids.length}팀 결제완료 처리`) }
    setBulkLoading(false)
    setBulkConfirmModal(null)
    setCheckedIds(new Set())
    fetchEntries(selectedEventId)
  }

  function formatDate(d) {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
  }

  const statusCounts = {
    total: entries.length,
    pending: entries.filter(e => e.status === 'pending').length,
    confirmed: entries.filter(e => e.status === 'confirmed').length,
  }

  const paymentCounts = {
    paid: entries.filter(e => e.payment_status === '결제완료').length,
    unpaid: entries.filter(e => !e.payment_status || e.payment_status === '미납').length,
  }

  const selectedEvent = events.find(ev => ev.event_id === selectedEventId)
  const allChecked = activeEntries.length > 0 && checkedIds.size === activeEntries.length
  const someChecked = checkedIds.size > 0

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold">🏟️ 단체전 신청관리</h2>

      {/* 대회 선택 */}
      <div>
        <select value={selectedEventId} onChange={e => handleEventChange(e.target.value)}
          className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
          <option value="">대회를 선택하세요</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date}) {ev.status === 'OPEN' ? '🟢' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 경기방식 표시 */}
      {selectedEvent && (selectedEvent.event_type === 'team' || selectedEvent.event_type === 'both') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-xs text-blue-600">경기방식:</span>
          <span className="text-sm font-bold text-blue-800">
            {getMatchTypeLabel(selectedEvent.team_match_type)}
          </span>
        </div>
      )}

      {/* 현황 요약 */}
      {selectedEventId && (
        <div className="flex gap-2 flex-wrap">
          <div className="bg-white border border-line rounded-lg px-3 py-2 flex-1 text-center min-w-[60px]">
            <p className="text-lg font-bold">{statusCounts.total}</p>
            <p className="text-xs text-sub">전체</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex-1 text-center min-w-[60px]">
            <p className="text-lg font-bold text-yellow-600">{statusCounts.pending}</p>
            <p className="text-xs text-yellow-600">대기</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex-1 text-center min-w-[60px]">
            <p className="text-lg font-bold text-green-600">{statusCounts.confirmed}</p>
            <p className="text-xs text-green-600">확정</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex-1 text-center min-w-[60px]">
            <p className="text-lg font-bold text-green-700">{paymentCounts.paid}</p>
            <p className="text-xs text-green-700">결제완료</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex-1 text-center min-w-[60px]">
            <p className="text-lg font-bold text-red-600">{paymentCounts.unpaid}</p>
            <p className="text-xs text-red-600">미납</p>
          </div>
        </div>
      )}

      {/* 상세 보기 */}
      {selectedEntry && (
        <div className="bg-white border border-line rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => { setSelectedEntry(null); setMembers([]) }}
              className="text-sm text-accent">← 목록</button>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${STATUS_MAP[selectedEntry.status]?.color || ''}`}>
                {STATUS_MAP[selectedEntry.status]?.label || selectedEntry.status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${PAYMENT_MAP[selectedEntry.payment_status || '미납']?.color || 'bg-red-50 text-red-600'}`}>
                {PAYMENT_MAP[selectedEntry.payment_status || '미납']?.label || '미납'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm"><span className="text-sub">클럽명:</span> <b>{selectedEntry.club_name}</b></p>
            <p className="text-sm"><span className="text-sub">부서:</span> <b>{selectedEntry.division_name || '미지정'}</b></p>
            <p className="text-sm"><span className="text-sub">대표:</span> {selectedEntry.captain_name}</p>
            {selectedEvent && (
              <p className="text-sm"><span className="text-sub">경기방식:</span> <b>{getMatchTypeLabel(selectedEvent.team_match_type)}</b></p>
            )}
            <p className="text-sm"><span className="text-sub">신청일:</span> {formatDate(selectedEntry.created_at)}</p>
          </div>

          {/* 선수 명단 */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">선수 명단 ({members.length}명)</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-sub">
                  <th className="text-left px-2 py-1.5 w-8">#</th>
                  <th className="text-left px-2 py-1.5">이름</th>
                  <th className="text-left px-2 py-1.5 w-12">성별</th>
                  <th className="text-left px-2 py-1.5 w-16">등급</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className="border-t border-line/30">
                    <td className="px-2 py-1.5 text-xs text-sub">{i + 1}</td>
                    <td className="px-2 py-1.5">{m.member_name}</td>
                    <td className="px-2 py-1.5 text-xs">{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-accent">{m.grade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 결제 상태 변경 버튼 */}
          <div className="pt-2 border-t border-line">
            <p className="text-xs text-sub mb-2">💰 결제 상태</p>
            <div className="flex gap-2">
              {(selectedEntry.payment_status || '미납') !== '결제완료' && (
                <button onClick={() => handlePaymentUpdate(selectedEntry.id, '결제완료')}
                  className="flex-1 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600">
                  💰 결제확인
                </button>
              )}
              {(selectedEntry.payment_status || '미납') !== '현장납부' && (selectedEntry.payment_status || '미납') !== '결제완료' && (
                <button onClick={() => handlePaymentUpdate(selectedEntry.id, '현장납부')}
                  className="flex-1 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600">
                  🏦 현장납부
                </button>
              )}
              {selectedEntry.payment_status === '결제완료' && (
                <button onClick={() => handlePaymentUpdate(selectedEntry.id, '미납')}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">
                  결제 취소 → 미납
                </button>
              )}
            </div>
          </div>

          {/* 상태 변경 버튼 */}
          <div className="flex gap-2 pt-2 border-t border-line">
            {selectedEntry.status === 'pending' && (
              <>
                <button onClick={() => handleUpdateStatus(selectedEntry.id, 'confirmed')}
                  className="flex-1 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600">
                  ✅ 확정
                </button>
                <button onClick={() => handleUpdateStatus(selectedEntry.id, 'cancelled')}
                  className="flex-1 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
                  ❌ 취소
                </button>
              </>
            )}
            {selectedEntry.status === 'confirmed' && (
              <button onClick={() => handleUpdateStatus(selectedEntry.id, 'cancelled')}
                className="flex-1 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">
                ❌ 취소
              </button>
            )}
            {selectedEntry.status === 'cancelled' && (
              <button onClick={() => handleUpdateStatus(selectedEntry.id, 'pending')}
                className="flex-1 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600">
                🔄 대기로 변경
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 목록 (일괄 처리 포함) ── */}
      {selectedEventId && !selectedEntry && (
        <>
          {loading ? (
            <p className="text-sm text-sub py-8 text-center">불러오는 중...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-sub py-8 text-center">신청 내역이 없습니다.</p>
          ) : (
            <>
              {/* 일괄 처리 토글 버튼 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setBulkMode(v => !v); setCheckedIds(new Set()) }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium
                    ${bulkMode
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-gray-600 border-line hover:bg-soft'}`}
                >
                  {bulkMode ? '✓ 일괄선택 중' : '☑ 일괄선택'}
                </button>
                {bulkMode && (
                  <span className="text-xs text-sub">
                    {someChecked ? `${checkedIds.size}팀 선택됨` : '팀을 선택하세요'}
                  </span>
                )}
              </div>

              {/* 일괄 처리 액션 바 */}
              {bulkMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  {/* 전체 선택 */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-accent rounded"
                    />
                    <span className="text-xs font-medium text-blue-800">
                      전체 선택 ({activeEntries.length}팀, 취소 제외)
                    </span>
                  </label>

                  {/* 일괄 버튼 */}
                  <div className="flex gap-2">
                    <button
                      disabled={!someChecked || bulkLoading}
                      onClick={() => setBulkConfirmModal({ type: 'confirm', label: '확정' })}
                      className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                        bg-green-500 text-white hover:bg-green-600
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ✅ 일괄 확정
                    </button>
                    <button
                      disabled={!someChecked || bulkLoading}
                      onClick={() => setBulkConfirmModal({ type: 'payment', label: '결제완료' })}
                      className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                        bg-blue-500 text-white hover:bg-blue-600
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      💰 일괄 결제완료
                    </button>
                  </div>
                  {someChecked && (
                    <p className="text-[11px] text-blue-600 text-center">
                      선택된 {checkedIds.size}팀에 일괄 적용됩니다
                    </p>
                  )}
                </div>
              )}

              {/* 팀 목록 */}
              <div className="space-y-2">
                {entries.map(entry => {
                  const isCancelled = entry.status === 'cancelled'
                  const isChecked = checkedIds.has(entry.id)
                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        if (bulkMode && !isCancelled) toggleCheck(entry.id)
                        else if (!bulkMode) handleSelectEntry(entry)
                      }}
                      className={`w-full text-left rounded-xl border transition-colors cursor-pointer
                        ${bulkMode && !isCancelled ? 'active:scale-[0.99]' : ''}
                        ${isChecked
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : isCancelled
                            ? 'bg-gray-50 border-gray-200 opacity-60'
                            : 'bg-white border-line hover:bg-soft'}`}
                    >
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          {/* 체크박스 */}
                          {bulkMode && (
                            <div className="shrink-0">
                              {isCancelled ? (
                                <div className="w-4 h-4 rounded border border-gray-300 bg-gray-100" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCheck(entry.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 accent-accent rounded"
                                />
                              )}
                            </div>
                          )}

                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold truncate">{entry.club_name}</span>
                                {entry.division_name && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">
                                    {entry.division_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${PAYMENT_MAP[entry.payment_status || '미납']?.color || 'bg-red-50 text-red-600'}`}>
                                  {PAYMENT_MAP[entry.payment_status || '미납']?.label || '미납'}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_MAP[entry.status]?.color || ''}`}>
                                  {STATUS_MAP[entry.status]?.label || entry.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-sub">
                              <span>대표: {entry.captain_name}</span>
                              <span>{formatDate(entry.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── 일괄 처리 확인 모달 ── */}
      {bulkConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">
                {bulkConfirmModal.type === 'confirm' ? '✅' : '💰'}
              </div>
              <p className="text-base font-bold text-gray-900">
                일괄 {bulkConfirmModal.label}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                선택된 <span className="font-bold text-accent">{checkedIds.size}팀</span>을
              </p>
              <p className="text-sm text-gray-500">
                모두 <span className="font-bold text-gray-800">{bulkConfirmModal.label}</span> 처리합니다.
              </p>

              {/* 선택된 팀 미리보기 */}
              <div className="mt-3 max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-2 text-left">
                {entries.filter(e => checkedIds.has(e.id)).map(e => (
                  <div key={e.id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs font-medium text-gray-800">{e.club_name}</span>
                    <span className="text-[10px] text-gray-500">{e.division_name || '미지정'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setBulkConfirmModal(null)}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={bulkConfirmModal.type === 'confirm' ? handleBulkConfirm : handleBulkPayment}
                disabled={bulkLoading}
                className={`flex-1 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50
                  ${bulkConfirmModal.type === 'confirm' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                {bulkLoading ? '처리 중...' : `${checkedIds.size}팀 ${bulkConfirmModal.label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
