import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import PlayerDetail from '../components/PlayerDetail'
import { SkeletonList } from '../components/Skeleton'
import { ToastContext } from '../App'
import { formatGrade } from '../lib/grade'

const medals = ['🥇', '🥈', '🥉']
const MY_NAME_KEY = 'jta_my_rank_name'

// 동점자는 같은 순위 (1, 2, 2, 4 …) — 포인트 0 인 선수는 순위에서 제외
function withRanks(list) {
  const ranked = list.filter(p => p.total_points > 0)
  let prevPoints = null
  let prevRank = 0
  return ranked.map((p, i) => {
    const rank = p.total_points === prevPoints ? prevRank : i + 1
    prevPoints = p.total_points
    prevRank = rank
    return { ...p, rank }
  })
}

function readSavedName() {
  try { return localStorage.getItem(MY_NAME_KEY) || '' } catch { return '' }
}

export default function RankingPage() {
  const showToast = useContext(ToastContext)
  const [divisions, setDivisions] = useState([])
  const [division, setDivision] = useState('')
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [seasons, setSeasons] = useState([])
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  // 내 순위 찾기
  const [showMy, setShowMy] = useState(false)
  const [myName, setMyName] = useState(readSavedName)
  const [myResults, setMyResults] = useState(null)
  const [myLoading, setMyLoading] = useState(false)

  useEffect(() => { fetchSeasons(); fetchDivisions() }, [])
  useEffect(() => { if (division) fetchRankings() }, [division, seasonYear])
  // 시즌을 바꾸면 이전 시즌 기준 결과는 지움
  useEffect(() => { setMyResults(null) }, [seasonYear])

  async function fetchDivisions() {
    // members 테이블에서 실제 사용 중인 부서 목록 동적 로드
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
    else setRankings(withRanks(data || []).slice(0, 10))
    setLoading(false)
  }

  async function findMyRank(e) {
    e?.preventDefault()
    const q = myName.trim()
    if (q.length < 2) { showToast?.('이름을 2글자 이상 입력해주세요', 'warning'); return }
    setMyLoading(true)
    try { localStorage.setItem(MY_NAME_KEY, q) } catch { /* 저장 실패 무시 */ }

    const { data: members, error } = await supabase
      .from('members_public')
      .select('member_id, name, display_name, club, division, grade')
      .or(`name.eq.${q},display_name.eq.${q}`)
    if (error) { showToast?.('조회 실패', 'error'); setMyLoading(false); return }

    // 부서별로 한 번씩만 전체 랭킹 조회
    const divs = [...new Set((members || []).map(m => m.division).filter(Boolean))]
    const byDiv = {}
    await Promise.all(divs.map(async d => {
      const { data } = await supabase.rpc('get_rankings', {
        p_division: d, p_season_year: seasonYear, p_limit: 2000, p_offset: 0,
      })
      byDiv[d] = withRanks(data || [])
    }))

    setMyResults((members || []).map(m => {
      const list = byDiv[m.division] || []
      const me = list.find(p => p.member_id === m.member_id)
      return { ...m, rank: me?.rank ?? null, points: me?.total_points ?? 0, total: list.length }
    }))
    setMyLoading(false)
  }

  return (
    <div className="pb-20">
      <PageHeader title="🏆 랭킹" subtitle="제주시테니스협회"
        right={
          <button onClick={() => setShowMy(v => !v)}
            className={`text-sm font-semibold px-3 py-2 rounded-lg transition-colors
              ${showMy ? 'bg-accent text-white' : 'bg-accentSoft text-accent'}`}>
            🙋 내 순위 찾기
          </button>
        } />
      <div className="px-5 py-3 space-y-3 max-w-lg mx-auto">
        {showMy && (
          <div className="bg-soft rounded-xl p-3 space-y-3">
            <form onSubmit={findMyRank} className="flex gap-2">
              <input type="search" enterKeyHint="search" value={myName}
                onChange={e => setMyName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="flex-1 min-w-0 text-sm border border-line rounded-lg px-3 py-2.5 bg-white" />
              <button type="submit" disabled={myLoading}
                className="shrink-0 px-4 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50">
                {myLoading ? '찾는 중' : '찾기'}
              </button>
            </form>

            {myResults && (myResults.length === 0 ? (
              <p className="text-sm text-sub text-center py-2">등록된 회원 중 "{myName.trim()}" 님을 찾지 못했어요.</p>
            ) : (
              <div className="space-y-2">
                {myResults.map(m => (
                  <div key={m.member_id} className="bg-white rounded-lg border border-line p-3">
                    <button onClick={() => setSelectedMember(m.member_id)} className="w-full flex items-center gap-3 text-left">
                      <div className="w-14 shrink-0 text-center">
                        {m.rank
                          ? <>
                              <p className="text-xl font-black text-accent leading-none">{m.rank}<span className="text-sm">위</span></p>
                              <p className="text-[11px] text-sub mt-1">/ {m.total}명</p>
                            </>
                          : <p className="text-xs text-sub leading-tight">순위<br />없음</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900 truncate">{m.display_name || m.name}</span>
                          {m.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[11px] font-medium rounded shrink-0">{formatGrade(m.grade)}</span>}
                        </div>
                        <p className="text-xs text-sub mt-0.5 truncate">{m.club || '-'} · {m.division || '부서 없음'}</p>
                        <p className="text-xs mt-0.5">
                          {m.rank
                            ? <span className="font-semibold text-gray-800">{m.points.toLocaleString()}점</span>
                            : <span className="text-sub">{seasonYear}시즌 획득 포인트가 없어요</span>}
                        </p>
                      </div>
                      <span className="text-sub shrink-0">›</span>
                    </button>
                    {m.division && m.division !== division && divisions.includes(m.division) && (
                      <button onClick={() => setDivision(m.division)}
                        className="mt-2 w-full text-xs text-accent font-medium py-2 rounded-lg bg-accentSoft">
                        {m.division} 랭킹 보기
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <select value={division} onChange={e => setDivision(e.target.value)}
            className="flex-1 min-w-0 text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))}
            className="shrink-0 text-sm border border-line rounded-lg px-3 py-2 bg-white font-medium">
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
            {rankings.map(player => (
              <button key={player.member_id} onClick={() => setSelectedMember(player.member_id)}
                className="w-full flex items-center gap-3 py-3 px-2 border-b border-line/50 hover:bg-soft transition-colors text-left">
                <div className="w-8 text-center shrink-0">
                  {player.rank <= 3
                    ? <span className="text-xl">{medals[player.rank - 1]}</span>
                    : <span className="text-sm font-bold text-sub">{player.rank}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{player.display_name || player.name}</span>
                    {player.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[11px] font-medium rounded shrink-0">{formatGrade(player.grade)}</span>}
                  </div>
                  <p className="text-xs text-sub mt-0.5 truncate">{player.club || '-'} · 참가 {player.tournament_count}회</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${player.rank <= 3 ? 'text-accent' : 'text-gray-900'}`}>{player.total_points.toLocaleString()}</p>
                  <p className="text-[11px] text-sub">점</p>
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
