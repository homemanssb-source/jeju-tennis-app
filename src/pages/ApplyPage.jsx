import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function ApplyPage() {
  const [events, setEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { if (selectedEventId) fetchEntries() }, [selectedEventId])

  async function fetchEvents() {
    const { data, error } = await supabase.from('events')
      .select('*').order('event_date', { ascending: false })

    if (error || !data || data.length === 0) {
      // events 테이블이 없거나 비어있으면 빈 상태
      setEvents([])
      return
    }
    setEvents(data)
    if (data.length > 0) setSelectedEventId(data[0].event_id)
  }

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('event_entries')
      .select(`*, teams ( team_name ), event_divisions ( division_name )`)
      .eq('event_id', selectedEventId)
      .neq('entry_status', '취소')
      .order('applied_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const selectedEvent = events.find(e => e.event_id === selectedEventId)

  const divCounts = {}
  entries.forEach(e => {
    const d = e.event_divisions?.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })

  return (
    <div className="pb-20">
      <PageHeader title="📝 신청확인" subtitle="대회 참가 신청 현황" />

      <div className="max-w-lg mx-auto px-5 py-4">
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
              {events.map(ev => (
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
                <div className="bg-accent text-white px-3 py-2 rounded-lg">
                  <p className="text-[10px] opacity-80">전체</p>
                  <p className="text-lg font-bold">{entries.length}팀</p>
                </div>
                {Object.entries(divCounts).map(([div, count]) => (
                  <div key={div} className="bg-white border border-line px-3 py-2 rounded-lg">
                    <p className="text-[10px] text-sub">{div}</p>
                    <p className="text-lg font-bold text-gray-800">{count}팀</p>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-sub">신청 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry, idx) => (
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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      entry.payment_status === '결제완료' ? 'bg-green-50 text-green-700' :
                      entry.payment_status === '현장납부' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-600'
                    }`}>{entry.payment_status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
