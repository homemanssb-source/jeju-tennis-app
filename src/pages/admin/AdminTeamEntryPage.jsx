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
    fetchEntries(eventId)
  }

  async function handleSelectEntry(entry) {
    setSelectedEntry(entry)
    await fetchMembers(entry.id)
  }

  async function handleUpdateStatus(entryId, newStatus) {
    const { error } = await supabase.from('team_event_entries')
      .update({ status: newStatus }).eq('id', entryId)
    if (error) { alert('상태 변경 실패: ' + error.message); return }
    showToast?.('상태 변경: ' + newStatus)
    fetchEntries(selectedEventId)
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(prev => ({ ...prev, status: newStatus }))
    }
  }

  // ★ 결제 상태 업데이트
  async function handlePaymentUpdate(entryId, status) {
    const { error } = await supabase.from('team_event_entries')
      .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
      .eq('id', entryId)
    if (error) { alert('결제 상태 변경 실패: ' + error.message); return }
    showToast?.('결제 상태 변경: ' + status)
    fetchEntries(selectedEventId)
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(prev => ({ ...prev, payment_status: status }))
    }
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

  // ★ 결제 카운트
  const paymentCounts = {
    paid: entries.filter(e => e.payment_status === '결제완료').length,
    unpaid: entries.filter(e => !e.payment_status || e.payment_status === '미납').length,
  }

  const selectedEvent = events.find(ev => ev.event_id === selectedEventId)

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
          {/* ★ 결제 현황 */}
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
              {/* ★ 결제 배지 */}
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

          {/* ★ 결제 상태 변경 버튼 */}
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

      {/* 목록 */}
      {selectedEventId && !selectedEntry && (
        <>
          {loading ? (
            <p className="text-sm text-sub py-8 text-center">불러오는 중...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-sub py-8 text-center">신청 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <button key={entry.id} onClick={() => handleSelectEntry(entry)}
                  className="w-full text-left bg-white border border-line rounded-lg p-3 hover:bg-soft transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{entry.club_name}</span>
                      {entry.division_name && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{entry.division_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* ★ 결제 배지 */}
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
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}