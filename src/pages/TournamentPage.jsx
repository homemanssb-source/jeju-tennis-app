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
  const [expandedClubs, setExpandedClubs] = useState(new Set())

  function toggleClub(key) {
    setExpandedClubs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

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

  // club_name이 있는 행은 (division, rank, club_name) 단위로 묶고,
  // 없는 행은 개별 표시 (개인전). 정렬은 division → rank 순.
  const displayItems = (() => {
    const groups = {}
    const individuals = []
    for (const r of results) {
      if (r.club_name) {
        const key = `${r.division}|${r.rank}|${r.club_name}`
        if (!groups[key]) groups[key] = { type: 'team', key, division: r.division, rank: r.rank, club_name: r.club_name, points: r.points, members: [] }
        groups[key].members.push(r)
      } else {
        individuals.push({ type: 'individual', ...r })
      }
    }
    const all = [...Object.values(groups), ...individuals]
    all.sort((a, b) => {
      if ((a.division || '') !== (b.division || '')) return (a.division || '').localeCompare(b.division || '')
      return (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99)
    })
    return all
  })()

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
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-sub">등록된 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="px-4">
            <p className="text-xs text-sub px-1 mb-2">총 {displayItems.length}건</p>
            {displayItems.map((item, i) => {
              const showDivHeader = i === 0 || displayItems[i - 1].division !== item.division
              return (
                <div key={item.type === 'team' ? item.key : (item.id || i)}>
                  {showDivHeader && (
                    <div className="bg-soft2 px-3 py-1.5 mt-3 first:mt-0 rounded-lg mb-1">
                      <span className="text-xs font-semibold text-gray-700">{item.division}</span>
                    </div>
                  )}

                  {item.type === 'team' ? (
                    <div className="border-b border-line/30">
                      <button onClick={() => toggleClub(item.key)}
                        className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-soft transition-colors text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded
                            ${item.rank === '우승' ? 'bg-yellow-100 text-yellow-700' :
                              item.rank === '준우승' ? 'bg-gray-100 text-gray-700' :
                              'bg-soft2 text-sub'}`}>
                            {item.rank}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {item.club_name}
                          </span>
                          <span className="text-[10px] text-sub">({item.members.length}명)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-accent">+{item.points}</span>
                          <span className={`text-xs text-sub transition-transform ${expandedClubs.has(item.key) ? 'rotate-90' : ''}`}>›</span>
                        </div>
                      </button>
                      {expandedClubs.has(item.key) && (
                        <div className="bg-soft/50 pb-1">
                          {item.members.map(m => (
                            <button key={m.id}
                              onClick={() => setSelectedMember(m.member_id)}
                              className="w-full flex items-center justify-between py-2 pl-10 pr-3
                                hover:bg-soft transition-colors text-left border-t border-line/20">
                              <span className="text-sm text-gray-800">{m.member_name || m.member_id}</span>
                              <span className="text-xs text-accent">+{m.points}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setSelectedMember(item.member_id)}
                      className="w-full flex items-center justify-between py-2.5 px-3
                        hover:bg-soft transition-colors text-left border-b border-line/30">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded
                          ${item.rank === '우승' ? 'bg-yellow-100 text-yellow-700' :
                            item.rank === '준우승' ? 'bg-gray-100 text-gray-700' :
                            'bg-soft2 text-sub'}`}>
                          {item.rank}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.member_name || item.member_id}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-accent">+{item.points}</span>
                    </button>
                  )}
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
