import { useState, useEffect, useContext, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

// 기존 신청 수에 따라 팀 suffix 반환: 0→'', 1→' B', 2→' C' ...
function getTeamSuffix(count) {
  if (count === 0) return ''
  return ' ' + String.fromCharCode(65 + count) // 1→B, 2→C, 3→D
}

export default function TeamEntryPage() {
  const showToast = useContext(ToastContext)

  const [events, setEvents]                     = useState([])
  const [selectedEvent, setSelectedEvent]       = useState(null)
  const [divisions, setDivisions]               = useState([])
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [captainName, setCaptainName]           = useState('')
  const [captainPin, setCaptainPin]             = useState('')
  const [captainVerified, setCaptainVerified]   = useState(null)
  const [verifying, setVerifying]               = useState(false)
  const [clubBase, setClubBase]                 = useState('')   // 순수 클럽명
  const [teamSuffix, setTeamSuffix]             = useState('')   // 자동 suffix (B, C...)
  const [existingCount, setExistingCount]       = useState(0)   // 같은 클럽 기존 신청 수
  const [checkingClub, setCheckingClub]         = useState(false)
  const [allMembers, setAllMembers]             = useState([])
  const [roster, setRoster]                     = useState([])
  const [addMode, setAddMode]                   = useState('club')
  const [selectedClub, setSelectedClub]         = useState('')
  const [clubChecked, setClubChecked]           = useState({})
  const [searchQuery, setSearchQuery]           = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showClubPicker, setShowClubPicker]     = useState(false)
  const [submitting, setSubmitting]             = useState(false)

  // 신청 완료 확인 화면
  const [submitted, setSubmitted]               = useState(false)
  const [submittedInfo, setSubmittedInfo]       = useState(null)

  useEffect(() => { fetchEvents(); fetchActiveMembers() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*').eq('status', 'OPEN')
      .in('event_type', ['team', 'both'])
      .order('event_date', { ascending: true })
    setEvents(data || [])
  }

  async function fetchActiveMembers() {
    const { data } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, grade, gender, status')
      .eq('status', '활성').order('name')
    setAllMembers(data || [])
  }

  const clubList = useMemo(() => {
    return [...new Set(allMembers.map(m => m.club).filter(Boolean))].sort()
  }, [allMembers])

  const clubMembers = useMemo(() => {
    if (!selectedClub) return []
    return allMembers.filter(m => m.club === selectedClub)
  }, [allMembers, selectedClub])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    const rosterIds = new Set(roster.map(r => r.member_id))
    return allMembers.filter(m =>
      !rosterIds.has(m.member_id) &&
      ((m.name || '').toLowerCase().includes(q) || (m.display_name || '').toLowerCase().includes(q))
    ).slice(0, 10)
  }, [allMembers, searchQuery, roster])

  const memberLimit = selectedEvent?.team_member_limit || null
  const finalClubName = clubBase.trim() + teamSuffix

  function getEntryAvailability(ev) {
    if (!ev) return { ok: false, message: '' }
    const now = new Date()
    if (ev.entry_open_at && new Date(ev.entry_open_at) > now) {
      const d = new Date(ev.entry_open_at)
      const msg = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 부터 신청 가능합니다.`
      return { ok: false, message: msg, type: 'notYet' }
    }
    if (ev.entry_close_at && new Date(ev.entry_close_at) < now) {
      return { ok: false, message: '참가신청 마감된 대회입니다.', type: 'closed' }
    }
    return { ok: true, message: '' }
  }

  function handleEventChange(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    setSelectedEvent(ev || null)
    setSelectedDivision(null); setDivisions([])
    setCaptainVerified(null); setCaptainName(''); setCaptainPin('')
    setRoster([]); setClubBase(''); setTeamSuffix(''); setExistingCount(0)
    setSelectedClub(''); setClubChecked({})
    if (ev) fetchDivisions(ev.event_id)
  }

  async function fetchDivisions(eventId) {
    const { data } = await supabase.from('event_divisions')
      .select('division_id, division_name').eq('event_id', eventId).order('created_at')
    setDivisions(data || [])
  }

  // 같은 대회+부서에서 해당 클럽 기존 신청 수 조회
  async function checkExistingClubEntries(base, divisionId) {
    if (!selectedEvent || !base.trim()) { setExistingCount(0); setTeamSuffix(''); return }
    setCheckingClub(true)
    let query = supabase.from('team_event_entries')
      .select('id, club_name')
      .eq('event_id', selectedEvent.event_id)
      .neq('status', 'cancelled')
    if (divisionId) query = query.eq('division_id', divisionId)

    const { data } = await query
    // base와 같거나 base + ' X' 패턴인 것만 카운트
    const regex = new RegExp(`^${base.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( [B-Z])?$`)
    const count = (data || []).filter(e => regex.test((e.club_name || '').trim())).length
    setExistingCount(count)
    setTeamSuffix(getTeamSuffix(count))
    setCheckingClub(false)
  }

  async function handleDivisionChange(divId) {
    const div = divisions.find(d => d.division_id === divId)
    setSelectedDivision(div || null)
    if (captainVerified && clubBase) {
      await checkExistingClubEntries(clubBase, divId || null)
    }
  }

  async function handleVerifyCaptain() {
    if (!captainName.trim() || captainPin.length !== 6) {
      showToast?.('이름과 PIN 6자리를 입력해주세요.', 'error'); return
    }
    setVerifying(true)
    const { data, error } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: captainName.trim(), p_pin: captainPin,
    })
    if (error) { showToast?.('인증 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      setCaptainVerified(data)
      const base = data.club || ''
      setClubBase(base)
      await checkExistingClubEntries(base, selectedDivision?.division_id || null)
      showToast?.('✅ 본인 인증 완료')
    }
    setVerifying(false)
  }

  function handleClubSelect(club) {
    setSelectedClub(club)
    const rosterIds = new Set(roster.map(r => r.member_id))
    const initial = {}
    allMembers.filter(m => m.club === club).forEach(m => {
      initial[m.member_id] = rosterIds.has(m.member_id)
    })
    setClubChecked(initial); setShowClubPicker(false)
  }

  function handleToggleMember(memberId) {
    setClubChecked(prev => ({ ...prev, [memberId]: !prev[memberId] }))
  }

  function handleSelectAll() {
    const rosterIds = new Set(roster.map(r => r.member_id))
    const newChecked = {}
    clubMembers.forEach(m => { newChecked[m.member_id] = true })
    const wouldAdd = clubMembers.filter(m => !rosterIds.has(m.member_id)).length
    if (memberLimit && (roster.length + wouldAdd) > memberLimit) {
      showToast?.(`인원 한도(${memberLimit}명)를 초과합니다.`, 'error'); return
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
      showToast?.(`인원 한도(${memberLimit}명)를 초과합니다.`, 'error'); return
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
    if (memberLimit && roster.length >= memberLimit) { showToast?.(`인원 한도(${memberLimit}명)입니다.`, 'error'); return }
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
    if (divisions.length > 0 && !selectedDivision) { showToast?.('부서를 선택해주세요.', 'error'); return }
    if (!captainVerified) { showToast?.('주장 본인인증을 해주세요.', 'error'); return }
    if (!finalClubName.trim()) { showToast?.('클럽명을 입력해주세요.', 'error'); return }
    if (roster.length === 0) { showToast?.('선수를 1명 이상 추가해주세요.', 'error'); return }
    const avail = getEntryAvailability(selectedEvent)
    if (!avail.ok) { showToast?.('⚠️ ' + avail.message, 'error'); return }

    setSubmitting(true)
    const membersPayload = roster.map((r, i) => ({
      member_id: r.member_id, name: r.name, gender: r.gender, grade: r.grade, order: i + 1,
    }))

    const { data, error } = await supabase.rpc('rpc_submit_team_entry', {
      p_event_id:      selectedEvent.event_id,
      p_captain_name:  captainName.trim(),
      p_captain_pin:   captainPin,
      p_club_name:     finalClubName.trim(),
      p_members:       membersPayload,
      p_division_id:   selectedDivision?.division_id ?? null,
      p_division_name: selectedDivision?.division_name ?? null,
    })

    if (error) {
      showToast?.('신청 실패: ' + error.message, 'error')
    } else if (data && !data.ok) {
      showToast?.('⚠️ ' + (data.message || '신청할 수 없습니다.'), 'error')
    } else if (data && data.ok) {
      const now = new Date()
      setSubmittedInfo({
        eventName:     selectedEvent.event_name,
        eventDate:     selectedEvent.event_date,
        eventDateEnd:  selectedEvent.event_date_end,
        divisionName:  selectedDivision?.division_name ?? null,
        clubName:      finalClubName.trim(),
        clubBase:      clubBase.trim(),
        isMultiTeam:   existingCount > 0,
        captainName:   captainName.trim(),
        roster:        [...roster],
        accountBank:   selectedEvent.account_bank,
        accountNumber: selectedEvent.account_number,
        accountHolder: selectedEvent.account_holder,
        entryFee:      selectedEvent.entry_fee_team,
        applyTime:     `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      })
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  function handleReset() {
    setSubmitted(false); setSubmittedInfo(null)
    setSelectedEvent(null); setSelectedDivision(null); setDivisions([])
    setCaptainVerified(null); setCaptainName(''); setCaptainPin('')
    setRoster([]); setClubBase(''); setTeamSuffix(''); setExistingCount(0)
    setSelectedClub(''); setClubChecked({})
  }

  const checkedNewCount = selectedClub
    ? clubMembers.filter(m => clubChecked[m.member_id] && !roster.find(r => r.member_id === m.member_id)).length
    : 0

  const entryAvail = getEntryAvailability(selectedEvent)

  // ── 신청 완료 확인 화면 ──
  if (submitted && submittedInfo) {
    return (
      <div className="pb-20">
        <PageHeader title="👥 팀전 참가신청" subtitle="클럽 단위 팀전 참가 신청" />
        <div className="max-w-lg mx-auto px-5 py-4 space-y-4">

          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3 text-2xl">✓</div>
            <p className="text-lg font-semibold text-gray-900">신청이 완료되었습니다!</p>
            <p className="text-sm text-sub mt-1">아래 내용을 확인해 주세요</p>
          </div>

          {submittedInfo.isMultiTeam && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-700">
              같은 부서에 <b>{submittedInfo.clubBase}</b>이 이미 신청되어 있어<br />
              팀명이 <b>{submittedInfo.clubName}</b>으로 자동 지정되었습니다.
            </div>
          )}

          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-soft px-4 py-2.5 text-xs font-medium text-sub border-b border-line">신청 정보</div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-sub">대회</span>
                <span className="text-sm font-medium text-right">{submittedInfo.eventName}</span>
              </div>
              {submittedInfo.divisionName && (
                <div className="flex justify-between">
                  <span className="text-xs text-sub">부서</span>
                  <span className="text-sm font-medium">{submittedInfo.divisionName}</span>
                </div>
              )}
              <div className="border-t border-line/50 pt-2.5 flex justify-between">
                <span className="text-xs text-sub">클럽명</span>
                <span className="text-sm font-semibold text-accent">{submittedInfo.clubName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-sub">주장</span>
                <span className="text-sm font-medium">{submittedInfo.captainName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-sub">신청일시</span>
                <span className="text-xs text-sub">{submittedInfo.applyTime}</span>
              </div>
            </div>
          </div>

          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-soft px-4 py-2.5 text-xs font-medium text-sub border-b border-line">
              선수 명단 ({submittedInfo.roster.length}명)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-sub border-b border-line">
                  <th className="text-left px-3 py-2 w-8">#</th>
                  <th className="text-left px-3 py-2">이름</th>
                  <th className="text-left px-3 py-2 w-12">성별</th>
                  <th className="text-left px-3 py-2 w-16">등급</th>
                </tr>
              </thead>
              <tbody>
                {submittedInfo.roster.map((r, i) => (
                  <tr key={r.member_id} className="border-t border-line/30">
                    <td className="px-3 py-2 text-xs text-sub">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {r.name}
                      {r.name === submittedInfo.captainName && (
                        <span className="ml-1 text-[10px] text-blue-500">★</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-sub">{r.gender === 'M' ? '남' : r.gender === 'F' ? '여' : '-'}</td>
                    <td className="px-3 py-2 text-xs text-accent">{r.grade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {submittedInfo.accountNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-medium text-blue-800">💳 입금 계좌</p>
              <p className="text-sm font-bold text-blue-900">
                {submittedInfo.accountBank && `${submittedInfo.accountBank} `}{submittedInfo.accountNumber}
              </p>
              {submittedInfo.accountHolder && (
                <p className="text-xs text-blue-600">예금주: {submittedInfo.accountHolder}</p>
              )}
              {submittedInfo.entryFee > 0 && (
                <p className="text-sm font-semibold text-blue-800 pt-1.5 border-t border-blue-200">
                  참가비 {submittedInfo.entryFee.toLocaleString()}원 입금 후 확정됩니다
                </p>
              )}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
            입금자명은 <b>클럽명({submittedInfo.clubName})</b>으로 해주세요.<br />
            입금 확인 후 관리자가 확정합니다.
          </div>

          <button onClick={handleReset}
            className="w-full py-3 border border-line rounded-xl text-sm text-sub hover:bg-soft transition-colors">
            다른 팀 추가 신청하기
          </button>
        </div>
      </div>
    )
  }

  // ── 신청 폼 ──
  return (
    <div className="pb-20">
      <PageHeader title="👥 팀전 참가신청" subtitle="클럽 단위 팀전 참가 신청" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">👥 클럽 대표(주장)가 신청합니다.</p>
          <p className="text-xs text-amber-700 mt-0.5">🏆 <b>활성 회원만</b> 선수로 등록 가능합니다.</p>
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
          {events.length === 0 && (
            <p className="text-xs text-sub mt-1">현재 신청 가능한 팀전 대회가 없습니다.</p>
          )}
        </div>

        {/* 대회 정보 */}
        {selectedEvent && (
          <div className={`rounded-lg p-3 ${entryAvail.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm font-semibold text-gray-800">{selectedEvent.event_name}</p>
            <p className="text-xs text-sub mt-1">
              📅 {selectedEvent.event_date}{selectedEvent.event_date_end ? ` ~ ${selectedEvent.event_date_end}` : ''}
              {selectedEvent.entry_fee_team > 0 && ` · 💰 ${selectedEvent.entry_fee_team.toLocaleString()}원`}
            </p>
            {selectedEvent.account_number && (
              <div className="mt-2 bg-white rounded-lg px-3 py-2 border border-green-200">
                <p className="text-xs font-medium text-gray-700 mb-0.5">💳 입금 계좌</p>
                <p className="text-sm font-bold text-gray-900">
                  {selectedEvent.account_bank && `${selectedEvent.account_bank} `}{selectedEvent.account_number}
                </p>
                {selectedEvent.account_holder && (
                  <p className="text-xs text-gray-500 mt-0.5">예금주: {selectedEvent.account_holder}</p>
                )}
              </div>
            )}
            {!entryAvail.ok ? (
              <p className={`text-xs mt-2 font-medium ${entryAvail.type === 'notYet' ? 'text-amber-600' : 'text-red-600'}`}>
                {entryAvail.type === 'notYet' ? '⏳' : '🔒'} {entryAvail.message}
              </p>
            ) : (
              <p className="text-xs text-green-600 mt-2 font-medium">✅ 지금 신청 가능합니다.</p>
            )}
          </div>
        )}

        {selectedEvent && entryAvail.ok && (
          <>
            {/* 부서 선택 */}
            {divisions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부서 선택</label>
                <select value={selectedDivision?.division_id || ''}
                  onChange={e => handleDivisionChange(e.target.value)}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
                  <option value="">부서를 선택하세요</option>
                  {divisions.map(d => (
                    <option key={d.division_id} value={d.division_id}>{d.division_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 주장 인증 */}
            {(divisions.length === 0 || selectedDivision) && (
              <div className="bg-soft rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700">대표(주장) 본인인증</p>
                <p className="text-xs text-sub">🔐 PIN 초기값은 전화번호 뒷 6자리입니다.</p>
                <div className="flex gap-2">
                  <input type="text" value={captainName}
                    onChange={e => { setCaptainName(e.target.value); setCaptainVerified(null); setClubBase(''); setTeamSuffix('') }}
                    placeholder="이름" className="flex-1 text-sm border border-line rounded-lg px-3 py-2" />
                  <input type="password" inputMode="numeric" maxLength={6} value={captainPin}
                    onChange={e => { setCaptainPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setCaptainVerified(null) }}
                    placeholder="PIN 6자리" className="w-28 text-sm border border-line rounded-lg px-3 py-2 tracking-widest" />
                  <button onClick={handleVerifyCaptain}
                    disabled={verifying || !captainName.trim() || captainPin.length !== 6}
                    className="px-3 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50 whitespace-nowrap">
                    {verifying ? '...' : '인증'}
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
                {checkingClub ? (
                  <p className="text-xs text-sub px-1 py-2">확인 중...</p>
                ) : (
                  <>
                    <div className="flex gap-2 items-center">
                      <input type="text" value={clubBase}
                        onChange={async e => {
                          setClubBase(e.target.value)
                          await checkExistingClubEntries(e.target.value, selectedDivision?.division_id || null)
                        }}
                        placeholder="클럽명을 입력하세요"
                        className="flex-1 text-sm border border-line rounded-lg px-3 py-2.5" />
                      {teamSuffix && (
                        <div className="bg-blue-100 border border-blue-300 rounded-lg px-3 py-2.5 text-sm font-bold text-blue-800 shrink-0">
                          {teamSuffix.trim()}팀
                        </div>
                      )}
                    </div>
                    {teamSuffix ? (
                      <p className="text-xs text-blue-600 mt-1">
                        같은 부서에 <b>{clubBase}</b>이 이미 신청되어 <b>{finalClubName}</b>으로 등록됩니다.
                      </p>
                    ) : clubBase.trim() ? (
                      <p className="text-xs text-sub mt-1">등록 클럽명: <b>{finalClubName}</b></p>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {/* 선수 명단 구성 */}
            {captainVerified && finalClubName.trim() && (
              <>
                <div className="flex border border-line rounded-lg overflow-hidden">
                  <button onClick={() => setAddMode('club')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === 'club' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
                    🏠 클럽별 선택
                  </button>
                  <button onClick={() => setAddMode('search')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${addMode === 'search' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
                    🔍 이름 검색
                  </button>
                </div>

                {addMode === 'club' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <button onClick={() => setShowClubPicker(!showClubPicker)}
                        className="w-full text-left text-sm border border-line rounded-lg px-3 py-2.5 bg-white">
                        {selectedClub || '클럽을 선택하세요'}
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
                                  disabled={!!inRoster} className="mr-3 w-4 h-4 rounded" />
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

                {addMode === 'search' && (
                  <div className="relative">
                    <input type="text" value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setShowSearchDropdown(true) }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder="이름으로 검색 (활성 회원)"
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

            {/* 선수 명단 테이블 */}
            {roster.length > 0 && (
              <div className="border border-line rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-soft border-b border-line flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-700">
                    선수 명단: {roster.length}명
                    {memberLimit && <span className="text-accent ml-1">/ 한도 {memberLimit}명</span>}
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
            {captainVerified && finalClubName.trim() && (
              <button onClick={handleSubmit}
                disabled={submitting || roster.length === 0}
                className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
                  hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '신청 중..' : `🎾 팀전 참가 신청 (${roster.length}명)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
