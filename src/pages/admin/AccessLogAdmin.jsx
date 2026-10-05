import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PAGE_LABELS = {
  home: '홈',
  ranking: '랭킹',
  tournament: '대회결과',
  event: '이벤트',
  board: '게시판',
  notice: '공지사항',
  search: '선수검색',
  apply: '신청',
  'team-entry': '팀참가',
}

const PERIODS = [
  { label: '오늘', days: 0 },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '전체', days: null },
]

export default function AccessLogAdmin() {
  const [period, setPeriod] = useState(7)
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0, today_uv: 0, week_uv: 0, month_uv: 0, total_uv: 0 })
  const [daily, setDaily] = useState([])
  const [pageBreakdown, setPageBreakdown] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [searchKeywords, setSearchKeywords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [period])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchRecentLogs()])
    setLoading(false)
  }

  // 집계는 DB(rpc_access_stats)에서 한국시간 기준으로 계산 — 행을 받아 세면 1,000행 제한에 잘린다
  async function fetchStats() {
    const { data, error } = await supabase.rpc('rpc_access_stats', { p_days: period })
    if (error || !data) {
      setError(error?.message || '통계를 불러오지 못했습니다.')
      return
    }
    setError('')
    setStats(data.summary)
    setDaily(data.daily.map(d => ({ date: `${+d.date.slice(5, 7)}/${+d.date.slice(8, 10)}`, count: d.count, uv: d.uv })))
    const total = data.pages.reduce((sum, p) => sum + p.count, 0) || 1
    setPageBreakdown(data.pages.map(p => ({ ...p, pct: Math.round((p.count / total) * 100) })))
    setSearchKeywords(data.keywords)
  }

  async function fetchRecentLogs() {
    const { data } = await supabase
      .from('page_views')
      .select('*')
      .neq('page', 'search')
      .order('visited_at', { ascending: false })
      .limit(30)
    setRecentLogs(data || [])
  }

  function formatTime(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
      + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const maxDaily = Math.max(...daily.map(d => d.count), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">📈 접속 통계</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.days)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors
                ${period === p.days
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-sub border-line hover:bg-soft2'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '오늘', value: stats.today, uv: stats.today_uv },
          { label: '최근 7일', value: stats.week, uv: stats.week_uv },
          { label: '최근 30일', value: stats.month, uv: stats.month_uv },
          { label: '누적', value: stats.total, uv: stats.total_uv },
        ].map(s => (
          <div key={s.label} className="bg-soft rounded-xl p-4">
            <p className="text-xs text-sub mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}<span className="text-xs font-normal text-sub ml-1">회</span></p>
            <p className="text-xs text-sub mt-1">방문자 {s.uv.toLocaleString()}명</p>
          </div>
        ))}
      </div>

      {/* 일별 차트 */}
      <div className="bg-white border border-line rounded-xl p-4">
        <p className="text-xs font-medium text-gray-700 mb-3">
          일별 방문 추이 ({period === 0 ? '오늘' : period === null ? '최근 30일' : `최근 ${period}일`})
        </p>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-xs text-sub">로딩 중...</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {daily.map((d, i) => (
              // 막대가 많으면(30일) 칸이 좁아 숫자는 마우스 올릴 때만, 날짜는 5일 간격으로 표시
              <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center gap-1"
                title={`${d.date} · ${d.count.toLocaleString()}회 · 방문자 ${d.uv}명`}>
                <span className="text-[10px] text-sub whitespace-nowrap">
                  {daily.length <= 14 && d.count ? d.count.toLocaleString() : ' '}
                </span>
                <div
                  className="w-full bg-accent rounded-t-sm transition-all"
                  style={{ height: `${Math.max((d.count / maxDaily) * 96, d.count > 0 ? 4 : 0)}px` }}
                />
                <span className="text-[9px] text-sub whitespace-nowrap">
                  {daily.length <= 14 || i % 5 === 0 || i === daily.length - 1 ? d.date : ' '}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 페이지별 비율 + 최근 로그 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-xs font-medium text-gray-700 mb-3">페이지별 방문</p>
          {loading ? (
            <div className="text-xs text-sub">로딩 중...</div>
          ) : pageBreakdown.length === 0 ? (
            <div className="text-xs text-sub">데이터 없음</div>
          ) : (
            <div className="space-y-2">
              {pageBreakdown.map(p => (
                <div key={p.page}>
                  <div className="flex justify-between text-xs text-sub mb-1">
                    <span>{PAGE_LABELS[p.page] || p.page}</span>
                    <span>{p.count}회 ({p.pct}%)</span>
                  </div>
                  <div className="h-2 bg-soft rounded-full">
                    <div
                      className="h-2 bg-accent rounded-full"
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-xl p-4">
          <p className="text-xs font-medium text-gray-700 mb-3">최근 접속 기록</p>
          {loading ? (
            <div className="text-xs text-sub">로딩 중...</div>
          ) : recentLogs.length === 0 ? (
            <div className="text-xs text-sub">데이터 없음</div>
          ) : (
            <div className="overflow-y-auto max-h-64 space-y-1">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-soft last:border-0">
                  <span className="text-sub w-32 shrink-0">{formatTime(log.visited_at)}</span>
                  <span className="flex-1 text-center font-medium text-gray-700">
                    {PAGE_LABELS[log.page] || log.page}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0
                    ${log.device === 'mobile' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>
                    {log.device === 'mobile' ? '모바일' : 'PC'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 검색어 순위 */}
      <div className="bg-white border border-line rounded-xl p-4">
        <p className="text-xs font-medium text-gray-700 mb-3">검색어 순위 (상위 20개)</p>
        {loading ? (
          <div className="text-xs text-sub">로딩 중...</div>
        ) : searchKeywords.length === 0 ? (
          <div className="text-xs text-sub">데이터 없음</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {searchKeywords.map((k, i) => (
              <div key={k.keyword} className="flex items-center gap-2 bg-soft rounded-lg px-3 py-2">
                <span className={`text-xs font-bold shrink-0 w-4 text-center
                  ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-sub'}`}>
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 truncate flex-1">{k.keyword}</span>
                <span className="text-xs text-sub shrink-0">{k.count}회</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
