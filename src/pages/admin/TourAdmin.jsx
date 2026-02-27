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
  const [tournaments, setTournaments] = useState([])
  const [pointRules, setPointRules] = useState([])
  const [results, setResults] = useState([])
  const [members, setMembers] = useState([])
  const [showTourForm, setShowTourForm] = useState(false)
  const [tourForm, setTourForm] = useState({ tournament_name: '', date: '' })
  const [selectedTour, setSelectedTour] = useState(null)
  const [resultForm, setResultForm] = useState({ member_id: '', rank: '', division: '' })
  const [memberSearch, setMemberSearch] = useState('')
  const [autoPoints, setAutoPoints] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: tours }, { data: rules }, { data: mems }] = await Promise.all([
      supabase.from('tournaments_master').select('*').order('date', { ascending: false }),
      supabase.from('point_rules').select('*'),
      supabase.from('members').select('member_id, name, display_name, division').eq('status', '활성').order('name'),
    ])
    setTournaments(tours || [])
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

  useEffect(() => { setAutoPoints(calcPoints(resultForm.division, resultForm.rank)) }, [resultForm.division, resultForm.rank])

  async function handleAddTour() {
    if (!tourForm.tournament_name || !tourForm.date) { showToast?.('대회명과 날짜는 필수입니다.', 'error'); return }
    const year = tourForm.date.substring(0, 4)
    const { error } = await supabase.from('tournaments_master').insert([{
      tournament_name: tourForm.tournament_name,
      date: tourForm.date,
      year: year,
    }])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.('대회가 추가되었습니다.')
    setShowTourForm(false); setTourForm({ tournament_name: '', date: '' }); fetchAll()
  }

  async function handleAddResult() {
    if (!selectedTour || !resultForm.member_id || !resultForm.rank || !resultForm.division) {
      showToast?.('대회, 회원, 부서, 순위를 모두 선택해주세요.', 'error'); return
    }
    const member = members.find(m => m.member_id === resultForm.member_id)
    const points = autoPoints || 0
    const seasonYear = new Date(selectedTour.date).getFullYear()

    const { error } = await supabase.from('tournament_results').insert([{
      tournament_name: selectedTour.tournament_name, date: selectedTour.date,
      member_id: resultForm.member_id, member_name: member?.display_name || member?.name || '',
      division: resultForm.division, rank: resultForm.rank, points, season_year: seasonYear,
    }])
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.(`${member?.name} ${resultForm.rank} +${points}점 입력완료`)
    setResultForm({ ...resultForm, member_id: '', rank: '' }); setMemberSearch('')
    fetchResults(selectedTour.tournament_name)
  }

  async function handleDeleteResult(id) {
    if (!confirm('이 결과를 삭제하시겠습니까?')) return
    await supabase.from('tournament_results').delete().eq('id', id)
    showToast?.('삭제되었습니다.')
    if (selectedTour) fetchResults(selectedTour.tournament_name)
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter(m => (m.name || '').includes(memberSearch) || (m.display_name || '').includes(memberSearch) || (m.member_id || '').includes(memberSearch)).slice(0, 10)
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🏆 대회 결과 입력</h2>
        <button onClick={() => setShowTourForm(!showTourForm)}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ 대회 추가</button>
      </div>

      {showTourForm && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="대회명" value={tourForm.tournament_name}
              onChange={e => setTourForm({ ...tourForm, tournament_name: e.target.value })}
              className="text-sm border border-line rounded-lg px-3 py-2" />
            <input type="date" value={tourForm.date}
              onChange={e => setTourForm({ ...tourForm, date: e.target.value })}
              className="text-sm border border-line rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddTour} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">저장</button>
            <button onClick={() => setShowTourForm(false)} className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-line p-4 mb-4">
        <label className="block text-xs font-medium text-sub mb-2">대회 선택</label>
        <select
          value={selectedTour?.tournament_id || ''}
          onChange={e => {
            const t = tournaments.find(t => t.tournament_id === e.target.value)
            setSelectedTour(t || null)
            if (t) { fetchResults(t.tournament_name); setResultForm({ ...resultForm, division: '' }) }
          }}
          className="w-full text-sm border border-line rounded-lg px-3 py-2">
          <option value="">대회를 선택하세요</option>
          {tournaments.map(t => (
            <option key={t.tournament_id} value={t.tournament_id}>{t.tournament_name} ({t.date})</option>
          ))}
        </select>
      </div>

      {selectedTour && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4">
          <h3 className="text-sm font-semibold mb-3">결과 입력: {selectedTour.tournament_name}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-sub mb-1">부서</label>
              <select value={resultForm.division} onChange={e => setResultForm({ ...resultForm, division: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">부서 선택</option>
                {pointRules.map(r => <option key={r.id} value={r.division}>{r.division}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs text-sub mb-1">회원 검색</label>
              <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder="이름 또는 ID 입력..." className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              {resultForm.member_id && (
                <p className="text-xs text-accent mt-1">선택: {members.find(m => m.member_id === resultForm.member_id)?.name}</p>
              )}
              {filteredMembers.length > 0 && (
                <div className="absolute left-0 right-0 top-full bg-white border border-line rounded-lg shadow-lg mt-1 z-10 max-h-40 overflow-y-auto">
                  {filteredMembers.map(m => (
                    <button key={m.member_id}
                      onClick={() => { setResultForm({ ...resultForm, member_id: m.member_id }); setMemberSearch(m.display_name || m.name) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-soft border-b border-line/50">
                      {m.display_name || m.name} <span className="text-sub">({m.member_id})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">순위</label>
              <select value={resultForm.rank} onChange={e => setResultForm({ ...resultForm, rank: e.target.value })}
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
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">결과 입력</button>
          </div>
        </div>
      )}

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
                    <button onClick={() => handleDeleteResult(r.id)} className="text-xs text-red-500 hover:underline">삭제</button>
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
