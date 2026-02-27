import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import PlayerDetail from '../components/PlayerDetail'
import { SkeletonList } from '../components/Skeleton'

export default function TournamentPage() {
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [divisions, setDivisions] = useState([])
  const [selectedDivision, setSelectedDivision] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  useEffect(() => { fetchTournaments() }, [seasonYear])
  useEffect(() => { if (selectedTournament) fetchResults() }, [selectedTournament, selectedDivision])

  async function fetchTournaments() {
    const { data } = await supabase
      .from('tournaments_master')
      .select('tournament_id, tournament_name, date')
      .gte('date', `${seasonYear}-01-01`)
      .lte('date', `${seasonYear}-12-31`)
      .order('date', { ascending: false })

    setTournaments(data || [])
    setSelectedTournament('')
    setResults([])
  }

  async function fetchResults() {
    setLoading(true)
    let query = supabase
      .from('tournament_results')
      .select('*')
      .eq('tournament_name', selectedTournament)
      .eq('season_year', seasonYear)
      .order('division')
      .order('points', { ascending: false })

    if (selectedDivision) query = query.eq('division', selectedDivision)

    const { data } = await query
    setResults(data || [])

    if (data) {
      const divs = [...new Set(data.map(r => r.division).filter(Boolean))]
      setDivisions(divs)
    }
    setLoading(false)
  }

  const rankOrder = { '우승': 1, '준우승': 2, '4강': 3, '8강': 4, '16강': 5, '32강': 6, '참가': 7 }
  const sortedResults = [...results].sort((a, b) => {
    if (a.division !== b.division) return (a.division || '').localeCompare(b.division || '')
    return (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99)
  })

  return (
    <div className="pb-20">
      <PageHeader title="📅 대회" subtitle="대회 결과 조회" />

      <div className="px-5 py-3 space-y-2 max-w-lg mx-auto">
        <div className="flex gap-2">
          <select value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))}
            className="text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            <option value="">대회 선택</option>
            {tournaments.map(t => (
              <option key={t.tournament_id} value={t.tournament_name}>
                {t.tournament_name}
              </option>
            ))}
          </select>
        </div>
        {divisions.length > 0 && (
          <select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            <option value="">전체 부서</option>
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="max-w-lg mx-auto">
        {!selectedTournament ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm text-sub">대회를 선택해주세요.</p>
          </div>
        ) : loading ? (
          <SkeletonList count={8} />
        ) : sortedResults.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-sub">등록된 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="px-4">
            <p className="text-xs text-sub px-1 mb-2">총 {sortedResults.length}건</p>
            {sortedResults.map((r, i) => {
              const showDivHeader = i === 0 || sortedResults[i - 1].division !== r.division
              return (
                <div key={r.id || i}>
                  {showDivHeader && (
                    <div className="bg-soft2 px-3 py-1.5 mt-3 first:mt-0 rounded-lg mb-1">
                      <span className="text-xs font-semibold text-gray-700">{r.division}</span>
                    </div>
                  )}
                  <button onClick={() => setSelectedMember(r.member_id)}
                    className="w-full flex items-center justify-between py-2.5 px-3
                      hover:bg-soft transition-colors text-left border-b border-line/30">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded
                        ${r.rank === '우승' ? 'bg-yellow-100 text-yellow-700' :
                          r.rank === '준우승' ? 'bg-gray-100 text-gray-700' :
                          'bg-soft2 text-sub'}`}>
                        {r.rank}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {r.member_name || r.member_id}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-accent">+{r.points}</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PlayerDetail memberId={selectedMember} open={!!selectedMember}
        onClose={() => setSelectedMember(null)} />
    </div>
  )
}
