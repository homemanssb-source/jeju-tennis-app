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

  return (
    <BottomSheet open={open} onClose={handleClose} title={'\uD68C\uC6D0 \uC0C1\uC138'}>
      {loading ? (
        <div className="space-y-4">
          <SkeletonLine className="w-1/3 h-6" />
          <SkeletonLine className="w-2/3 h-4" />
          <SkeletonLine className="w-1/2 h-4" />
          <div className="mt-6 space-y-3">
            {[1,2,3].map(i => <SkeletonLine key={i} className="w-full h-10" />)}
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
              {member.club && <p>{'\uC18C\uC18D: ' + member.club}</p>}
              {member.division && <p>{'\uB7AD\uD0B9\uBD80\uC11C: ' + member.division}</p>}
              <p>{'\uC0C1\uD0DC: ' + member.status}</p>
            </div>
            {data.total_points !== undefined && (
              <div className="mt-3 flex gap-3">
                <div className="flex-1 bg-soft rounded-lg px-4 py-3">
                  <span className="text-xs text-sub">{data.season_year + '\uC2DC\uC98C \uCD1D \uD3EC\uC778\uD2B8'}</span>
                  <p className="text-2xl font-bold text-accent">{data.total_points.toLocaleString()}</p>
                </div>
                <div className="bg-soft rounded-lg px-4 py-3 text-center min-w-[90px]">
                  <span className="text-xs text-sub">{'\uD604\uC7AC \uB7AD\uD0B9'}</span>
                  {currentRank ? (
                    <p className="text-2xl font-bold text-gray-900">{currentRank}<span className="text-sm font-medium text-sub">{'\uC704'}</span></p>
                  ) : (
                    <p className="text-lg font-bold text-sub">-</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-700">{'\uC2DC\uC98C:'}</span>
            <select value={seasonYear} onChange={(e) => setSeasonYear(Number(e.target.value))}
              className="text-sm border border-line rounded-lg px-3 py-1.5 bg-white">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y + '\uB144'}</option>
              ))}
            </select>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">{'\uB300\uD68C \uC774\uB825'}</h4>
            {history.length === 0 ? (
              <p className="text-sm text-sub py-4 text-center">{'\uD574\uB2F9 \uC2DC\uC98C \uB300\uD68C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-soft rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.tournament_name}</p>
                      <p className="text-xs text-sub mt-0.5">{h.date + ' \u00B7 ' + h.division}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{h.rank}</p>
                      <p className="text-xs text-accent font-medium">{'+' + h.points}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-sub text-center py-8">{'\uD68C\uC6D0 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'}</p>
      )}
    </BottomSheet>
  )
}
