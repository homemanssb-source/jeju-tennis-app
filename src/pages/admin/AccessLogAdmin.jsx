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
  { label: '전체', days: 9999 },
]

function getStartDate(days) {
  if (days === 9999) return null
  const d = new Date()
  if (days === 0) {
    d.setHours(0, 0, 0, 0)
  } else {
    d.setDate(d.getDate() - days)
    d.setHours(0, 0, 0, 0)
  }
  return d.toISOString()
}

export default function AccessLogAdmin() {
  const [period, setPeriod] = useState(7)
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0 })
  const [daily, setDaily] = useState([])
  const [pageBreakdown, setPageBreakdown] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [searchKeywords, setSearchKeywords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [period])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchStats(), fetchDaily(), fetchPageBreakdown(), fetchRecentLogs(), fetchSearchKeywords()])
    setLoading(false)
  }

  async function fetchStats() {
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    const monthStart = new Date(now)
    monthStart.setDate(now.getDate() - 30)

    const [todayRes, weekRes, monthRes, totalRes] = await Promise.all([
      supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('visited_at', todayStart.toISOString()),
      supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('visited_at', weekStart.toISOString()),
      supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('visited_at', monthStart.toISOString()),
      supabase.from('page_views').select('id', { count: 'exact', head: true }),
    ])

    setStats({
      today: todayRes.count ?? 0,
      week: weekRes.count ?? 0,
      month: monthRes.count ?? 0,
      total: totalRes.count ?? 0,
    })
  }

  async function fetchDaily() {
    const start = getStartDate(period === 9999 ? 30 : period === 0 ? 1 : period)
    let query = supabase.from('page_views').select('visited_at')
    if (start) query = query.gte('visited_at', start)

    const { data } = await query
    if (!data) return

    const grouped = {}
    data.forEach(row => {
      const date = row.visited_at.slice(0, 10)
      grouped[date] = (grouped[date] || 0) + 1
    })

    const days = period === 0 ? 1 : period === 9999 ? 30 : period
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      result.push({ date: key.slice(5), count: grouped[key] || 0 })
    }
    setDaily(result)
  }

  async function fetchPageBreakdown() {
    const start = getStartDate(period === 0 ? 0 : period)
    let query = supabase.from('page_views').select('page')
    if (start) query = query.gte('visited_at', start)

    const { data } = await query
    if (!data) return

    const grouped = {}
    data.forEach(row => {
      grouped[row.page] = (grouped[row.page] || 0) + 1
    })

    const total = data.length || 1
    const sorted = Object.entries(grouped)
      .map(([page, count]) => ({ page, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)

    setPageBreakdown(sorted)
  }

  async function fetchRecentLogs() {
    const { data } = await supabase
      .from('page_views')
      .select('*')
      .order('visited_at', { ascending: false })
      .limit(30)
    setRecentLogs(data || [])
  }

  async function fetchSearchKeywords() {
    const start = getStartDate(period === 0 ? 0 : period)
    let query = supabase
      .from('page_views')
      .select('keyword')
      .eq('page', 'search')
      .not('keyword', 'is', null)
    if (start) query = query.gte('visited_at', start)

    const { data } = await query
    if (!data) return

    const grouped = {}
    data.forEach(row => {
      if (!row.keyword) return
      const k = row.keyword.trim()
      if (!k) return
      grouped[k] = (grouped[k] || 0) + 1
    })

    const sorted = Object.entries(grouped)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    setSearchKeywords(sorted)
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
        <h2 className="text-base font-bold text-gray-900">접속 통계</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '오늘', value: stats.today },
          { label: '7일', value: stats.week },
          { label: '30일', value: stats.month },
          { label: '누적', value: stats.total },
        ].map(s => (
          <div key={s.label} className="bg-soft rounded-xl p-4">
            <p className="text-xs text-sub mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* 일별 차트 */}
      <div className="bg-white border border-line rounded-xl p-4">
        <p className="text-xs font-medium text-gray-700 mb-3">
          일별 방문 추이 ({period === 0 ? '오늘' : period === 9999 ? '최근 30일' : `최근 ${period}일`})
        </p>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-xs text-sub">로딩 중...</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-sub">{d.count || ''}</span>
                <div
                  className="w-full bg-accent rounded-t-sm transition-all"
                  style={{ height: `${Math.max((d.count / maxDaily) * 96, d.count > 0 ? 4 : 0)}px` }}
                />
                <span className="text-[9px] text-sub truncate w-full text-center">{d.date}</span>
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
