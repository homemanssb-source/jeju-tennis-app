// src/pages/ApplyPage.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function ApplyPage() {
  const [tab, setTab] = useState('all')

  // ── 전체 현황 ──
  const [events, setEvents]                   = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [entries, setEntries]                 = useState([])       // 개인전
  const [teamEntries, setTeamEntries]         = useState([])       // 단체전
  const [loading, setLoading]                 = useState(false)
  const [activeDivision, setActiveDivision]   = useState('전체')

  // ── 내 신청 내역 ──
  const [phone, setPhone]           = useState('')
  const [pin, setPin]               = useState('')
  const [myEntries, setMyEntries]   = useState([])
  const [myName, setMyName]         = useState('')
  const [myMemberId, setMyMemberId] = useState('')
  const [myLoading, setMyLoading]   = useState(false)
  const [myError, setMyError]       = useState('')
  const [mySearched, setMySearched] = useState(false)

  // ── 명단 수정 모달 ──
  const [editEntry, setEditEntry]       = useState(null)   // 수정 중인 단체전 entry
  const [editRoster, setEditRoster]     = useState([])
  const [allMembers, setAllMembers]     = useState([])
  const [editSearch, setEditSearch]     = useState('')
  const [showEditDrop, setShowEditDrop] = useState(false)
  const [editPin, setEditPin]           = useState('')
  const [editSaving, setEditSaving]     = useState(false)
  const [editError, setEditError]       = useState('')

  useEffect(() => { fetchEvents(); fetchActiveMembers() }, [])
  useEffect(() => { if (selectedEventId) fetchEntries() }, [selectedEventId])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*').order('event_date', { ascending: true })
    if (!data || data.length === 0) { setEvents([]); return }
    setEvents(data)
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = data.find(e => e.event_date >= today)
    setSelectedEventId((upcoming || data[data.length - 1]).event_id)
  }

  async function fetchActiveMembers() {
    const { data } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, grade, gender, status')
      .eq('status', '활성').order('name')
    setAllMembers(data || [])
  }

  async function fetchEntries() {
    setLoading(true)
    setActiveDivision('전체')
    const ev = events.find(e => e.event_id === selectedEventId)

    // 개인전 조회
    if (!ev || ev.event_type === 'individual' || ev.event_type === 'both') {
      const { data } = await supabase
        .from('event_entries')
        .select('*, teams(team_name), event_divisions(division_name)')
        .eq('event_id', selectedEventId)
        .neq('entry_status', '취소')
        .order('applied_at', { ascending: false })
      setEntries(data || [])
    } else {
      setEntries([])
    }

    // 단체전 조회 (선수 명단 포함)
    if (!ev || ev.event_type === 'team' || ev.event_type === 'both') {
      const { data: teamData } = await supabase
        .from('team_event_entries')
        .select('*, team_event_members(*)')
        .eq('event_id', selectedEventId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
      setTeamEntries(teamData || [])
    } else {
      setTeamEntries([])
    }

    setLoading(false)
  }

  async function handleMySearch() {
    if (!phone.trim()) { setMyError('전화번호를 입력해주세요.'); return }
    if (pin.length !== 6) { setMyError('PIN 6자리를 입력해주세요.'); return }
    setMyError(''); setMyLoading(true); setMySearched(false)

    const { data, error } = await supabase.rpc('rpc_get_my_entries', {
      p_phone: phone.replace(/[^0-9]/g, ''),
      p_pin: pin,
    })

    setMyLoading(false); setMySearched(true)

    if (error || !data?.ok) {
      setMyError(data?.message || error?.message || '조회 실패')
      setMyEntries([]); setMyName(''); setMyMemberId('')
      return
    }

    setMyName(data.member_name || '')
    setMyMemberId(data.member_id || '')
    setMyEntries(data.entries || [])
  }

  // ── 명단 수정 열기 ──
  function openEditRoster(entry) {
    const sorted = [...(entry.roster || [])].sort((a, b) => a.order - b.order)
    setEditRoster(sorted)
    setEditEntry(entry)
    setEditPin(pin) // 이미 인증한 PIN 재사용
    setEditSearch('')
    setEditError('')
  }

  function closeEditRoster() {
    setEditEntry(null); setEditRoster([]); setEditError('')
  }

  function handleEditRemove(memberId) {
    setEditRoster(prev => prev.filter(r => r.member_id !== memberId))
  }

  function handleEditAdd(m) {
    if (editRoster.find(r => r.member_id === m.member_id)) return
    setEditRoster(prev => [...prev, {
      member_id: m.member_id,
      name: m.display_name || m.name,
      gender: m.gender || '',
      grade: m.grade || '',
      order: prev.length + 1,
    }])
    setEditSearch(''); setShowEditDrop(false)
  }

  async function handleEditSave() {
    if (editRoster.length === 0) { setEditError('선수를 1명 이상 추가해주세요.'); return }
    if (editPin.length !== 6) { setEditError('PIN 6자리를 입력해주세요.'); return }
    setEditSaving(true); setEditError('')

    const membersPayload = editRoster.map((r, i) => ({
      member_id: r.member_id, name: r.name,
      gender: r.gender, grade: r.grade, order: i + 1,
    }))

    const { data, error } = await supabase.rpc('rpc_update_team_roster', {
      p_entry_id:     editEntry.entry_id,
      p_captain_name: myName,
      p_captain_pin:  editPin,
      p_members:      membersPayload,
    })

    setEditSaving(false)
    if (error || !data?.ok) {
      setEditError(data?.message || error?.message || '수정 실패'); return
    }

    // 성공 → 내 신청 내역 갱신 후 모달 닫기
    await handleMySearch()
    closeEditRoster()
  }

  const selectedEvent = events.find(e => e.event_id === selectedEventId)
  const isTeamEvent = selectedEvent?.event_type === 'team'
  const isBothEvent = selectedEvent?.event_type === 'both'

  // 부서별 카운트 (개인전 + 단체전 통합)
  const divCounts = {}
  entries.forEach(e => {
    const d = e.event_divisions?.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })
  teamEntries.forEach(e => {
    const d = e.division_name || '기타'
    divCounts[d] = (divCounts[d] || 0) + 1
  })

  const filteredEntries = activeDivision === '전체'
    ? entries
    : entries.filter(e => (e.event_divisions?.division_name || '기타') === activeDivision)

  const filteredTeamEntries = activeDivision === '전체'
    ? teamEntries
    : teamEntries.filter(e => (e.division_name || '기타') === activeDivision)

  const sortedEventsForSelect = [...events].sort((a, b) => {
    const today = new Date().toISOString().slice(0, 10)
    const aF = a.event_date >= today, bF = b.event_date >= today
    if (aF && bF) return a.event_date.localeCompare(b.event_date)
    if (!aF && !bF) return b.event_date.localeCompare(a.event_date)
    return aF ? -1 : 1
  })

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('ko-KR')
  }

  function getStatusStyle(s) {
    if (s === 'confirmed' || s === '확정') return 'bg-green-50 text-green-700'
    if (s === 'cancelled' || s === '취소') return 'bg-gray-100 text-gray-500'
    return 'bg-yellow-50 text-yellow-700'
  }
  function getStatusLabel(s) {
    if (s === 'confirmed') return '확정'
    if (s === 'cancelled') return '취소'
    if (s === 'pending') return '대기'
    return s || '대기'
  }
  function getPayStyle(s) {
    if (s === '결제완료') return 'bg-green-50 text-green-700'
    if (s === '현장납부') return 'bg-yellow-50 text-yellow-700'
    return 'bg-red-50 text-red-600'
  }

  // 명단 수정 가능 여부 (entry_close_at 이전)
  function canEditRoster(entry) {
    // myMemberId가 해당 팀의 주장인 경우만
    if (!myMemberId) return false
    // entry.is_captain 이 true인 경우 (RPC에서 내려옴)
    if (!entry.is_captain) return false
    // entry_close_at 체크
    if (!entry.entry_close_at) return true
    return new Date(entry.entry_close_at) > new Date()
  }

  // 이름 검색 필터
  const editSearchResults = editSearch.trim()
    ? allMembers.filter(m =>
        !editRoster.find(r => r.member_id === m.member_id) &&
        ((m.name || '').toLowerCase().includes(editSearch.toLowerCase()) ||
         (m.display_name || '').toLowerCase().includes(editSearch.toLowerCase()))
      ).slice(0, 8)
    : []

  return (
    <div className="pb-20">
      <PageHeader title="📝 신청확인" subtitle="대회 참가 신청 현황" />

      {/* 탭 */}
      <div className="max-w-lg mx-auto px-5 pt-4">
        <div className="flex gap-1 bg-soft rounded-xl p-1 mb-4">
          <button onClick={() => setTab('all')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${tab === 'all' ? 'bg-white text-accent shadow-sm' : 'text-sub'}`}>
            전체 현황
          </button>
          <button onClick={() => setTab('mine')}
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
              <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
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
                    {selectedEvent.event_date_end ? ` ~ ${selectedEvent.event_date_end}` : ''}
                    {selectedEvent.entry_fee_team > 0 && ` · 💰 ${selectedEvent.entry_fee_team.toLocaleString()}원`}
                    {selectedEvent.status === 'OPEN' ? ' · 🟢 접수중' : ' · 🔴 마감'}
                    {isTeamEvent ? ' · 👥 단체전' : isBothEvent ? ' · 👤+👥' : ' · 👤 개인전'}
                  </p>
                </div>
              )}

              {/* 부서 필터 */}
              {Object.keys(divCounts).length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button onClick={() => setActiveDivision('전체')}
                    className={`px-3 py-2 rounded-lg transition-colors ${activeDivision === '전체' ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                    <p className="text-[10px] opacity-80">전체</p>
                    <p className="text-lg font-bold">{entries.length + teamEntries.length}{isTeamEvent ? '팀' : '팀'}</p>
                  </button>
                  {Object.entries(divCounts).map(([div, count]) => (
                    <button key={div} onClick={() => setActiveDivision(activeDivision === div ? '전체' : div)}
                      className={`px-3 py-2 rounded-lg transition-colors ${activeDivision === div ? 'bg-accent text-white' : 'bg-white border border-line hover:bg-soft'}`}>
                      <p className={`text-[10px] ${activeDivision === div ? 'opacity-80' : 'text-sub'}`}>{div}</p>
                      <p className={`text-lg font-bold ${activeDivision === div ? '' : 'text-gray-800'}`}>{count}팀</p>
                    </button>
                  ))}
                </div>
              )}

              {loading ? (
                <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
              ) : (
                <div className="space-y-4">
                  {/* 단체전 목록 */}
                  {filteredTeamEntries.length > 0 && (
                    <div>
                      {(filteredEntries.length > 0) && (
                        <p className="text-xs font-medium text-sub mb-2">👥 단체전 ({filteredTeamEntries.length}팀)</p>
                      )}
                      <div className="space-y-2">
                        {filteredTeamEntries.map((entry, idx) => {
                          const members = [...(entry.team_event_members || [])].sort((a, b) => a.member_order - b.member_order)
                          return (
                            <div key={entry.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-sub w-6">{idx + 1}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-blue-900">{entry.club_name}</p>
                                    <p className="text-xs text-blue-600">{entry.division_name || '-'}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 items-end shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusStyle(entry.status)}`}>
                                    {getStatusLabel(entry.status)}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getPayStyle(entry.payment_status)}`}>
                                    {entry.payment_status || '미납'}
                                  </span>
                                </div>
                              </div>
                              {members.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {members.map(m => (
                                    <span key={m.member_id || m.id}
                                      className={`text-[10px] px-2 py-0.5 rounded border ${
                                        entry.captain_member_id === m.member_id
                                          ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                                          : 'bg-white border-blue-200 text-blue-700'
                                      }`}>
                                      {entry.captain_member_id === m.member_id ? '★ ' : ''}{m.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 개인전 목록 */}
                  {filteredEntries.length > 0 && (
                    <div>
                      {filteredTeamEntries.length > 0 && (
                        <p className="text-xs font-medium text-sub mb-2">👤 개인전 ({filteredEntries.length}팀)</p>
                      )}
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
                    </div>
                  )}

                  {filteredEntries.length === 0 && filteredTeamEntries.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-sub">신청 내역이 없습니다.</p>
                    </div>
                  )}
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
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">PIN (6자리)</label>
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="PIN 6자리"
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
              <p className="text-xs text-sub mt-1">PIN 초기값은 전화번호 뒷 6자리입니다.</p>
            </div>
            {myError && <p className="text-xs text-red-500">⚠️ {myError}</p>}
            <button onClick={handleMySearch} disabled={myLoading}
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
                  {myEntries.map((e, idx) => (
                    <div key={e.entry_id || idx}
                      className={`border rounded-xl p-4 ${e.entry_type === 'team' ? 'bg-blue-50 border-blue-200' : 'bg-white border-line'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              e.entry_type === 'team' ? 'bg-blue-100 text-blue-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {e.entry_type === 'team' ? '👥 단체전' : '👤 개인전'}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{e.event_name}</p>
                          <p className="text-xs text-sub mt-0.5">
                            📅 {e.event_date}{e.event_date_end ? ` ~ ${e.event_date_end}` : ''}
                          </p>
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

                      {/* 개인전 상세 */}
                      {e.entry_type === 'individual' && (
                        <div className="flex gap-3 text-xs text-sub">
                          {e.division_name && <span>📋 {e.division_name}</span>}
                          {e.partner_name && <span>🤝 파트너: {e.partner_name}</span>}
                        </div>
                      )}

                      {/* 단체전 상세 */}
                      {e.entry_type === 'team' && (
                        <div>
                          <div className="flex gap-3 text-xs text-sub mb-2">
                            {e.division_name && <span>📋 {e.division_name}</span>}
                            <span>🏠 {e.club_name}</span>
                            {e.is_captain && <span className="text-blue-600 font-medium">★ 주장</span>}
                          </div>
                          {/* 선수 명단 */}
                          {e.roster && e.roster.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {[...e.roster].sort((a, b) => a.order - b.order).map(r => (
                                <span key={r.member_id}
                                  className={`text-[10px] px-2 py-0.5 rounded border ${
                                    r.member_id === myMemberId && e.is_captain
                                      ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                                      : 'bg-white border-blue-200 text-blue-700'
                                  }`}>
                                  {r.member_id === myMemberId && e.is_captain ? '★ ' : ''}{r.name}
                                  <span className="text-blue-500 ml-1">{r.grade || ''}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 명단 수정 버튼 - 주장이고 마감 전인 경우 */}
                          {canEditRoster(e) && (
                            <button onClick={() => openEditRoster(e)}
                              className="mt-1 text-xs text-accent border border-accent rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors">
                              ✏️ 선수 명단 수정
                            </button>
                          )}
                        </div>
                      )}

                      <p className="text-[10px] text-gray-400 mt-2">신청일: {formatDate(e.applied_at)}</p>
                      {e.entry_status !== 'cancelled' && e.entry_type === 'individual' && (
                        <p className="text-[10px] text-sub mt-1">취소는 관리자에게 문의하세요.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 명단 수정 모달 ── */}
      {editEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) closeEditRoster() }}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">선수 명단 수정</p>
                <p className="text-xs text-sub mt-0.5">{editEntry.club_name} · {editEntry.division_name || ''}</p>
              </div>
              <button onClick={closeEditRoster} className="text-sub text-xl leading-none">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {/* 현재 명단 */}
              <div>
                <p className="text-xs font-medium text-sub mb-2">현재 명단 ({editRoster.length}명)</p>
                <div className="border border-line rounded-lg overflow-hidden">
                  {editRoster.length === 0 ? (
                    <p className="text-xs text-sub text-center py-4">선수가 없습니다.</p>
                  ) : (
                    editRoster.map((r, i) => (
                      <div key={r.member_id}
                        className="flex items-center justify-between px-3 py-2.5 border-b border-line/30 last:border-b-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-sub w-4">{i + 1}</span>
                          <span className="text-sm font-medium">{r.name}</span>
                          <span className="text-xs text-sub">{r.gender === 'M' ? '남' : r.gender === 'F' ? '여' : ''}</span>
                          <span className="text-xs text-accent">{r.grade || ''}</span>
                        </div>
                        {/* 주장 본인은 삭제 불가 */}
                        {r.member_id !== myMemberId ? (
                          <button onClick={() => handleEditRemove(r.member_id)}
                            className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                        ) : (
                          <span className="text-xs text-blue-500">★ 주장</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 선수 추가 검색 */}
              <div>
                <p className="text-xs font-medium text-sub mb-2">선수 추가</p>
                <div className="relative">
                  <input type="text" value={editSearch}
                    onChange={e => { setEditSearch(e.target.value); setShowEditDrop(true) }}
                    onFocus={() => setShowEditDrop(true)}
                    placeholder="이름으로 검색 (활성 회원)"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  {showEditDrop && editSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                      {editSearchResults.map(m => (
                        <button key={m.member_id} onClick={() => handleEditAdd(m)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                          <span className="font-medium">{m.display_name || m.name}</span>
                          <span className="text-sub text-xs ml-2">{m.club || ''}</span>
                          <span className="text-xs text-accent ml-2">{m.grade || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PIN 확인 */}
              <div>
                <p className="text-xs font-medium text-sub mb-2">주장 PIN 확인</p>
                <input type="password" inputMode="numeric" maxLength={6} value={editPin}
                  onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN 6자리"
                  className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
              </div>

              {editError && <p className="text-xs text-red-500">⚠️ {editError}</p>}

              <div className="flex gap-2">
                <button onClick={closeEditRoster}
                  className="flex-1 py-3 border border-line rounded-xl text-sm text-sub">
                  취소
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-semibold
                    hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {editSaving ? '저장 중...' : '✅ 명단 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
