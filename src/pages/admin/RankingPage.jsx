import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import PlayerDetail from '../../components/PlayerDetail'
import { SkeletonList } from '../../components/Skeleton'
import { ToastContext } from '../../App'

const medals = ['🥇', '🥈', '🥉']

export default function RankingPage() {
  const showToast = useContext(ToastContext)
  const [divisions, setDivisions] = useState([])
  const [division, setDivision] = useState('')
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [seasons, setSeasons] = useState([])
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  useEffect(() => { fetchSeasons(); fetchDivisions() }, [])
  useEffect(() => { if (division) fetchRankings() }, [division, seasonYear])

  async function fetchDivisions() {
    const { data } = await supabase
      .from('members')
      .select('division')
      .not('division', 'is', null)
      .neq('division', '')
    if (data) {
      const unique = [...new Set(data.map(m => m.division).filter(Boolean))].sort()
      setDivisions(unique)
      if (unique.length > 0) setDivision(unique[0])
    }
  }

  async function fetchSeasons() {
    const { data } = await supabase.rpc('get_available_seasons')
    if (data) setSeasons(data.map(d => d.season_year))
  }

  async function fetchRankings() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_rankings', {
      p_division: division, p_season_year: seasonYear, p_limit: 50, p_offset: 0,
    })
    if (error) showToast?.('랭킹 조회 실패', 'error')
    else setRankings(data || [])
    setLoading(false)
  }

  return (
    <div className="pb-20">
      <PageHeader title="🏆 랭킹" subtitle="제주시테니스협회" />
      <div className="px-5 py-3 space-y-2 max-w-lg mx-auto">
        <div className="flex gap-2">
          <select value={division} onChange={e => setDivision(e.target.value)}
            className="flex-1 text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))}
            className="text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            {seasons.length > 0
              ? seasons.map(y => <option key={y} value={y}>{y}시즌</option>)
              : <option value={seasonYear}>{seasonYear}시즌</option>}
          </select>
        </div>
      </div>
      <div className="max-w-lg mx-auto">
        {loading ? <SkeletonList count={8} /> : rankings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎾</p>
            <p className="text-sm text-sub">{division ? '해당 부서의 랭킹 데이터가 없습니다.' : '부서를 선택해주세요.'}</p>
          </div>
        ) : (
          <div className="px-4">
            {rankings.map((player, idx) => (
              <button key={player.member_id} onClick={() => setSelectedMember(player.member_id)}
                className="w-full flex items-center gap-3 py-3 px-2 border-b border-line/50 hover:bg-soft transition-colors text-left">
                <div className="w-8 text-center shrink-0">
                  {idx < 3 ? <span className="text-xl">{medals[idx]}</span> : <span className="text-sm font-bold text-sub">{idx + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{player.display_name || player.name}</span>
                    {player.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{player.grade}</span>}
                  </div>
                  <p className="text-xs text-sub mt-0.5 truncate">{player.club || '-'} · 참가 {player.tournament_count}회</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${idx < 3 ? 'text-accent' : 'text-gray-900'}`}>{player.total_points.toLocaleString()}</p>
                  <p className="text-[10px] text-sub">점</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <PlayerDetail memberId={selectedMember} open={!!selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}