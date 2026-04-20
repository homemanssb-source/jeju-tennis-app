import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const RANKS = ['우승', '준우승', '4강', '8강', '16강', '32강', '참가']
const RANK_MAP = {
  '우승': 'points_1', '준우승': 'points_2', '4강': 'points_3',
  '8강': 'points_4', '16강': 'points_5', '32강': 'points_6', '참가': 'points_7'
}

export default function TourAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents] = useState([])           // events 테이블 (대회 관리)
  const [pointRules, setPointRules] = useState([])
  const [results, setResults] = useState([])
  const [members, setMembers] = useState([])
  const [selectedTour, setSelectedTour] = useState(null) // { tournament_name, date, ... }
  const [selectedEvent, setSelectedEvent] = useState(null) // 원본 events row (event_type 포함)
  const [teamDivisions, setTeamDivisions] = useState([])   // 단체전 부서 목록
  const [teamEntries, setTeamEntries] = useState([])       // 선택 대회의 단체전 참가팀
  const [resultForm, setResultForm] = useState({ member_id: '', team_entry_id: '', rank: '', division: '' })
  const [memberSearch, setMemberSearch] = useState('')
  const [autoPoints, setAutoPoints] = useState(null)
  const [loadingTour, setLoadingTour] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: evs }, { data: rules }, { data: mems }] = await Promise.all([
      supabase.from('events')
        .select('event_id, event_name, event_date, tournament_id, event_type')
        .order('event_date', { ascending: false }),
      supabase.from('point_rules').select('*'),
      supabase.from('members')
        .select('member_id, name, display_name, division')
        .eq('status', '활성').order('name'),
    ])
    setEvents(evs || [])
    setPointRules(rules || [])
    setMembers(mems || [])
  }

  async function fetchResults(tourName) {
    const { data } = await supabase.from('tournament_results').select('*')
      .eq('tournament_name', tourName).order('division').order('points', { ascending: false })
    setResults(data || [])
  }

  function calcPoints(division, rank) {
    const rule = pointRules.find(r => r.division === division)
    if (!rule || !rank) return null
    const col = RANK_MAP[rank]
    return col ? rule[col] : null
  }

  useEffect(() => {
    setAutoPoints(calcPoints(resultForm.division, resultForm.rank))
  }, [resultForm.division, resultForm.rank])

  // events에서 대회 선택 → tournaments_master 자동 매칭 or 생성
  async function handleEventSelect(eventId) {
    if (!eventId) {
      setSelectedTour(null)
      setSelectedEvent(null)
      setTeamDivisions([])
      setResults([])
      setResultForm({ member_id: '', rank: '', division: '' })
      return
    }

    const ev = events.find(e => e.event_id === eventId)
    if (!ev) return

    setLoadingTour(true)
    setSelectedEvent(ev)

    // 단체전/both 대회인 경우 team_event_entries에서 실제 쓰인 부서 + 팀 목록 로드
    if (ev.event_type === 'team' || ev.event_type === 'both') {
      const { data: teams } = await supabase
        .from('team_event_entries')
        .select('id, club_name, division_name, captain_name')
        .eq('event_id', ev.event_id)
        .neq('status', 'cancelled')
        .order('division_name')
        .order('club_name')
      setTeamEntries(teams || [])
      const uniq = [...new Set((teams || [])
        .map(r => r.division_name)
        .filter(Boolean))]
      setTeamDivisions(uniq)
    } else {
      setTeamDivisions([])
      setTeamEntries([])
    }

    // 1) event에 tournament_id가 연결되어 있으면 해당 레코드 조회
    if (ev.tournament_id) {
      const { data: tour } = await supabase
        .from('tournaments_master')
        .select('*')
        .eq('tournament_id', ev.tournament_id)
        .single()

      if (tour) {
        setSelectedTour(tour)
        fetchResults(tour.tournament_name)
        setResultForm({ member_id: '', rank: '', division: '' })
        setLoadingTour(false)
        return
      }
    }

    // 2) tournament_id 없거나 조회 실패 → 대회명으로 조회
    const { data: existing } = await supabase
      .from('tournaments_master')
      .select('*')
      .eq('tournament_name', ev.event_name)
      .limit(1)

    if (existing && existing.length > 0) {
      setSelectedTour(existing[0])
      fetchResults(existing[0].tournament_name)
      setResultForm({ member_id: '', rank: '', division: '' })
      setLoadingTour(false)
      return
    }

    // 3) 없으면 자동 생성
    const dateVal = ev.event_date || new Date().toISOString().substring(0, 10)
    const year = dateVal.substring(0, 4)
    const { data: created, error } = await supabase
      .from('tournaments_master')
      .insert([{ tournament_name: ev.event_name, date: dateVal, year }])
      .select()
      .single()

    if (error) {
      showToast?.('tournaments_master 생성 실패: ' + error.message, 'error')
      setLoadingTour(false)
      return
    }

    // event에 tournament_id 업데이트
    await supabase.from('events')
      .update({ tournament_id: created.tournament_id })
      .eq('event_id', ev.event_id)

    showToast?.(`"${ev.event_name}" 대회 마스터를 자동 생성했습니다.`)
    setSelectedTour(created)
    fetchResults(created.tournament_name)
    setResultForm({ member_id: '', rank: '', division: '' })

    // events 목록 갱신 (tournament_id 반영)
    setEvents(prev => prev.map(e =>
      e.event_id === ev.event_id ? { ...e, tournament_id: created.tournament_id } : e
    ))
    setLoadingTour(false)
  }

  // 선택된 부서가 단체전 부서인지
  const isTeamDivision = !!resultForm.division && teamDivisions.includes(resultForm.division)

  async function handleAddResult() {
    if (!selectedTour || !resultForm.rank || !resultForm.division) {
      showToast?.('대회, 부서, 순위를 선택해주세요.', 'error'); return
    }
    const points = autoPoints || 0
    const seasonYear = new Date(selectedTour.date).getFullYear()

    // ── 단체전: 팀 선택 → 팀 모든 멤버에게 결과 insert ──
    if (isTeamDivision) {
      if (!resultForm.team_entry_id) {
        showToast?.('팀(클럽)을 선택해주세요.', 'error'); return
      }
      setSubmitting(true)
      const team = teamEntries.find(t => t.id === resultForm.team_entry_id)
      const { data: tmembers, error: memErr } = await supabase
        .from('team_event_members')
        .select('member_id, member_name')
        .eq('entry_id', resultForm.team_entry_id)
      if (memErr) { setSubmitting(false); showToast?.(memErr.message, 'error'); return }
      if (!tmembers || tmembers.length === 0) {
        setSubmitting(false); showToast?.('팀에 등록된 선수가 없습니다.', 'error'); return
      }

      // member_id 있는 선수만 members 테이블에서 현재 등급 조회 (당시 등급 저장용)
      const memberIds = tmembers.map(m => m.member_id).filter(Boolean)
      const gradeMap = {}
      if (memberIds.length > 0) {
        const { data: ms } = await supabase.from('members')
          .select('member_id, grade').in('member_id', memberIds)
        for (const m of (ms || [])) gradeMap[m.member_id] = m.grade
      }

      const rows = tmembers.map(m => ({
        tournament_name: selectedTour.tournament_name,
        date:            selectedTour.date,
        member_id:       m.member_id || null,
        member_name:     m.member_name || '',
        division:        resultForm.division,
        rank:            resultForm.rank,
        points,
        season_year:     seasonYear,
        grade:           m.member_id ? (gradeMap[m.member_id] || null) : null,
        club_name:       team?.club_name || null,
      }))
      const { error } = await supabase.from('tournament_results').insert(rows)
      setSubmitting(false)
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.(`${team?.club_name} ${resultForm.rank} — ${rows.length}명 입력완료`)
      setResultForm({ ...resultForm, team_entry_id: '', rank: '' })
      fetchResults(selectedTour.tournament_name)
      return
    }

    // ── 개인전: 기존 로직 ──
    if (!resultForm.member_id) {
      showToast?.('회원을 선택해주세요.', 'error'); return
    }
    const member = members.find(m => m.member_id === resultForm.member_id)
    setSubmitting(true)
    const { error } = await supabase.from('tournament_results').insert([{
      tournament_name: selectedTour.tournament_name, date: selectedTour.date,
      member_id: resultForm.member_id, member_name: member?.display_name || member?.name || '',
      division: resultForm.division, rank: resultForm.rank, points, season_year: seasonYear,
    }])
    setSubmitting(false)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.(`${member?.name} ${resultForm.rank} +${points}점 입력완료`)
    setResultForm({ ...resultForm, member_id: '', rank: '' }); setMemberSearch('')
    fetchResults(selectedTour.tournament_name)
  }

  async function handleDeleteResult(id) {
    if (!window.confirm('이 결과를 삭제하시겠습니까?')) return
    await supabase.from('tournament_results').delete().eq('id', id)
    showToast?.('삭제되었습니다.')
    if (selectedTour) fetchResults(selectedTour.tournament_name)
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(m =>
        (m.name || '').includes(memberSearch) ||
        (m.display_name || '').includes(memberSearch) ||
        (m.member_id || '').includes(memberSearch)
      ).slice(0, 10)
    : []

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">🏆 대회 결과 입력</h2>
        <p className="text-xs text-sub mt-0.5">대회 관리에서 생성된 대회를 선택하면 자동으로 연결됩니다.</p>
      </div>

      {/* 대회 선택 */}
      <div className="bg-white rounded-lg border border-line p-4 mb-4">
        <label className="block text-xs font-medium text-sub mb-2">대회 선택</label>
        <select
          value={events.find(e => e.tournament_id === selectedTour?.tournament_id)?.event_id || ''}
          onChange={e => handleEventSelect(e.target.value || null)}
          className="w-full text-sm border border-line rounded-lg px-3 py-2"
          disabled={loadingTour}
        >
          <option value="">대회를 선택하세요</option>
          {events.map(ev => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name} ({ev.event_date})
            </option>
          ))}
        </select>
        {loadingTour && (
          <p className="text-xs text-accent mt-1">대회 정보 연결 중...</p>
        )}
        {selectedTour && !loadingTour && (
          <p className="text-xs text-green-600 mt-1">
            ✅ {selectedTour.tournament_name} ({selectedTour.date}) 연결됨
          </p>
        )}
      </div>

      {/* 결과 입력 폼 */}
      {selectedTour && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">결과 입력: {selectedTour.tournament_name}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-sub mb-1">
                부서
                {selectedEvent?.event_type === 'team' && (
                  <span className="ml-1.5 text-[10px] text-blue-600 font-medium">단체전 부서</span>
                )}
                {selectedEvent?.event_type === 'both' && (
                  <span className="ml-1.5 text-[10px] text-purple-600 font-medium">개인+단체 통합</span>
                )}
              </label>
              <select value={resultForm.division}
                onChange={e => setResultForm({ ...resultForm, division: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">부서 선택</option>
                {selectedEvent?.event_type === 'team' ? (
                  teamDivisions.length > 0
                    ? teamDivisions.map(d => <option key={d} value={d}>{d}</option>)
                    : <option disabled>등록된 단체전 부서가 없습니다</option>
                ) : selectedEvent?.event_type === 'both' ? (
                  <>
                    {teamDivisions.length > 0 && (
                      <optgroup label="단체전 부서">
                        {teamDivisions.map(d => <option key={`t-${d}`} value={d}>{d}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="개인전 부서">
                      {pointRules.map(r => <option key={`i-${r.id}`} value={r.division}>{r.division}</option>)}
                    </optgroup>
                  </>
                ) : (
                  pointRules.map(r => <option key={r.id} value={r.division}>{r.division}</option>)
                )}
              </select>
            </div>
            {isTeamDivision ? (
              <div>
                <label className="block text-xs text-sub mb-1">팀(클럽) 선택</label>
                <select
                  value={resultForm.team_entry_id}
                  onChange={e => setResultForm({ ...resultForm, team_entry_id: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2">
                  <option value="">팀 선택</option>
                  {teamEntries
                    .filter(t => (t.division_name || '') === resultForm.division)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.club_name} (주장 {t.captain_name})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-sub mt-1">
                  선택한 팀의 모든 선수에게 동일한 순위/부서로 결과가 입력됩니다.
                </p>
              </div>
            ) : (
              <div className="relative">
                <label className="block text-xs text-sub mb-1">회원 검색</label>
                <input type="text" value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="이름 또는 ID 입력..."
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                {resultForm.member_id && (
                  <p className="text-xs text-accent mt-1">
                    선택: {members.find(m => m.member_id === resultForm.member_id)?.name}
                  </p>
                )}
                {filteredMembers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button key={m.member_id}
                        onClick={() => {
                          setResultForm({ ...resultForm, member_id: m.member_id })
                          setMemberSearch(m.display_name || m.name)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-soft border-b border-line/50">
                        {m.display_name || m.name} <span className="text-sub">({m.member_id})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs text-sub mb-1">순위</label>
              <select value={resultForm.rank}
                onChange={e => setResultForm({ ...resultForm, rank: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">순위 선택</option>
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {autoPoints !== null && (
              <div className="bg-accentSoft rounded-lg px-3 py-2">
                <span className="text-sm text-accent font-semibold">자동 포인트: +{autoPoints}</span>
              </div>
            )}
            <button onClick={handleAddResult}
              disabled={submitting}
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '입력 중...' : (isTeamDivision ? '팀 결과 일괄 입력' : '결과 입력')}
            </button>
          </div>
        </div>
      )}

      {/* 결과 목록 */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-soft2">
              <tr>
                <th className="px-3 py-2 text-left text-sub font-medium">이름</th>
                <th className="px-3 py-2 text-left text-sub font-medium">부서</th>
                <th className="px-3 py-2 text-left text-sub font-medium">순위</th>
                <th className="px-3 py-2 text-right text-sub font-medium">포인트</th>
                <th className="px-3 py-2 text-center text-sub font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="border-t border-line hover:bg-soft">
                  <td className="px-3 py-2">{r.member_name || r.member_id}</td>
                  <td className="px-3 py-2 text-sub">{r.division}</td>
                  <td className="px-3 py-2">{r.rank}</td>
                  <td className="px-3 py-2 text-right font-semibold text-accent">+{r.points}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handleDeleteResult(r.id)}
                      className="text-xs text-red-500 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
