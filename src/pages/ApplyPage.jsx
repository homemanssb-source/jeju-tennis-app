// src/pages/ApplyPage.jsx
// 신청확인: 전체 목록 + 내 신청 내역 (전화번호+PIN 인증)
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function ApplyPage() {
  const [tab, setTab] = useState('all') // 'all' | 'mine'

  // ── 전체 신청 현황 ──
  const [events, setEvents]               = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [entries, setEntries]             = useState([])
  const [loading, setLoading]             = useState(false)

  // ── 내 신청 내역 ──
  const [phone, setPhone]       = useState('')
  const [pin, setPin]           = useState('')
  const [myEntries, setMyEntries]   = useState([])
  const [myName, setMyName]         = useState('')
  const [myLoading, setMyLoading]   = useState(false)
  const [myError, setMyError]       = useState('')
  const [mySearched, setMySearched] = useState(false)

  useEffect(() => { fetchEvents() }, [])
  useEffect(() => { if (selectedEventId) fetchEntries() }, [selectedEventId])

  async function fetchEvents() {
    const { data, error } = await supabase.from('events')
      .select('*').order('event_date', { ascending: false })
    if (error || !data || data.length === 0) { setEvents([]); return }
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

  const selectedEvent = events.find(e => e.event_id === selectedEventId)
  const divCounts = {}
  entries.forEach(e => {
    const d = e.event_divisions?.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('ko-KR')
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
    return 'bg-red-50 text-red-600'
  }

  // 마감 전인지 확인 (취소 가능 여부)
  function canCancel(entry) {
    if (entry.entry_status === 'cancelled') return false
    if (!entry.entry_close_at) return true
    return new Date(entry.entry_close_at) > new Date()
  }

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
            {myError && (
              <p className="text-xs text-red-500">⚠️ {myError}</p>
            )}
            <button
              onClick={handleMySearch}
              disabled={myLoading}
              className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold
                hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {myLoading ? '조회 중...' : '🔍 내 신청 내역 조회'}
            </button>
          </div>

          {/* 조회 결과 */}
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
                  {myEntries.map((e, idx) => (
                    <div key={e.entry_id || idx}
                      className="bg-white border border-line rounded-xl p-4">
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
                      <div className="flex gap-3 text-xs text-sub">
                        {e.division_name && <span>📋 {e.division_name}</span>}
                        {e.partner_name && <span>🤝 파트너: {e.partner_name}</span>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">신청일: {formatDate(e.applied_at)}</p>

                      {/* 취소 불가 안내 */}
                      {!canCancel(e) && e.entry_status !== 'cancelled' && (
                        <p className="text-[10px] text-sub mt-1.5">마감 후 취소는 관리자에게 문의하세요.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}