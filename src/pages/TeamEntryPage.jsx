import { useState, useEffect, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function TeamEntryPage() {
  const showToast = useContext(ToastContext)

  // 대회
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)

  // 대표 인증
  const [captainName, setCaptainName] = useState('')
  const [captainPin, setCaptainPin] = useState('')
  const [captainVerified, setCaptainVerified] = useState(null) // null | { member_id, name, club, ... }
  const [verifying, setVerifying] = useState(false)

  // 클럽
  const [clubName, setClubName] = useState('')

  // 회원 데이터 (active만)
  const [allMembers, setAllMembers] = useState([])

  // 선수 명단
  const [roster, setRoster] = useState([]) // [{ member_id, name, gender, grade }]

  // 선수 추가 모드
  const [addMode, setAddMode] = useState('club') // 'club' | 'search'
  const [selectedClub, setSelectedClub] = useState('')
  const [clubChecked, setClubChecked] = useState({}) // { member_id: true/false }
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showClubPicker, setShowClubPicker] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchEvents(); fetchActiveMembers() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').eq('status', 'OPEN').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchActiveMembers() {
    const { data } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, grade, gender, status')
      .eq('status', '활성').order('name')
    setAllMembers(data || [])
  }

  // 클럽 목록 (중복 제거)
  const clubList = useMemo(() => {
    const clubs = [...new Set(allMembers.map(m => m.club).filter(Boolean))].sort()
    return clubs
  }, [allMembers])

  // 선택된 클럽의 회원들 (이미 명단에 있는 사람 표시)
  const clubMembers = useMemo(() => {
    if (!selectedClub) return []
    return allMembers.filter(m => m.club === selectedClub)
  }, [allMembers, selectedClub])

  // 이름 검색 결과
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    const rosterIds = new Set(roster.map(r => r.member_id))
    return allMembers.filter(m =>
      !rosterIds.has(m.member_id) &&
      ((m.name || '').toLowerCase().includes(q) || (m.display_name || '').toLowerCase().includes(q))
    ).slice(0, 10)
  }, [allMembers, searchQuery, roster])

  // 인원 제한
  const memberLimit = selectedEvent?.team_member_limit || null

  function handleEventChange(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    setSelectedEvent(ev || null)
  }

  async function handleVerifyCaptain() {
    if (!captainName.trim() || captainPin.length !== 6) {
      showToast?.('이름과 PIN 6자리를 입력해주세요.', 'error'); return
    }
    setVerifying(true)
    const { data, error } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: captainName.trim(), p_pin: captainPin,
    })
    if (error) { showToast?.('확인 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      setCaptainVerified(data)
      setClubName(data.club || '')
      showToast?.('✅ 본인 확인 완료')
    }
    setVerifying(false)
  }

  function handleClubSelect(club) {
    setSelectedClub(club)
    // 체크 초기화: 이미 명단에 있는 사람은 체크
    const rosterIds = new Set(roster.map(r => r.member_id))
    const initial = {}
    allMembers.filter(m => m.club === club).forEach(m => {
      initial[m.member_id] = rosterIds.has(m.member_id)
    })
    setClubChecked(initial)
    setShowClubPicker(false)
  }

  function handleToggleMember(memberId) {
    setClubChecked(prev => ({ ...prev, [memberId]: !prev[memberId] }))
  }

  function handleSelectAll() {
    const rosterIds = new Set(roster.map(r => r.member_id))
    const newChecked = {}
    clubMembers.forEach(m => { newChecked[m.member_id] = true })
    // 인원 제한 체크
    const wouldAdd = clubMembers.filter(m => !rosterIds.has(m.member_id)).length
    if (memberLimit && (roster.length + wouldAdd) > memberLimit) {
      showToast?.(`인원 제한(${memberLimit}명)을 초과합니다.`, 'error'); return
    }
    setClubChecked(newChecked)
  }

  function handleDeselectAll() {
    const rosterIds = new Set(roster.map(r => r.member_id))
    const newChecked = {}
    clubMembers.forEach(m => { newChecked[m.member_id] = rosterIds.has(m.member_id) })
    setClubChecked(newChecked)
  }

  function handleAddFromClub() {
    const rosterIds = new Set(roster.map(r => r.member_id))
    const toAdd = clubMembers.filter(m => clubChecked[m.member_id] && !rosterIds.has(m.member_id))

    if (memberLimit && (roster.length + toAdd.length) > memberLimit) {
      showToast?.(`인원 제한(${memberLimit}명)을 초과합니다.`, 'error'); return
    }

    const newMembers = toAdd.map(m => ({
      member_id: m.member_id, name: m.display_name || m.name,
      gender: m.gender || '', grade: m.grade || '',
    }))
    setRoster(prev => [...prev, ...newMembers])
    setSelectedClub(''); setClubChecked({})
    if (newMembers.length > 0) showToast?.(`${newMembers.length}명 추가됨`)
  }

  function handleAddFromSearch(m) {
    const rosterIds = new Set(roster.map(r => r.member_id))
    if (rosterIds.has(m.member_id)) { showToast?.('이미 명단에 있습니다.', 'error'); return }
    if (memberLimit && roster.length >= memberLimit) { showToast?.(`인원 제한(${memberLimit}명)입니다.`, 'error'); return }
    setRoster(prev => [...prev, {
      member_id: m.member_id, name: m.display_name || m.name,
      gender: m.gender || '', grade: m.grade || '',
    }])
    setSearchQuery(''); setShowSearchDropdown(false)
  }

  function handleRemoveFromRoster(memberId) {
    setRoster(prev => prev.filter(r => r.member_id !== memberId))
  }

  async function handleSubmit() {
    if (!selectedEvent) { showToast?.('대회를 선택해주세요.', 'error'); return }
    if (!captainVerified) { showToast?.('대표자 본인확인을 해주세요.', 'error'); return }
    if (!clubName.trim()) { showToast?.('클럽명을 입력해주세요.', 'error'); return }
    if (roster.length === 0) { showToast?.('선수를 1명 이상 추가해주세요.', 'error'); return }

    setSubmitting(true)
    const membersPayload = roster.map((r, i) => ({
      member_id: r.member_id, name: r.name, gender: r.gender, grade: r.grade, order: i + 1,
    }))

    const { data, error } = await supabase.rpc('rpc_submit_team_entry', {
      p_event_id: selectedEvent.event_id,
      p_captain_name: captainName.trim(), p_captain_pin: captainPin,
      p_club_name: clubName.trim(), p_members: membersPayload,
    })
    if (error) { showToast?.('신청 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      showToast?.('🎉 단체전 참가 신청 완료!')
      setRoster([]); setClubName(''); setCaptainVerified(null); setCaptainName(''); setCaptainPin('')
    }
    setSubmitting(false)
  }

  const checkedNewCount = selectedClub
    ? clubMembers.filter(m => clubChecked[m.member_id] && !roster.find(r => r.member_id === m.member_id)).length
    : 0

  return (
    <div className="pb-20">
      <PageHeader title="🏟️ 단체전 참가신청" subtitle="클럽 단위 단체전 참가 신청" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">

        {/* 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">🏟️ 클럽 대표(주장)가 신청합니다.</p>
          <p className="text-xs text-amber-700 mt-0.5">👥 <b>동호인등록(활성) 회원만</b> 선수로 등록 가능합니다.</p>
        </div>

        {/* 대회 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">대회 선택</label>
          <select value={selectedEvent?.event_id || ''} onChange={e => handleEventChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
            <option value="">대회를 선택하세요</option>
            {events.map(ev => (
              <option key={ev.event_id} value={ev.event_id}>{ev.event_name} ({ev.event_date})</option>
            ))}
          </select>
          {selectedEvent && memberLimit && (
            <p className="text-xs text-accent mt-1">👥 클럽당 인원 제한: {memberLimit}명</p>
          )}
        </div>

        {/* 대표자 본인확인 */}
        {selectedEvent && (
          <div className="bg-soft rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">대표(주장) 본인확인</p>
            <div className="flex gap-2">
              <input type="text" value={captainName} onChange={e => { setCaptainName(e.target.value); setCaptainVerified(null) }}
                placeholder="이름" className="flex-1 text-sm border border-line rounded-lg px-3 py-2" />
              <input type="password" inputMode="numeric" maxLength={6} value={captainPin}
                onChange={e => { setCaptainPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setCaptainVerified(null) }}
                placeholder="PIN 6자리" className="w-28 text-sm border border-line rounded-lg px-3 py-2 tracking-widest" />
              <button onClick={handleVerifyCaptain} disabled={verifying || !captainName.trim() || captainPin.length !== 6}
                className="px-3 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50 whitespace-nowrap">
                {verifying ? '...' : '확인'}
              </button>
            </div>
            {captainVerified && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                ✅ {captainVerified.name} ({captainVerified.club || '-'}) · {captainVerified.grade || '-'}
              </div>
            )}
          </div>
        )}

        {/* 클럽명 */}
        {captainVerified && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">클럽명</label>
            <input type="text" value={clubName} onChange={e => setClubName(e.target.value)}
              placeholder="클럽명을 입력하세요"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
          </div>
        )}

        {/* 선수 추가 */}
        {captainVerified && clubName.trim() && (
          <>
            <div className="flex border border-line rounded-lg overflow-hidden">
              <button onClick={() => setAddMode('club')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === 'club' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
                🏢 클럽별 선택
              </button>
              <button onClick={() => setAddMode('search')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === 'search' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
                🔍 이름 검색
              </button>
            </div>

            {/* 클럽별 멀티셀렉트 */}
            {addMode === 'club' && (
              <div className="space-y-2">
                <div className="relative">
                  <button onClick={() => setShowClubPicker(!showClubPicker)}
                    className="w-full text-left text-sm border border-line rounded-lg px-3 py-2.5 bg-white">
                    {selectedClub || '클럽을 선택하세요 ▼'}
                  </button>
                  {showClubPicker && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                      {clubList.map(club => (
                        <button key={club} onClick={() => handleClubSelect(club)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                          {club}
                        </button>
                      ))}
                      {clubList.length === 0 && <p className="px-4 py-3 text-xs text-sub">클럽이 없습니다.</p>}
                    </div>
                  )}
                </div>

                {selectedClub && (
                  <div className="border border-line rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-3 py-2 bg-soft border-b border-line">
                      <span className="text-xs font-medium text-gray-700">{selectedClub} ({clubMembers.length}명)</span>
                      <div className="flex gap-2">
                        <button onClick={handleSelectAll} className="text-xs text-accent">전체 선택</button>
                        <button onClick={handleDeselectAll} className="text-xs text-sub">선택 해제</button>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {clubMembers.map(m => {
                        const inRoster = roster.find(r => r.member_id === m.member_id)
                        return (
                          <label key={m.member_id}
                            className={`flex items-center px-3 py-2.5 border-b border-line/30 cursor-pointer hover:bg-soft ${inRoster ? 'bg-blue-50' : ''}`}>
                            <input type="checkbox" checked={!!clubChecked[m.member_id]}
                              onChange={() => handleToggleMember(m.member_id)}
                              disabled={!!inRoster}
                              className="mr-3 w-4 h-4 rounded" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{m.display_name || m.name}</span>
                              <span className="text-xs text-sub ml-2">{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : ''}</span>
                              <span className="text-xs text-accent ml-2">{m.grade || ''}</span>
                            </div>
                            {inRoster && <span className="text-xs text-blue-500">등록됨</span>}
                          </label>
                        )
                      })}
                    </div>
                    {checkedNewCount > 0 && (
                      <div className="px-3 py-2 bg-soft border-t border-line flex justify-between items-center">
                        <span className="text-xs text-gray-700">새로 추가: {checkedNewCount}명</span>
                        <button onClick={handleAddFromClub}
                          className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg">
                          선택 완료 → 명단 추가
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 이름 검색 */}
            {addMode === 'search' && (
              <div className="relative">
                <input type="text" value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowSearchDropdown(true) }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="이름으로 검색 (활성 회원만)"
                  className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                    {searchResults.map(m => (
                      <button key={m.member_id} onClick={() => handleAddFromSearch(m)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                        <span className="font-medium">{m.display_name || m.name}</span>
                        <span className="text-sub text-xs ml-2">{m.club || ''}</span>
                        <span className="text-xs text-accent ml-2">{m.grade || ''}</span>
                        <span className="text-xs text-sub ml-1">({m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : ''})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 선수 명단 */}
        {roster.length > 0 && (
          <div className="border border-line rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-soft border-b border-line flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">
                선수 명단: {roster.length}명
                {memberLimit && <span className="text-accent ml-1">/ 제한 {memberLimit}명</span>}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-sub">
                  <th className="text-left px-3 py-2 w-8">#</th>
                  <th className="text-left px-3 py-2">이름</th>
                  <th className="text-left px-3 py-2 w-12">성별</th>
                  <th className="text-left px-3 py-2 w-16">등급</th>
                  <th className="text-center px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r, i) => (
                  <tr key={r.member_id} className="border-t border-line/30">
                    <td className="px-3 py-2 text-xs text-sub">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-xs">{r.gender === 'M' ? '남' : r.gender === 'F' ? '여' : '-'}</td>
                    <td className="px-3 py-2 text-xs text-accent">{r.grade || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleRemoveFromRoster(r.member_id)}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 신청 버튼 */}
        {captainVerified && clubName.trim() && (
          <button onClick={handleSubmit}
            disabled={submitting || roster.length === 0}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
              hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '신청 중...' : `🏟️ 단체전 참가 신청 (${roster.length}명)`}
          </button>
        )}
      </div>
    </div>
  )
}
