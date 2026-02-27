import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function EntryAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])
  const [entries, setEntries] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { if (selectedEventId) fetchEntries() }, [selectedEventId])

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('event_entries')
      .select(`
        *,
        teams ( team_id, team_name, member1_id, member2_id ),
        event_divisions ( division_name )
      `)
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    if (filterPayment && e.payment_status !== filterPayment) return false
    return true
  })

  const totalCount = filtered.length
  const paidCount = filtered.filter(e => e.payment_status === '결제완료').length
  const unpaidCount = filtered.filter(e => e.payment_status === '미납').length

  async function handlePaymentUpdate(entryId, status) {
    await supabase.from('event_entries')
      .update({ payment_status: status, paid_at: status === '결제완료' ? new Date().toISOString() : null })
      .eq('entry_id', entryId)
    showToast?.('결제 상태 변경: ' + status)
    fetchEntries()
  }

  async function handleCancel(entryId) {
    if (!confirm('이 신청을 취소하시겠습니까?')) return
    await supabase.from('event_entries')
      .update({ entry_status: '취소', cancelled_at: new Date().toISOString() })
      .eq('entry_id', entryId)
    showToast?.('신청 취소됨')
    fetchEntries()
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">📋 참가신청 관리</h2>

      {/* 대회 선택 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          className="flex-1 min-w-[200px] text-sm border border-line rounded-lg px-3 py-2">
          <option value="">대회 선택</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>{ev.event_name} ({ev.event_date})</option>
          ))}
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
          className="text-sm border border-line rounded-lg px-3 py-2">
          <option value="">전체 결제상태</option>
          <option value="미납">미납만</option>
          <option value="결제완료">결제완료만</option>
          <option value="현장납부">현장납부</option>
        </select>
      </div>

      {/* 카운트 */}
      {selectedEventId && (
        <div className="flex gap-2 mb-4">
          <div className="bg-accent text-white px-3 py-2 rounded-lg">
            <p className="text-[10px] opacity-80">전체</p>
            <p className="text-lg font-bold">{totalCount}팀</p>
          </div>
          <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg">
            <p className="text-[10px]">결제완료</p>
            <p className="text-lg font-bold">{paidCount}팀</p>
          </div>
          <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg">
            <p className="text-[10px]">미납</p>
            <p className="text-lg font-bold">{unpaidCount}팀</p>
          </div>
        </div>
      )}

      {/* 엔트리 목록 */}
      {!selectedEventId ? (
        <p className="text-center py-8 text-sub text-sm">대회를 선택해주세요.</p>
      ) : loading ? (
        <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
      ) : (
        <div className="bg-white rounded-r border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-left text-sub font-medium">부서</th>
                <th className="px-3 py-2 text-left text-sub font-medium">팀</th>
                <th className="px-3 py-2 text-center text-sub font-medium">신청상태</th>
                <th className="px-3 py-2 text-center text-sub font-medium">결제</th>
                <th className="px-3 py-2 text-left text-sub font-medium">신청일</th>
                <th className="px-3 py-2 text-center text-sub font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-sub">신청 내역 없음</td></tr>
              ) : filtered.map(e => (
                <tr key={e.entry_id} className="border-t border-line hover:bg-soft">
                  <td className="px-3 py-2">{e.event_divisions?.division_name || '-'}</td>
                  <td className="px-3 py-2 font-medium">{e.teams?.team_name || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                      {e.entry_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.payment_status === '결제완료' ? 'bg-green-50 text-green-700' :
                      e.payment_status === '현장납부' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-600'
                    }`}>{e.payment_status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-sub">
                    {e.applied_at ? new Date(e.applied_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {e.payment_status !== '결제완료' && (
                        <button onClick={() => handlePaymentUpdate(e.entry_id, '결제완료')}
                          className="text-xs text-green-600 hover:underline">결제확인</button>
                      )}
                      {e.payment_status !== '현장납부' && e.payment_status !== '결제완료' && (
                        <button onClick={() => handlePaymentUpdate(e.entry_id, '현장납부')}
                          className="text-xs text-yellow-600 hover:underline">현장납부</button>
                      )}
                      <button onClick={() => handleCancel(e.entry_id)}
                        className="text-xs text-red-500 hover:underline">취소</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
