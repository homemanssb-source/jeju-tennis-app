import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'
import { SkeletonLine } from './Skeleton'

export default function PlayerDetail({ memberId, open, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [currentRank, setCurrentRank] = useState(null)

  useEffect(() => {
    if (!memberId || !open) return
    fetchDetail(seasonYear)
  }, [memberId, open, seasonYear])

  async function fetchDetail(year) {
    setLoading(true)
    setCurrentRank(null)
    const { data: result, error } = await supabase.rpc('get_member_history', {
      p_member_id: memberId,
      p_season_year: year,
    })
    if (!error && result?.ok) {
      setData(result)
      if (result.member?.division) {
        fetchRank(result.member.division, year, memberId)
      }
    }
    setLoading(false)
  }

  async function fetchRank(division, year, mid) {
    const { data: rankings } = await supabase.rpc('get_rankings', {
      p_division: division, p_season_year: year, p_limit: 100, p_offset: 0,
    })
    if (rankings) {
      const filtered = rankings.filter(p => p.total_points > 0)
      const idx = filtered.findIndex(p => p.member_id === mid)
      if (idx >= 0) setCurrentRank(idx + 1)
    }
  }

  function handleClose() {
    setData(null)
    setCurrentRank(null)
    setSeasonYear(new Date().getFullYear())
    onClose()
  }

  const member = data?.member
  const history = data?.history || []

  // ✅ 시즌 선택 수정: 과거 3년 + 올해 + 내년 (총 5개)
  const currentYear = new Date().getFullYear()
  const seasonOptions = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i)
  // 결과: [내년, 올해, 작년, 2년전, 3년전]

  return (
    <BottomSheet open={open} onClose={handleClose} title="회원 상세">
      {loading ? (
        <div className="space-y-4">
          <SkeletonLine className="w-1/3 h-6" />
          <SkeletonLine className="w-2/3 h-4" />
          <SkeletonLine className="w-1/2 h-4" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map(i => <SkeletonLine key={i} className="w-full h-10" />)}
          </div>
        </div>
      ) : member ? (
        <div>
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                {member.display_name || member.name}
              </span>
              {member.grade && (
                <span className="px-2 py-0.5 bg-accentSoft text-accent text-xs font-semibold rounded-full">
                  {member.grade}
                </span>
              )}
            </div>
            <div className="text-sm text-sub space-y-1">
              {member.club && <p>소속: {member.club}</p>}
              {member.division && <p>랭킹부서: {member.division}</p>}
              <p>상태: {member.status}</p>
            </div>
            {data.total_points !== undefined && (
              <div className="mt-3 flex gap-3">
                <div className="flex-1 bg-soft rounded-lg px-4 py-3">
                  <span className="text-xs text-sub">{data.season_year}시즌 총 포인트</span>
                  <p className="text-2xl font-bold text-accent">{data.total_points.toLocaleString()}</p>
                </div>
                <div className="bg-soft rounded-lg px-4 py-3 text-center min-w-[90px]">
                  <span className="text-xs text-sub">현재 랭킹</span>
                  {currentRank ? (
                    <p className="text-2xl font-bold text-gray-900">{currentRank}<span className="text-sm font-medium text-sub">위</span></p>
                  ) : (
                    <p className="text-lg font-bold text-sub">-</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ✅ 시즌 선택 - 과거 연도 포함 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-700">시즌:</span>
            <select
              value={seasonYear}
              onChange={e => setSeasonYear(Number(e.target.value))}
              className="text-sm border border-line rounded-lg px-3 py-1.5 bg-white"
            >
              {seasonOptions.map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">대회 이력</h4>
            {history.length === 0 ? (
              <p className="text-sm text-sub py-4 text-center">해당 시즌 대회 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-soft rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.tournament_name}</p>
                      <p className="text-xs text-sub mt-0.5">{h.date} · {h.division}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{h.rank}</p>
                      <p className="text-xs text-accent font-medium">+{h.points}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-sub text-center py-8">회원 정보를 불러올 수 없습니다.</p>
      )}
    </BottomSheet>
  )
}