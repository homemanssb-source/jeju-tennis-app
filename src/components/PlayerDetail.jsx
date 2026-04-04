import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'
import { SkeletonLine } from './Skeleton'

export default function PlayerDetail({ memberId, open, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear())
  const [currentRank, setCurrentRank] = useState(null)
  const [externalHistory, setExternalHistory] = useState([])
  const [histTab, setHistTab] = useState('jta')

  useEffect(() => {
    if (!memberId || !open) return
    fetchAll(seasonYear)
  }, [memberId, open, seasonYear])

  async function fetchAll(year) {
    setLoading(true)
    setCurrentRank(null)
    setHistTab('jta')

    const [{ data: result, error }, { data: extData }] = await Promise.all([
      supabase.rpc('get_member_history', { p_member_id: memberId, p_season_year: year }),
      supabase.from('external_report_log')
        .select('*')
        .eq('member_id', memberId)
        .order('tournament_date', { ascending: false }),
    ])

    if (!error && result?.ok) {
      setData(result)
      if (result.member?.division) {
        fetchRank(result.member.division, year, memberId)
      }
    }
    setExternalHistory(extData || [])
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
    setExternalHistory([])
    setHistTab('jta')
    onClose()
  }

  const member = data?.member
  const history = data?.history || []

  const currentYear = new Date().getFullYear()
  const seasonOptions = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i)

  const pendingExtCount = externalHistory.filter(h => !h.admin_applied).length

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
          {/* ── 프로필 헤더 ── */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                {member.display_name || member.name}
              </span>
              {member.grade && (
                <span className="px-2 py-0.5 bg-accentSoft text-accent text-xs font-semibold rounded-full">
                  등급 {member.grade}
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
                    <p className="text-2xl font-bold text-gray-900">
                      {currentRank}<span className="text-sm font-medium text-sub">위</span>
                    </p>
                  ) : (
                    <p className="text-lg font-bold text-sub">-</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 시즌 선택 ── */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-700">시즌:</span>
            <select value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))}
              className="text-sm border border-line rounded-lg px-3 py-1.5 bg-white">
              {seasonOptions.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>

          {/* ── JTA / 외부대회 탭 ── */}
          <div className="flex border-b border-line mb-3">
            <button
              onClick={() => setHistTab('jta')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative
                ${histTab === 'jta' ? 'text-accent' : 'text-sub'}`}>
              JTA 대회
              {histTab === 'jta' && (
                <span className="absolute bottom-0 left-[15%] right-[15%] h-0.5 bg-accent rounded-full" />
              )}
            </button>
            <button
              onClick={() => setHistTab('external')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative
                ${histTab === 'external' ? 'text-accent' : 'text-sub'}`}>
              외부대회
              {pendingExtCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-400 text-white rounded-full">
                  {pendingExtCount}
                </span>
              )}
              {histTab === 'external' && (
                <span className="absolute bottom-0 left-[15%] right-[15%] h-0.5 bg-accent rounded-full" />
              )}
            </button>
          </div>

          {/* ── JTA 대회 이력 ── */}
          {histTab === 'jta' && (
            <div>
              {history.length === 0 ? (
                <p className="text-sm text-sub py-4 text-center">해당 시즌 대회 기록이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-start justify-between py-2.5 px-3 bg-soft rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{h.tournament_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-sub">{h.date} · {h.division}</p>
                          {h.grade && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              출전등급 {h.grade}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{h.rank}</p>
                        <p className="text-xs text-accent font-medium">+{h.points}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 외부대회 이력 ── */}
          {histTab === 'external' && (
            <div>
              {externalHistory.length === 0 ? (
                <p className="text-sm text-sub py-4 text-center">외부대회 신고 내역이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {externalHistory.map(h => (
                    <div key={h.id} className="py-2.5 px-3 bg-soft rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded
                              ${h.tournament_type === '전국대회'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-blue-50 text-blue-600'}`}>
                              {h.tournament_type}
                            </span>
                            <span className="text-[10px] text-sub">{h.tournament_date}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{h.tournament_name}</p>
                          {h.tournament_division && (
                            <p className="text-xs text-sub mt-0.5">{h.tournament_division}</p>
                          )}
                          {h.admin_applied && h.expected_grade &&
                           Number(h.expected_grade) !== Number(h.before_grade) && (
                            <div className="inline-flex items-center gap-1 mt-1 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                              <span className="text-[10px] font-semibold text-green-700">
                                {h.before_grade} → {h.expected_grade}
                              </span>
                            </div>
                          )}
                          <p className={`text-[10px] mt-1 ${h.admin_applied ? 'text-green-600' : 'text-amber-600'}`}>
                            {h.admin_applied ? '✅ 등급 반영 완료' : '🟡 관리자 검토중'}
                          </p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                            ${h.result === '우승' ? 'bg-yellow-100 text-yellow-700' :
                              h.result === '준우승' ? 'bg-gray-100 text-gray-600' :
                              'bg-soft2 text-sub'}`}>
                            {h.result}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-sub text-center py-8">회원 정보를 불러올 수 없습니다.</p>
      )}
    </BottomSheet>
  )
}
