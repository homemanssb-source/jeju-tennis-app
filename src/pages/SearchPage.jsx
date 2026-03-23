import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import PlayerDetail from '../components/PlayerDetail'
import { SkeletonList } from '../components/Skeleton'
import { usePageView } from '../hooks/usePageView'

export default function SearchPage() {
  usePageView('search')

  const [query, setQuery] = useState('')
  const [gradeOptions, setGradeOptions] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchType, setSearchType] = useState('') // 'name' | 'club' | 'grade'
  const [selectedMember, setSelectedMember] = useState(null)
  const [viewMode, setViewMode] = useState('member')
  const timerRef = useRef(null)

  // 등급 목록 로드
  useEffect(() => {
    supabase.from('grade_options')
      .select('grade_value')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setGradeOptions(data?.map(g => g.grade_value) || []))
  }, [])

  async function logSearch(keyword) {
    await supabase.from('page_views').insert({
      page: 'search',
      keyword: keyword.trim(),
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'pc',
      session_id: sessionStorage.getItem('jta_sid') || ''
    })
  }

  // 입력값이 등급인지 판별
  function detectGrade(q) {
    const trimmed = q.trim()
    return gradeOptions.find(g => g.toLowerCase() === trimmed.toLowerCase()) || null
  }

  async function search(q) {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setSearched(false); setSearchType(''); return }
    setLoading(true); setSearched(true)
    logSearch(trimmed)

    const matchedGrade = detectGrade(trimmed)

    let queryBuilder = supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '삭제')
      .limit(100)

    if (matchedGrade) {
      // 등급 정확 일치
      queryBuilder = queryBuilder.eq('grade', matchedGrade)
    } else {
      // 이름 / 클럽 / ID 검색
      queryBuilder = queryBuilder.or(
        `name.ilike.%${trimmed}%,club.ilike.%${trimmed}%,member_id.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`
      )
    }

    const { data, error } = await queryBuilder
    if (!error) {
      setResults(data || [])
      if (matchedGrade) {
        setSearchType('grade')
      } else {
        const clubHit = data?.some(m => m.club?.toLowerCase().includes(trimmed.toLowerCase()))
        const nameHit = data?.some(m =>
          (m.name || '').toLowerCase().includes(trimmed.toLowerCase()) ||
          (m.display_name || '').toLowerCase().includes(trimmed.toLowerCase())
        )
        setSearchType(clubHit && !nameHit ? 'club' : 'name')
      }
    }
    setLoading(false)
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setSearched(false)
    setSearchType('')
  }

  function getClubGroups() {
    const clubs = {}
    results.forEach(m => {
      const club = m.club || '소속 없음'
      if (!clubs[club]) clubs[club] = []
      clubs[club].push(m)
    })
    return Object.entries(clubs).sort((a, b) => b[1].length - a[1].length)
  }

  const clubGroups = getClubGroups()
  const hasClubResults = results.some(m =>
    m.club?.toLowerCase().includes(query.trim().toLowerCase())
  )
  const isGradeSearch = searchType === 'grade'

  function getSearchLabel() {
    if (!searched || !query.trim()) return null
    if (isGradeSearch) return `등급 "${query.trim()}" 선수`
    if (searchType === 'club') return `클럽 "${query.trim()}" 검색`
    return `"${query.trim()}" 검색`
  }

  return (
    <div className="pb-20">
      <PageHeader title="🔎 검색" subtitle="이름 · 클럽명 · 등급 모두 검색 가능" />

      <div className="px-5 py-3 max-w-lg mx-auto space-y-2">

        {/* 통합 검색창 */}
        <form onSubmit={e => { e.preventDefault(); search(query) }}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sub text-lg pointer-events-none">
              {isGradeSearch ? '🏅' : '🔍'}
            </span>
            <input
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="이름, 클럽명, 등급 (예: 7부) ..."
              className="w-full pl-10 pr-9 py-2.5 border border-line rounded-xl bg-soft text-sm focus:border-accent focus:ring-2 focus:ring-accentSoft"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sub hover:text-gray-600 text-base leading-none"
              >
                ✕
              </button>
            )}
          </div>
        </form>

        {/* 등급 바로가기 힌트 (검색 전에만 표시) */}
        {!searched && gradeOptions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5 items-center">
            <span className="text-[10px] text-sub mr-1">등급 바로가기</span>
            {gradeOptions.map(g => (
              <button
                key={g}
                onClick={() => { setQuery(g); search(g) }}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-line bg-white text-sub hover:border-accent hover:text-accent transition-colors"
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {/* 결과 요약 + 뷰 탭 */}
        {searched && !loading && results.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-sub">
              {getSearchLabel()}{' '}
              <span className="font-bold text-accent">{results.length}명</span>
            </p>
            {hasClubResults && !isGradeSearch && (
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('member')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${viewMode === 'member' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}
                >
                  회원별
                </button>
                <button
                  onClick={() => setViewMode('club')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${viewMode === 'club' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}
                >
                  클럽별
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 결과 목록 */}
      <div className="max-w-lg mx-auto">
        {loading ? (
          <SkeletonList count={5} />
        ) : results.length > 0 ? (
          <div className="px-4">

            {/* 등급 검색 → 클럽별 그룹 */}
            {isGradeSearch ? (
              <div className="space-y-3">
                {clubGroups.map(([clubName, members]) => (
                  <div key={clubName} className="bg-white border border-line rounded-lg overflow-hidden">
                    <div className="bg-soft2 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">🎾 {clubName}</span>
                      <span className="text-xs text-accent font-bold">{members.length}명</span>
                    </div>
                    {members.map(m => (
                      <button
                        key={m.member_id}
                        onClick={() => setSelectedMember(m.member_id)}
                        className="w-full flex items-center gap-3 py-2.5 px-3 border-t border-line/50 hover:bg-soft transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                          <span className="text-accent text-xs font-bold">{(m.display_name || m.name || '?')[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 truncate">{m.display_name || m.name}</span>
                            {m.grade && (
                              <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-semibold rounded shrink-0">
                                {m.grade}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-sub mt-0.5">{m.division || '-'}</p>
                        </div>
                        <span className="text-xs text-sub shrink-0">〉</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

            ) : viewMode === 'club' && hasClubResults ? (
              /* 클럽별 뷰 */
              <div className="space-y-3">
                {clubGroups.map(([clubName, members]) => (
                  <div key={clubName} className="bg-white border border-line rounded-lg overflow-hidden">
                    <div className="bg-soft2 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">🎾 {clubName}</span>
                      <span className="text-xs text-accent font-bold">{members.length}명</span>
                    </div>
                    {members.map(m => (
                      <button
                        key={m.member_id}
                        onClick={() => setSelectedMember(m.member_id)}
                        className="w-full flex items-center gap-3 py-2.5 px-3 border-t border-line/50 hover:bg-soft transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                          <span className="text-accent text-xs font-bold">{(m.display_name || m.name || '?')[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 truncate">{m.display_name || m.name}</span>
                            {m.grade && (
                              <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{m.grade}</span>
                            )}
                          </div>
                          <p className="text-xs text-sub mt-0.5">{m.division || '-'}</p>
                        </div>
                        <span className="text-xs text-sub shrink-0">〉</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>

            ) : (
              /* 회원별 뷰 */
              results.map(m => (
                <button
                  key={m.member_id}
                  onClick={() => setSelectedMember(m.member_id)}
                  className="w-full flex items-center gap-3 py-3 px-2 border-b border-line/50 hover:bg-soft transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm font-bold">{(m.display_name || m.name || '?')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">{m.display_name || m.name}</span>
                      {m.grade && (
                        <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{m.grade}</span>
                      )}
                    </div>
                    <p className="text-xs text-sub mt-0.5 truncate">{(m.club || '-') + ' · ' + (m.division || '-')}</p>
                  </div>
                  <span className="text-xs text-sub shrink-0">〉</span>
                </button>
              ))
            )}
          </div>

        ) : searched ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">😔</p>
            <p className="text-sm text-sub">검색 결과가 없습니다.</p>
            {gradeOptions.length > 0 && (
              <p className="text-xs text-sub mt-2">
                등급 검색은 정확히 입력해주세요
                <br />
                <span className="text-accent">({gradeOptions.join(', ')})</span>
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎾</p>
            <p className="text-sm text-sub">이름, 클럽명을 검색하거나<br />등급을 직접 입력해보세요.</p>
          </div>
        )}
      </div>

      <PlayerDetail memberId={selectedMember} open={!!selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}