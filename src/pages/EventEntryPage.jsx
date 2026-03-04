import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

export default function EventEntryPage() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])
  const [divisions, setDivisions] = useState([])
  const [members, setMembers] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedDivision, setSelectedDivision] = useState('')
  const [member1Search, setMember1Search] = useState('')
  const [member2Search, setMember2Search] = useState('')
  const [member1Id, setMember1Id] = useState('')
  const [member2Id, setMember2Id] = useState('')
  const [member1Pin, setMember1Pin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDropdown1, setShowDropdown1] = useState(false)
  const [showDropdown2, setShowDropdown2] = useState(false)

  useEffect(() => { fetchEvents(); fetchMembers() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').eq('status', 'OPEN').order('event_date', { ascending: false })
    setEvents(data || [])
  }

  async function fetchMembers() {
    const { data } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '??��').order('name')
    setMembers(data || [])
  }

  async function fetchDivisions(eventId) {
    const { data } = await supabase.from('event_divisions').select('*').eq('event_id', eventId).order('division_name')
    setDivisions(data || [])
  }

  function handleEventChange(eventId) {
    const ev = events.find(e => e.event_id === eventId)
    setSelectedEvent(ev || null); setSelectedDivision('')
    if (eventId) fetchDivisions(eventId); else setDivisions([])
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
    return { ...m, isActive: m.status === '?�성' }
  }

  async function handleSubmit() {
    if (!selectedEvent || !selectedDivision || !member1Id || !member2Id) {
      showToast?.('?�?? 부?? ?�??2명을 모두 ?�택?�주?�요.', 'error'); return
    }
    if (!member1Pin || member1Pin.length !== 6) {
      showToast?.('PIN 6?�리�??�력?�주?�요.', 'error'); return
    }

    setSubmitting(true)

    // 1단계: PIN 검증
    const { data: pinData, error: pinError } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: members.find(m => m.member_id === member1Id)?.name || '',
      p_pin: member1Pin,
    })
    if (pinError) { showToast?.('PIN ?�인 ?�패: ' + pinError.message, 'error'); setSubmitting(false); return }
    if (pinData && !pinData.ok) { showToast?.('?�️ ' + pinData.message, 'error'); setSubmitting(false); return }
    // PIN?�로 찾�? member_id?� ?�택??member1Id가 ?�치?�는지 ?�인
    if (pinData && pinData.ok && pinData.member_id !== member1Id) {
      showToast?.('?�️ PIN???�택???�수?� ?�치?��? ?�습?�다.', 'error'); setSubmitting(false); return
    }

    // 2?�계: 기존 RPC 그�?�??�출 (변�??�음)
    const { data, error } = await supabase.rpc('rpc_apply_team_to_event', {
      p_event_id: selectedEvent.event_id, p_division_id: selectedDivision,
      p_member1_id: member1Id, p_member2_id: member2Id,
    })
    if (error) { showToast?.('?�청 ?�패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('?�️ ' + (data.message || '?�청?????�습?�다.'), 'error') }
    else if (data && data.ok) {
      showToast?.('?�� 참�? ?�청 ?�료!')
      setMember1Id(''); setMember2Id(''); setMember1Search(''); setMember2Search(''); setMember1Pin('')
    }
    setSubmitting(false)
  }

  const member1Info = getMemberInfo(member1Id)
  const member2Info = getMemberInfo(member2Id)

  return (
    <div className="pb-20">
      <PageHeader title="?�️ 참�??�청" subtitle="복식 ?� ?�??참�? ?�청" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">?�️ ?�??2�?모두 <b>?�록�??��?(?�성 ?�원)</b>?�야 참�? ?�청??가?�합?�다.</p>
          <p className="text-xs text-amber-700 mt-1">?�� ?�청???�??)??<b>PIN 6?�리</b>�??�력?�야 ?�니??</p>
          <p className="text-xs text-amber-700 mt-0.5">??PIN 초기값�? ?�화번호 ???�리?�니??</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">?�???�택</label>
          <select value={selectedEvent?.event_id || ''} onChange={e => handleEventChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
            <option value="">?�?��? ?�택?�세??/option>
            {events.map(ev => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.event_name} ({ev.event_date}){ev.entry_fee_team ? ` - ${ev.entry_fee_team.toLocaleString()}?? : ''}
              </option>
            ))}
          </select>
          {events.length === 0 && <p className="text-xs text-sub mt-1">?�재 ?�청 가?�한 ?�?��? ?�습?�다.</p>}
        </div>

        {selectedEvent && (
          <div className="bg-soft rounded-lg p-3">
            <p className="text-sm font-semibold">{selectedEvent.event_name}</p>
            <p className="text-xs text-sub mt-1">?�� {selectedEvent.event_date}
              {selectedEvent.entry_fee_team > 0 && ` · ?�� ${selectedEvent.entry_fee_team.toLocaleString()}???�`}</p>
          </div>
        )}

        {selectedEvent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">부???�택</label>
            <select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
              <option value="">부?��? ?�택?�세??/option>
              {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.division_name}</option>)}
            </select>
          </div>
        )}

        {selectedDivision && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">?�??1 (?�청??</label>
            <input type="text" value={member1Search}
              onChange={e => { setMember1Search(e.target.value); setMember1Id(''); setMember1Pin(''); setShowDropdown1(true) }}
              onFocus={() => setShowDropdown1(true)}
              placeholder="?�름 검??.."
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            {member1Info && (
              <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member1Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {member1Info.name} · {member1Info.club || '-'} · {member1Info.grade || '-'}
                {member1Info.isActive ? ' ???�성' : ' ???�록�?미납'}
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
                    <span className={`text-xs ml-2 ${m.status === '?�성' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.status === '?�성' ? '?? : '?��???}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {member1Id && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">?�� PIN (6?�리)</label>
            <input type="password" inputMode="numeric" maxLength={6} value={member1Pin}
              onChange={e => setMember1Pin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN 6?�리 ?�력"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
            {member1Pin.length > 0 && member1Pin.length < 6 && (
              <p className="text-xs text-red-500 mt-1">{6 - member1Pin.length}?�리 ???�력?�주?�요</p>
            )}
          </div>
        )}

        {selectedDivision && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">?�??2</label>
            <input type="text" value={member2Search}
              onChange={e => { setMember2Search(e.target.value); setMember2Id(''); setShowDropdown2(true) }}
              onFocus={() => setShowDropdown2(true)}
              placeholder="?�름 검??.."
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            {member2Info && (
              <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member2Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {member2Info.name} · {member2Info.club || '-'} · {member2Info.grade || '-'}
                {member2Info.isActive ? ' ???�성' : ' ???�록�?미납'}
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
                    <span className={`text-xs ml-2 ${m.status === '?�성' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.status === '?�성' ? '?? : '?��???}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedDivision && (
          <button onClick={handleSubmit} disabled={submitting || !member1Id || !member2Id || member1Pin.length !== 6}
            className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
              hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '?�청 �?..' : '?�� 참�? ?�청?�기'}
          </button>
        )}
      </div>
    </div>
  )
}




