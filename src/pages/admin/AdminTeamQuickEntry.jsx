// src/pages/admin/AdminTeamQuickEntry.jsx
// 관리자 단체전 팀 직접 등록 — 부서 탭 → 클럽 선택 → 회원 체크 → 등록
// 참가신청 관리(EntryAdmin)와 팀 단체전 관리(AdminTeamEntryPage)에서 같이 쓴다.
import { useState, useEffect, useMemo, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { getMatchTypeLabel, resolveMatchType, resolveMemberLimit, filterTeamDivisions, clubBaseKey, memberClubs } from '../../lib/teamMatch'

// 같은 부서에 이미 같은 클럽 팀이 있으면 ' B', ' C' … 를 붙인다 (TeamEntryPage 와 같은 규칙)
function getTeamSuffix(base, usedNames) {
  const used = new Set(usedNames.map(n => (n || '').trim()))
  for (let i = 0; i < 25; i++) {
    const suffix = i === 0 ? '' : ' ' + String.fromCharCode(65 + i)
    if (!used.has(base.trim() + suffix)) return suffix
  }
  return ''
}

export default function AdminTeamQuickEntry({ event, onDone }) {
  const showToast = useContext(ToastContext)
  const [divisions, setDivisions]   = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [existing, setExisting]     = useState([])          // 이 대회 기존 팀 신청 (취소 제외)
  const [takenIds, setTakenIds]     = useState(new Set())   // 이미 다른 팀에 들어간 회원
  const [loading, setLoading]       = useState(true)

  const [divisionId, setDivisionId] = useState('')
  const [clubQuery, setClubQuery]   = useState('')
  const [club, setClub]             = useState('')
  const [checked, setChecked]       = useState([])          // 체크한 순서대로 member_id
  const [captainId, setCaptainId]   = useState('')
  const [teamName, setTeamName]     = useState('')
  const [teamNameEdited, setTeamNameEdited] = useState(false)
  const [extraQuery, setExtraQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (event?.event_id) loadAll() }, [event?.event_id])

  // 회원이 1000명을 넘어도 잘리지 않도록 나눠서 받는다
  async function fetchActiveMembers() {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('members')
        .select('member_id, name, club, gender, grade')
        .eq('status', '활성').order('name').range(from, from + 999)
      if (error || !data?.length) break
      rows.push(...data)
      if (data.length < 1000) break
    }
    return { data: rows }
  }

  async function loadAll() {
    setLoading(true)
    const [divRes, memRes, entRes, takenRes] = await Promise.all([
      supabase.from('event_divisions').select('*').eq('event_id', event.event_id).order('created_at'),
      fetchActiveMembers(),
      supabase.from('team_event_entries').select('id, club_name, division_id').eq('event_id', event.event_id).neq('status', 'cancelled'),
      supabase.from('team_event_members')
        .select('member_id, team_event_entries!inner(event_id, status)')
        .eq('team_event_entries.event_id', event.event_id)
        .neq('team_event_entries.status', 'cancelled'),
    ])
    const teamDivs = filterTeamDivisions(event, divRes.data || [])
    setDivisions(teamDivs)
    if (teamDivs.length === 1) setDivisionId(teamDivs[0].division_id)
    setAllMembers(memRes.data || [])
    setExisting(entRes.data || [])
    setTakenIds(new Set((takenRes.data || []).map(r => r.member_id).filter(Boolean)))
    setLoading(false)
  }

  const division   = divisions.find(d => d.division_id === divisionId) || null
  const memberLimit = resolveMemberLimit(event, division)
  const memberMap  = useMemo(() => Object.fromEntries(allMembers.map(m => [m.member_id, m])), [allMembers])

  // 클럽 목록 — 복수 소속은 각각 따로 센다
  const clubCounts = useMemo(() => {
    const map = {}
    for (const m of allMembers) for (const c of memberClubs(m.club)) map[c] = (map[c] || 0) + 1
    return map
  }, [allMembers])

  const clubOptions = useMemo(() => {
    const q = clubQuery.replace(/\s/g, '')
    if (!q) return []
    return Object.keys(clubCounts)
      .filter(c => c.replace(/\s/g, '').includes(q))
      .sort((a, b) => clubCounts[b] - clubCounts[a])
      .slice(0, 12)
  }, [clubQuery, clubCounts])

  const clubMembers = useMemo(() =>
    club ? allMembers.filter(m => memberClubs(m.club).includes(club)) : []
  , [club, allMembers])

  const extraResults = useMemo(() => {
    const q = extraQuery.trim()
    if (!q) return []
    return allMembers.filter(m => m.name?.includes(q)).slice(0, 10)
  }, [extraQuery, allMembers])

  // 같은 클럽 기존 신청 → 팀명 suffix, 다른 부서 신청 여부
  const sameClub = useMemo(() =>
    club ? existing.filter(e => clubBaseKey(e.club_name) === clubBaseKey(club)) : []
  , [club, existing])
  const suffix = club ? getTeamSuffix(club, sameClub.filter(e => (e.division_id ?? null) === (divisionId || null)).map(e => e.club_name)) : ''
  const otherDivisionNames = [...new Set(sameClub
    .filter(e => e.division_id && e.division_id !== divisionId)
    .map(e => divisions.find(d => d.division_id === e.division_id)?.division_name)
    .filter(Boolean))]

  useEffect(() => {
    if (!teamNameEdited) setTeamName(club ? club + suffix : '')
  }, [club, suffix, teamNameEdited])

  function pickClub(c) {
    setClub(c)
    setClubQuery('')
    // 클럽 바꾸면 그 클럽 회원 중 아직 신청 안 한 사람을 바로 체크해 둔다
    const ids = allMembers
      .filter(m => memberClubs(m.club).includes(c) && !takenIds.has(m.member_id))
      .map(m => m.member_id)
    setChecked([])
    setCaptainId('')
    setTeamNameEdited(false)
    // 인원 제한보다 많으면 자동 체크하지 않는다 — 관리자가 골라야 한다
    if (!memberLimit || ids.length <= memberLimit) {
      setChecked(ids)
      setCaptainId(ids[0] || '')
    }
  }

  function toggle(id) {
    if (takenIds.has(id)) return
    setChecked(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!next.includes(captainId)) setCaptainId(next[0] || '')
      else if (!captainId) setCaptainId(next[0] || '')
      return next
    })
  }

  function toggleAll() {
    const selectable = clubMembers.filter(m => !takenIds.has(m.member_id)).map(m => m.member_id)
    const allOn = selectable.every(id => checked.includes(id))
    setChecked(prev => {
      const next = allOn ? prev.filter(id => !selectable.includes(id)) : [...new Set([...prev, ...selectable])]
      if (!next.includes(captainId)) setCaptainId(next[0] || '')
      return next
    })
  }

  function addExtra(m) {
    if (takenIds.has(m.member_id) || checked.includes(m.member_id)) return
    setChecked(prev => {
      const next = [...prev, m.member_id]
      if (!captainId) setCaptainId(m.member_id)
      return next
    })
    setExtraQuery('')
  }

  const roster = checked.map(id => memberMap[id]).filter(Boolean)
  const overLimit = memberLimit && roster.length > memberLimit
  const outsiders = roster.filter(m => club && !memberClubs(m.club).includes(club))

  async function handleSubmit() {
    if (divisions.length > 0 && !division) { showToast?.('부서를 선택해주세요.', 'error'); return }
    if (!club) { showToast?.('클럽을 선택해주세요.', 'error'); return }
    if (!teamName.trim()) { showToast?.('팀명을 입력해주세요.', 'error'); return }
    if (roster.length === 0) { showToast?.('선수를 1명 이상 체크해주세요.', 'error'); return }
    if (overLimit) { showToast?.(`인원 제한(${memberLimit}명)을 초과했습니다.`, 'error'); return }
    if (existing.some(e => (e.club_name || '').trim() === teamName.trim() && (e.division_id ?? null) === (divisionId || null))) {
      showToast?.('같은 부서에 같은 팀명이 이미 있습니다.', 'error'); return
    }
    const captain = memberMap[captainId] || roster[0]

    setSubmitting(true)
    try {
      const { data: entry, error: entryErr } = await supabase
        .from('team_event_entries')
        .insert({
          event_id:          event.event_id,
          club_name:         teamName.trim(),
          captain_member_id: captain.member_id,
          captain_name:      captain.name,
          captain_pin:       '',
          member_limit:      memberLimit || null,
          division_id:       division?.division_id || null,
          division_name:     division?.division_name || null,
          status:            'confirmed',
          payment_status:    '미납',
        })
        .select('id')
        .single()
      if (entryErr) throw entryErr

      const { error: memberErr } = await supabase
        .from('team_event_members')
        .insert(roster.map((m, i) => ({
          entry_id:     entry.id,
          member_id:    m.member_id,
          member_name:  m.name,
          gender:       m.gender || '',
          grade:        m.grade || '',
          member_order: i + 1,
        })))
      if (memberErr) {
        await supabase.from('team_event_entries').delete().eq('id', entry.id)
        throw memberErr
      }

      showToast?.(`✅ ${teamName.trim()} 등록 완료 (${roster.length}명)`)
      onDone?.()
    } catch (err) {
      showToast?.('등록 실패: ' + err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-sm text-sub py-8 text-center">불러오는 중...</p>

  const selectableCount = clubMembers.filter(m => !takenIds.has(m.member_id)).length
  const allOn = selectableCount > 0 && clubMembers.filter(m => !takenIds.has(m.member_id)).every(m => checked.includes(m.member_id))

  return (
    <div className="space-y-4">
      {/* ① 부서 */}
      {divisions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">① 부서 <span className="text-red-500">*</span></p>
          <div className="flex flex-wrap gap-1.5">
            {divisions.map(d => (
              <button key={d.division_id} type="button" onClick={() => setDivisionId(d.division_id)}
                className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                  d.division_id === divisionId ? 'bg-accent text-white border-accent' : 'bg-white text-gray-700 border-line hover:bg-soft'}`}>
                {d.division_name}
                {resolveMatchType(event, d) && <span className="opacity-70"> · {getMatchTypeLabel(resolveMatchType(event, d))}</span>}
              </button>
            ))}
          </div>
          {memberLimit && <p className="text-[11px] text-sub mt-1">팀당 최대 {memberLimit}명</p>}
        </div>
      )}

      {/* ② 클럽 */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1.5">② 클럽 <span className="text-red-500">*</span></p>
        {club ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-blue-800">{club} <span className="text-xs font-normal text-blue-600">회원 {clubCounts[club] || 0}명</span></span>
            <button type="button" onClick={() => { setClub(''); setChecked([]); setCaptainId('') }}
              className="text-xs text-blue-600 underline">변경</button>
          </div>
        ) : (
          <>
            <input type="text" value={clubQuery} onChange={e => setClubQuery(e.target.value)}
              placeholder="클럽 이름 일부 입력 (예: 하나)" autoFocus
              className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            {clubOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {clubOptions.map(c => (
                  <button key={c} type="button" onClick={() => pickClub(c)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-soft">
                    {c} <span className="text-xs text-sub">{clubCounts[c]}</span>
                  </button>
                ))}
              </div>
            )}
            {clubQuery.trim() && clubOptions.length === 0 && (
              <p className="text-xs text-sub mt-1">일치하는 클럽이 없습니다.</p>
            )}
          </>
        )}
        {club && otherDivisionNames.length > 0 && (
          <p className="text-[11px] text-orange-600 mt-1">⚠️ 이 클럽은 이미 {otherDivisionNames.join(', ')}에 신청했습니다.</p>
        )}
      </div>

      {/* ③ 선수 체크 */}
      {club && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-700">
              ③ 선수 체크 <span className={overLimit ? 'text-red-600' : 'text-accent'}>{roster.length}{memberLimit ? `/${memberLimit}` : ''}명</span>
            </p>
            {selectableCount > 0 && (
              <button type="button" onClick={toggleAll} className="text-xs text-accent">
                {allOn ? '전체 해제' : '전체 선택'}
              </button>
            )}
          </div>
          <p className="text-[11px] text-sub mb-1.5">이름을 눌러 체크 · ★ 를 눌러 주장 지정</p>
          <div className="border border-line rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {clubMembers.length === 0 && <p className="text-xs text-sub p-3">이 클럽 회원이 없습니다.</p>}
            {clubMembers.map(m => {
              const taken = takenIds.has(m.member_id)
              const on = checked.includes(m.member_id)
              return (
                <MemberRow key={m.member_id} m={m} on={on} taken={taken}
                  captain={captainId === m.member_id}
                  onToggle={() => toggle(m.member_id)}
                  onCaptain={() => setCaptainId(m.member_id)} />
              )
            })}
            {outsiders.map(m => (
              <MemberRow key={m.member_id} m={m} on taken={false} outsider
                captain={captainId === m.member_id}
                onToggle={() => toggle(m.member_id)}
                onCaptain={() => setCaptainId(m.member_id)} />
            ))}
          </div>

          {/* 다른 클럽 선수 추가 */}
          <input type="text" value={extraQuery} onChange={e => setExtraQuery(e.target.value)}
            placeholder="＋ 다른 클럽 선수 이름으로 추가"
            className="w-full text-sm border border-line rounded-lg px-3 py-2 mt-2" />
          {extraResults.length > 0 && (
            <div className="border border-line rounded-xl mt-1 overflow-hidden max-h-36 overflow-y-auto">
              {extraResults.map(m => {
                const disabled = takenIds.has(m.member_id) || checked.includes(m.member_id)
                return (
                  <button key={m.member_id} type="button" disabled={disabled} onClick={() => addExtra(m)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left border-b border-line last:border-0
                      ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-soft'}`}>
                    <span className="text-sm">{m.name} <span className="text-xs text-sub">{m.grade || ''}</span></span>
                    <span className="text-xs text-sub">
                      {takenIds.has(m.member_id) ? '다른 팀 신청됨' : checked.includes(m.member_id) ? '추가됨' : m.club || ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ④ 팀명 + 확인 */}
      {club && roster.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
          <div>
            <label className="block text-[11px] font-semibold text-green-800 mb-1">팀명 (자동 · 수정 가능)</label>
            <input type="text" value={teamName}
              onChange={e => { setTeamName(e.target.value); setTeamNameEdited(true) }}
              className="w-full text-sm border border-green-200 rounded-lg px-3 py-2 bg-white" />
            {suffix && !teamNameEdited && (
              <p className="text-[11px] text-green-700 mt-1">같은 부서에 {club} 팀이 있어 '{suffix.trim()}' 를 붙였습니다.</p>
            )}
          </div>
          <p className="text-xs text-green-700">
            {division ? <><b>{division.division_name}</b> · </> : null}
            주장 <b>{(memberMap[captainId] || roster[0])?.name}</b> · 선수 <b>{roster.length}명</b> · 확정 상태로 등록
          </p>
          {overLimit && <p className="text-xs text-red-600">인원 제한 {memberLimit}명을 넘었습니다. 체크를 줄여주세요.</p>}
        </div>
      )}

      <button type="button" onClick={handleSubmit}
        disabled={submitting || !club || roster.length === 0 || overLimit || (divisions.length > 0 && !division)}
        className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
        {submitting ? '등록 중...' : roster.length > 0 ? `✅ ${roster.length}명으로 팀 등록` : '✅ 팀 등록'}
      </button>
    </div>
  )
}

function MemberRow({ m, on, taken, captain, outsider, onToggle, onCaptain }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-b border-line last:border-0
      ${taken ? 'bg-gray-50 opacity-50' : on ? 'bg-blue-50' : 'bg-white'}`}>
      <button type="button" onClick={onToggle} disabled={taken}
        className="flex-1 flex items-center gap-2 text-left min-w-0">
        <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px]
          ${on ? 'bg-accent border-accent text-white' : 'border-gray-300 bg-white'}`}>{on ? '✓' : ''}</span>
        <span className="text-sm font-medium truncate">{m.name}</span>
        <span className="text-xs text-sub shrink-0">
          {m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : ''} {m.grade || ''}
        </span>
        {outsider && <span className="text-[10px] text-orange-600 shrink-0">{m.club || '타클럽'}</span>}
        {taken && <span className="text-[10px] text-gray-500 shrink-0">다른 팀 신청됨</span>}
      </button>
      {on && (
        <button type="button" onClick={onCaptain} title="주장 지정"
          className={`text-base leading-none px-1 ${captain ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
          ★
        </button>
      )}
    </div>
  )
}
