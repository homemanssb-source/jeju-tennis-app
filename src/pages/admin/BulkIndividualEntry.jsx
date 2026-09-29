// src/pages/admin/BulkIndividualEntry.jsx
// 관리자 개인전 일괄 신청 — 클럽·학교를 골라 소속 선수를 한 번에 등록
//  - 단식 부서: 체크한 선수마다 1팀
//  - 복식 부서: 줄마다 선수1·선수2 선택
//  - 서버(rpc_admin_bulk_apply)에서 전부 성공 또는 전부 취소
import { useState, useEffect, useMemo, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { ageGroupOf } from '../../lib/ageGroups'

export default function BulkIndividualEntry({ event, divisions, entries, onDone }) {
  const showToast = useContext(ToastContext)
  const [divisionId, setDivisionId] = useState('')
  const [club, setClub]             = useState('')
  const [members, setMembers]       = useState([])
  const [checked, setChecked]       = useState([])          // 단식: member_id[]
  const [pairs, setPairs]           = useState([{ m1: '', m2: '' }]) // 복식
  const [submitting, setSubmitting] = useState(false)

  const targetType = event?.target_type || '동호인'
  const eventYear  = event?.event_date ? Number(String(event.event_date).slice(0, 4)) : new Date().getFullYear()
  const division   = divisions.find(d => d.division_id === divisionId)
  const isSingles  = division?.play_format === 'singles'

  useEffect(() => {
    (async () => {
      let q = supabase.from('members')
        .select('member_id, name, club, grade, member_type, birthdate')
        .eq('status', '활성')
        .order('name')
      if (targetType !== '전체') q = q.eq('member_type', targetType)
      const { data } = await q
      setMembers(data || [])
    })()
  }, [targetType])

  // 부서·클럽이 바뀌면 선택 초기화
  useEffect(() => { setChecked([]); setPairs([{ m1: '', m2: '' }]) }, [divisionId, club])

  const clubs = useMemo(
    () => [...new Set(members.map(m => m.club).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')),
    [members])

  const clubMembers = useMemo(
    () => members.filter(m => !club || m.club === club),
    [members, club])

  // 이 부서에 이미 신청된 선수 (취소 제외)
  const takenIds = useMemo(() => {
    const ids = new Set()
    for (const e of entries) {
      if (e.division_id !== divisionId || e.entry_status === '취소') continue
      if (e.teams?.member1_id) ids.add(e.teams.member1_id)
      if (e.teams?.member2_id) ids.add(e.teams.member2_id)
    }
    return ids
  }, [entries, divisionId])

  function meta(m) {
    if (m.member_type === '선수') return ageGroupOf(m.birthdate, eventYear) || '학생선수'
    return m.grade || ''
  }

  function toggle(id) {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleAll() {
    const selectable = clubMembers.filter(m => !takenIds.has(m.member_id)).map(m => m.member_id)
    setChecked(prev => prev.length === selectable.length ? [] : selectable)
  }

  // 복식: 다른 줄에서 이미 고른 선수는 선택지에서 제외
  function pairOptions(rowIdx, slot) {
    const used = new Set()
    pairs.forEach((p, i) => {
      if (i !== rowIdx) { if (p.m1) used.add(p.m1); if (p.m2) used.add(p.m2) }
      else { const other = slot === 'm1' ? p.m2 : p.m1; if (other) used.add(other) }
    })
    return clubMembers.filter(m => !takenIds.has(m.member_id) && !used.has(m.member_id))
  }

  function setPair(i, slot, value) {
    setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, [slot]: value } : p))
  }

  const payload = isSingles
    ? checked.map(id => ({ member1_id: id, member2_id: null }))
    : pairs.filter(p => p.m1 && p.m2).map(p => ({ member1_id: p.m1, member2_id: p.m2 }))
  const incompletePairs = !isSingles && pairs.some(p => (p.m1 && !p.m2) || (!p.m1 && p.m2))

  async function handleSubmit() {
    if (!divisionId) { showToast?.('부서를 선택해주세요.', 'error'); return }
    if (incompletePairs) { showToast?.('선수 2명을 모두 고르지 않은 줄이 있습니다.', 'error'); return }
    if (payload.length === 0) { showToast?.('등록할 선수를 선택해주세요.', 'error'); return }
    if (!confirm(`${division?.division_name} 부서에 ${payload.length}팀을 등록할까요?`)) return

    setSubmitting(true)
    const { data, error } = await supabase.rpc('rpc_admin_bulk_apply', {
      p_event_id: event.event_id, p_division_id: divisionId, p_entries: payload,
    })
    setSubmitting(false)
    if (error || !data?.ok) {
      showToast?.('일괄 등록 실패 (아무것도 등록되지 않았습니다): ' + (data?.message || error?.message || '오류'), 'error')
      return
    }
    showToast?.(`✅ ${data.count}팀 일괄 등록 완료!`)
    onDone?.()
  }

  const nameOf = id => members.find(m => m.member_id === id)?.name || ''

  return (
    <>
      <p className="text-xs text-sub bg-soft rounded-lg px-3 py-2">
        클럽·학교를 고르면 소속 {targetType === '선수' ? '학생선수' : targetType === '전체' ? '회원' : '동호인'}이 보입니다.
        한 줄이라도 문제가 있으면 <b>전체가 등록되지 않습니다.</b>
      </p>

      {/* 부서 */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">부서 선택 <span className="text-red-500">*</span></label>
        <select value={divisionId} onChange={e => setDivisionId(e.target.value)}
          className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
          <option value="">부서를 선택하세요</option>
          {divisions.map(d => (
            <option key={d.division_id} value={d.division_id}>
              {d.division_name}{d.play_format === 'singles' ? ' (단식)' : ' (복식)'}
            </option>
          ))}
        </select>
      </div>

      {/* 클럽·학교 */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">클럽·학교</label>
        <select value={club} onChange={e => setClub(e.target.value)}
          className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
          <option value="">전체</option>
          {clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {divisionId && isSingles && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">선수 선택 (1명 = 1팀)</label>
            <button type="button" onClick={toggleAll} className="text-xs text-accent hover:underline">전체 선택/해제</button>
          </div>
          <div className="border border-line rounded-xl max-h-64 overflow-y-auto divide-y divide-line">
            {clubMembers.length === 0 && <p className="text-xs text-sub p-3 text-center">선수가 없습니다.</p>}
            {clubMembers.map(m => {
              const taken = takenIds.has(m.member_id)
              return (
                <label key={m.member_id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${taken ? 'opacity-40' : 'hover:bg-soft cursor-pointer'}`}>
                  <input type="checkbox" disabled={taken}
                    checked={checked.includes(m.member_id)} onChange={() => toggle(m.member_id)} />
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-sub">{m.club || ''} · {meta(m)}</span>
                  {taken && <span className="ml-auto text-[10px] text-sub">이미 신청됨</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {divisionId && !isSingles && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">복식 팀 (줄마다 선수 2명)</label>
          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-xs text-sub w-5">{i + 1}</span>
                {['m1', 'm2'].map(slot => (
                  <select key={slot} value={p[slot]} onChange={e => setPair(i, slot, e.target.value)}
                    className="flex-1 min-w-0 text-sm border border-line rounded-lg px-2 py-2">
                    <option value="">{slot === 'm1' ? '선수1' : '선수2'}</option>
                    {p[slot] && <option value={p[slot]}>{nameOf(p[slot])}</option>}
                    {pairOptions(i, slot).filter(m => m.member_id !== p[slot]).map(m => (
                      <option key={m.member_id} value={m.member_id}>{m.name} · {meta(m)}</option>
                    ))}
                  </select>
                ))}
                <button type="button" disabled={pairs.length === 1}
                  onClick={() => setPairs(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 text-xs px-1 disabled:opacity-30">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPairs(prev => [...prev, { m1: '', m2: '' }])}
            className="mt-2 text-xs text-accent hover:underline">+ 줄 추가</button>
        </div>
      )}

      {divisionId && (
        <button onClick={handleSubmit} disabled={submitting || payload.length === 0}
          className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {submitting ? '등록 중...' : `✅ ${payload.length}팀 일괄 등록`}
        </button>
      )}
    </>
  )
}
