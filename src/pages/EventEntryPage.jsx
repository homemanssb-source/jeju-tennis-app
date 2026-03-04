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
      .neq('status', '?? œ').order('name')
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
    return { ...m, isActive: m.status === '?œì„±' }
  }

  async function handleSubmit() {
    if (!selectedEvent || !selectedDivision || !member1Id || !member2Id) {
      showToast?.('?€?? ë¶€?? ?€??2ëª…ì„ ëª¨ë‘ ? íƒ?´ì£¼?¸ìš”.', 'error'); return
    }
    if (!member1Pin || member1Pin.length !== 6) {
      showToast?.('PIN 6?ë¦¬ë¥??…ë ¥?´ì£¼?¸ìš”.', 'error'); return
    }

    setSubmitting(true)

    // 1?¨ê³„: PIN ê²€ì¦?    const { data: pinData, error: pinError } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: members.find(m => m.member_id === member1Id)?.name || '',
      p_pin: member1Pin,
    })
    if (pinError) { showToast?.('PIN ?•ì¸ ?¤íŒ¨: ' + pinError.message, 'error'); setSubmitting(false); return }
    if (pinData && !pinData.ok) { showToast?.('? ï¸ ' + pinData.message, 'error'); setSubmitting(false); return }
    // PIN?¼ë¡œ ì°¾ì? member_id?€ ? íƒ??member1Idê°€ ?¼ì¹˜?˜ëŠ”ì§€ ?•ì¸
    if (pinData && pinData.ok && pinData.member_id !== member1Id) {
      showToast?.('? ï¸ PIN??? íƒ??? ìˆ˜?€ ?¼ì¹˜?˜ì? ?ŠìŠµ?ˆë‹¤.', 'error'); setSubmitting(false); return
    }

    // 2?¨ê³„: ê¸°ì¡´ RPC ê·¸ë?ë¡??¸ì¶œ (ë³€ê²??†ìŒ)
    const { data, error } = await supabase.rpc('rpc_apply_team_to_event', {
      p_event_id: selectedEvent.event_id, p_division_id: selectedDivision,
      p_member1_id: member1Id, p_member2_id: member2Id,
    })
    if (error) { showToast?.('? ì²­ ?¤íŒ¨: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('? ï¸ ' + (data.message || '? ì²­?????†ìŠµ?ˆë‹¤.'), 'error') }
    else if (data && data.ok) {
      showToast?.('?‰ ì°¸ê? ? ì²­ ?„ë£Œ!')
      setMember1Id(''); setMember2Id(''); setMember1Search(''); setMember2Search(''); setMember1Pin('')
    }
    setSubmitting(false)
  }

  const member1Info = getMemberInfo(member1Id)
  const member2Info = getMemberInfo(member2Id)

  return (
    <div className="pb-20">
      <PageHeader title="?ï¸ ì°¸ê?? ì²­" subtitle="ë³µì‹ ?€ ?€??ì°¸ê? ? ì²­" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-700">? ï¸ ?€??2ëª?ëª¨ë‘ <b>?±ë¡ë¹??©ë?(?œì„± ?Œì›)</b>?¬ì•¼ ì°¸ê? ? ì²­??ê°€?¥í•©?ˆë‹¤.</p>
          <p className="text-xs text-amber-700 mt-1">?”‘ ? ì²­???€??)??<b>PIN 6?ë¦¬</b>ë¥??…ë ¥?´ì•¼ ?©ë‹ˆ??</p>
          <p className="text-xs text-amber-700 mt-0.5">??PIN ì´ˆê¸°ê°’ì? ?„í™”ë²ˆí˜¸ ???ë¦¬?…ë‹ˆ??</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">?€??? íƒ</label>
          <select value={selectedEvent?.event_id || ''} onChange={e => handleEventChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
            <option value="">?€?Œë? ? íƒ?˜ì„¸??/option>
            {events.map(ev => (
              <option key={ev.event_id} value={ev.event_id}>
                {ev.event_name} ({ev.event_date}){ev.entry_fee_team ? ` - ${ev.entry_fee_team.toLocaleString()}?? : ''}
              </option>
            ))}
          </select>
          {events.length === 0 && <p className="text-xs text-sub mt-1">?„ì¬ ? ì²­ ê°€?¥í•œ ?€?Œê? ?†ìŠµ?ˆë‹¤.</p>}
        </div>

        {selectedEvent && (
          <div className="bg-soft rounded-lg p-3">
            <p className="text-sm font-semibold">{selectedEvent.event_name}</p>
            <p className="text-xs text-sub mt-1">?“… {selectedEvent.event_date}
              {selectedEvent.entry_fee_team > 0 && ` Â· ?’° ${selectedEvent.entry_fee_team.toLocaleString()}???€`}</p>
          </div>
        )}

        {selectedEvent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ë¶€??? íƒ</label>
            <select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)}
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
              <option value="">ë¶€?œë? ? íƒ?˜ì„¸??/option>
              {divisions.map(d => <option key={d.division_id} value={d.division_id}>{d.division_name}</option>)}
            </select>
          </div>
        )}

        {selectedDivision && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">?€??1 (? ì²­??</label>
            <input type="text" value={member1Search}
              onChange={e => { setMember1Search(e.target.value); setMember1Id(''); setMember1Pin(''); setShowDropdown1(true) }}
              onFocus={() => setShowDropdown1(true)}
              placeholder="?´ë¦„ ê²€??.."
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            {member1Info && (
              <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member1Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {member1Info.name} Â· {member1Info.club || '-'} Â· {member1Info.grade || '-'}
                {member1Info.isActive ? ' ???œì„±' : ' ???±ë¡ë¹?ë¯¸ë‚©'}
              </div>
            )}
            {showDropdown1 && filterMembers(member1Search).length > 0 && (
              <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                {filterMembers(member1Search).map(m => (
                  <button key={m.member_id}
                    onClick={() => { setMember1Id(m.member_id); setMember1Search(m.display_name || m.name); setShowDropdown1(false); setMember1Pin('') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                    <span className="font-medium">{m.display_name || m.name}</span>
                    <span className="text-sub text-xs ml-2">{m.club || ''} Â· {m.grade || ''}</span>
                    <span className={`text-xs ml-2 ${m.status === '?œì„±' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.status === '?œì„±' ? '?? : '?Œë???}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {member1Id && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">?”‘ PIN (6?ë¦¬)</label>
            <input type="password" inputMode="numeric" maxLength={6} value={member1Pin}
              onChange={e => setMember1Pin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN 6?ë¦¬ ?…ë ¥"
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5 tracking-widest" />
            {member1Pin.length > 0 && member1Pin.length < 6 && (
              <p className="text-xs text-red-500 mt-1">{6 - member1Pin.length}?ë¦¬ ???…ë ¥?´ì£¼?¸ìš”</p>
            )}
          </div>
        )}

        {selectedDivision && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">?€??2</label>
            <input type="text" value={member2Search}
              onChange={e => { setMember2Search(e.target.value); setMember2Id(''); setShowDropdown2(true) }}
              onFocus={() => setShowDropdown2(true)}
              placeholder="?´ë¦„ ê²€??.."
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            {member2Info && (
              <div className={`mt-1 px-3 py-1.5 rounded-lg text-xs ${member2Info.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {member2Info.name} Â· {member2Info.club || '-'} Â· {member2Info.grade || '-'}
                {member2Info.isActive ? ' ???œì„±' : ' ???±ë¡ë¹?ë¯¸ë‚©'}
              </div>
            )}
            {showDropdown2 && filterMembers(member2Search).length > 0 && (
              <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                {filterMembers(member2Search).map(m => (
                  <button key={m.member_id}
                    onClick={() => { setMember2Id(m.member_id); setMember2Search(m.display_name || m.name); setShowDropdown2(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-b border-line/30">
                    <span className="font-medium">{m.display_name || m.name}</span>
                    <span className="text-sub text-xs ml-2">{m.club || ''} Â· {m.grade || ''}</span>
                    <span className={`text-xs ml-2 ${m.status === '?œì„±' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.status === '?œì„±' ? '?? : '?Œë???}
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
            {submitting ? '? ì²­ ì¤?..' : '?¾ ì°¸ê? ? ì²­?˜ê¸°'}
          </button>
        )}
      </div>
    </div>
  )
}

