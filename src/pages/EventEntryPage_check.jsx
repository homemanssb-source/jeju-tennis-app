// src/pages/EventEntryPage.jsx
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function EventEntryPage() {
  const showToast = useContext(ToastContext)
  const [events, setEvents]               = useState([])
  const [divisions, setDivisions]         = useState([])
  const [members, setMembers]             = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedDivision, setSelectedDivision] = useState('')
  const [member1Search, setMember1Search] = useState('')
  const [member2Search, setMember2Search] = useState('')
  const [member1Id, setMember1Id]         = useState('')
  const [member2Id, setMember2Id]         = useState('')
  const [member1Pin, setMember1Pin]       = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [showDropdown1, setShowDropdown1] = useState(false)
  const [showDropdown2, setShowDropdown2] = useState(false)

  useEffect(() => { fetchEvents(); fetchMembers() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events')
      .select('*')
      .eq('status', 'OPEN')
      .in('event_type', ['individual', 'both'])
      .order('event_date', { ascending: true })
    setEvents(data || [])
  }

  async function fetchMembers() {
    const { data } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '탈퇴').order('name')
    setMembers(data || [])
  }

  async function fetchDivisions(eventId) {
    const { data } = await supabase.from('event_divisions')
      .select('*').eq('event_id', eventId).order('division_name')
    setDivisions(data || [])
  }

  function handleEventChange(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    setSelectedEvent(ev || null)
    setSelectedDivision('')
    if (eventId) fetchDivisions(eventId); else setDivisions([])
  }

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

  function filterMembers(query) {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.display_name || '').toLowerCase().includes(q) ||
      (m.member_id || '').toLowerCase().includes(q)
    ).slice(0, 8)
  }

  function getMemberInfo(memberId) {
    const m = members.find(m => m.member_id === memberId)
    if (!m) return null
    return { ...m, isActive: m.status === '활성' }
  }

  async function handleSubmit() {
    if (!selectedEvent || !selectedDivision || !member1Id || !member2Id) {
      showToast?.('대회, 부서, 선수 2명을 모두 선택해주세요.', 'error'); return
    }
    if (!member1Pin || member1Pin.length !== 6) {
      showToast?.('PIN 6자리를 입력해주세요.', 'error'); return
    }
    // 같은 선수 선택 방지
    if (member1Id === member2Id) {
      showToast?.('선수 1과 선수 2가 같습니다. 다른 선수를 선택해주세요.', 'error'); return
    }

    const avail = getEntryAvailability(selectedEvent)
    if (!avail.ok) {
      showToast?.('⚠️ ' + avail.message, 'error'); return
    }

    setSubmitting(true)

    // 1단계: PIN 인증
    const { data: pinData, error: pinError } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: members.find(m => m.member_id === member1Id)?.name || '',
      p_pin: member1Pin,
    })
    if (pinError) { showToast?.('PIN 인증 실패: ' + pinError.message, 'error'); setSubmitting(false); return }
    if (pinData && !pinData.ok) { showToast?.('⚠️ ' + pinData.message, 'error'); setSubmitting(false); return }
    if (pinData && pinData.ok && pinData.member_id !== member1Id) {
      showToast?.('⚠️ PIN과 선택한 선수가 일치하지 않습니다.', 'error'); setSubmitting(false); return
    }

    // 2단계: RPC 호출 (중복 체크 포함)
    const { data, error } = await supabase.rpc('rpc_apply_team_to_event', {
      p_event_id: selectedEvent.event_id,
      p_division_id: selectedDivision,
      p_member1_id: member1Id,
      p_member2_id: member2Id,
    })
    if (error) {
      showToast?.('신청 실패: ' + error.message, 'error')
    } else if (data && !data.ok) {
      showToast?.('⚠️ ' + (data.message || '신청할 수 없습니다.'), 'error')
    } else if (data && data.ok) {
      showToast?.('🎾 참가 신청 완료!')
      setMember1Id(''); setMember2Id('')
      setMember1Search(''); setMember2Search('')
      setMember1Pin('')
    }
    setSubmitting(false)
  }

  const member1Info = getMemberInfo(member1Id)
  const member2Info = getMemberInfo(member2Id)
  const entryAvail  = getEntryAvailability(selectedEvent)

  return (
    <div className="pb-20">
      <PageHeader title="🎾 개인전 참가" subtitle="복식 페어 참가 신청" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">⚠️ 선수 2명 모두 <b>등록되고 활성(활성 회원)</b>이어야 참가 신청이 가능합니다.</p>
          <p className="text-xs text-amber-700 mt-1">※ 신청자(선수1)의 <b>PIN 6자리</b>를 입력해야 합니다.</p>
        </div>

        {/* 대회 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">대회 선택</label>
          <select value={selectedEvent?.event_id || ''} onChange={e => handleEventChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
            <option value="">대회를 선택하세요</option>
            {events.map(ev => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.event_name} ({ev.event_date}){ev.entry_fee_team ? ` - ${ev.entry_fee_team.toLocaleString()}원` : ''}
              </option>
            ))}
          </select>
          {events.length === 0 && <p className="text-xs text-sub mt-1">현재 신청 가능한 대회가 없습니다.</p>}
        </div>

        {/* 대회 정보 + 신청 가능 여부 */}
        {selectedEvent && (
          <div className={`rounded-lg p-3 ${entryAvail.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm font-semibold text-gray-800">{selectedEvent.event_name}</p>
            <p className="text-xs text-sub mt-1">📅 {selectedEvent.event_date}
              {selectedEvent.entry_fee_team > 0 && ` · 💰 ${selectedEvent.entry_fee_team.toLocaleString()}원`}
            </p>
            {selectedEvent.account_number && (
              <div className="mt-2 bg-white rounded-lg px-3 py-2 border border-green-200">
                <p className="text-xs font-medium text-gray-700 mb-0.5">💳 입금 계좌</p>
                <p className="text-sm font-bold text-gray-900">
                  {selectedEvent.account_bank && `${selectedEvent.account_bank} `}
                  {selectedEvent.account_number}
                </p>
                {selectedEvent.account_holder && (
                  <p className="text-xs text-gray-500 mt-0.5">예금주: {selectedEvent.account_holder}</p>
                )}
              </div>
            )}
            {!entryAvail.ok ? (
              <p className={`text-xs mt-1 font-medium ${entryAvail.type === 'notYet' ? 'text-amber-600' : 'text-red-600'}`}>
                {entryAvail.type === 'notYet' ? '⏰' : '🔒'} {entryAvail.message}
              </p>
            ) : (
              <p className="text-xs text-green-600 mt-1 font-medium">✅ 지금 신청 가능합니다.</p>
            )}
          </div>
        )}

        {/* 신청 가능한 경우에만 폼 표시 */}
        {selectedEvent && entryAvail.ok && (
          <>
            {/* 부서 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서 선택</label>
              <select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
                <option value="">부서를 선택하세요</option>
                {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.division_name}</option>)}
              </select>
            </div>

            {selectedDivision && (
              <>
                {/* 선수 1 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">선수 1 (신청자)</label>
                  <input type="text" value={member1Search}
                    onChange={e => { setMember1Search(e.target.value); setMember1Id(''); setMember1Pin(''); setShowDropdown1(true) }}
                    onFocus={() => setShowDropdown1(true)}
                    placeholder="이름 검색..."
                    className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  {member1Info && (
                    <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member1Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {member1Info.name} · {member1Info.club || '-'} · {member1Info.grade || '-'}
                      {member1Info.isActive ? ' ✅활성' : ' ⚠️등록비미납'}
                    </div>
                  )}
                  {showDropdown1 && filterMembers(member1Search).length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                      {filterMembers(member1Search).map(m => (
                        <button key={m.member_id}
                          onClick={() => { setMember1Id(m.member_id); setMember1Search(m.display_name || m.name); setShowDropdown1(false); setMember1Pin('') }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                          <span className="font-medium">{m.display_name || m.name}</span>
                          <span className="text-sub text-xs ml-2">{m.club || ''} · {m.grade || ''}</span>
                          <span className={`text-xs ml-2 ${m.status === '활성' ? 'text-green-600' : 'text-red-500'}`}>
                            {m.status === '활성' ? '✓' : '⚠️'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* PIN */}
                {member1Id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">본인 PIN (6자리)</label>
                    <input type="password" inputMode="numeric" maxLength={6} value={member1Pin}
                      onChange={e => setMember1Pin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="PIN 6자리 입력"
                      className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
                    {member1Pin.length > 0 && member1Pin.length < 6 && (
                      <p className="text-xs text-red-500 mt-1">{6 - member1Pin.length}자리 더 입력해주세요</p>
                    )}
                  </div>
                )}

                {/* 선수 2 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">선수 2</label>
                  <input type="text" value={member2Search}
                    onChange={e => { setMember2Search(e.target.value); setMember2Id(''); setShowDropdown2(true) }}
                    onFocus={() => setShowDropdown2(true)}
                    placeholder="이름 검색..."
                    className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
                  {member2Info && (
                    <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member2Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {member2Info.name} · {member2Info.club || '-'} · {member2Info.grade || '-'}
                      {member2Info.isActive ? ' ✅활성' : ' ⚠️등록비미납'}
                    </div>
                  )}
                  {showDropdown2 && filterMembers(member2Search).length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                      {filterMembers(member2Search).map(m => (
                        <button key={m.member_id}
                          onClick={() => { setMember2Id(m.member_id); setMember2Search(m.display_name || m.name); setShowDropdown2(false) }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                          <span className="font-medium">{m.display_name || m.name}</span>
                          <span className="text-sub text-xs ml-2">{m.club || ''} · {m.grade || ''}</span>
                          <span className={`text-xs ml-2 ${m.status === '활성' ? 'text-green-600' : 'text-red-500'}`}>
                            {m.status === '활성' ? '✓' : '⚠️'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={handleSubmit}
                  disabled={submitting || !member1Id || !member2Id || member1Pin.length !== 6}
                  className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
                    hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? '신청 중..' : '🎾 참가 신청하기'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}