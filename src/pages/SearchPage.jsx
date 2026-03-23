import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import PlayerDetail from '../components/PlayerDetail'
import { SkeletonList } from '../components/Skeleton'
import { usePageView } from '../hooks/usePageView'

export default function SearchPage() {
  usePageView('search')

  const [query, setQuery] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('') // ✅ 등급 필터
  const [gradeOptions, setGradeOptions] = useState([])   // ✅ 등급 목록
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [viewMode, setViewMode] = useState('member')
  const timerRef = useRef(null)

  // ✅ 등급 목록 로드
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

  async function search(q, grade) {
    const trimmed = q.trim()
    // 검색어도 없고 등급도 없으면 초기화
    if (!trimmed && !grade) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)

    if (trimmed) logSearch(trimmed)

    let queryBuilder = supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '삭제')
      .limit(100)

    // ✅ 텍스트 검색 조건 (이름/클럽/ID)
    if (trimmed) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${trimmed}%,club.ilike.%${trimmed}%,member_id.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`
      )
    }

    // ✅ 등급 필터 조건
    if (grade) {
      queryBuilder = queryBuilder.eq('grade', grade)
    }

    const { data, error } = await queryBuilder
    if (!error) setResults(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val, selectedGrade), 300)
  }

  function handleGradeSelect(grade) {
    const next = selectedGrade === grade ? '' : grade // 같은 거 누르면 해제
    setSelectedGrade(next)
    search(query, next)
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
  const hasClubResults = results.some(m => m.club && m.club.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="pb-20">
      <PageHeader title="🔎 검색" subtitle="이름, 클럽명, 등급으로 검색" />

      <div className="px-5 py-3 max-w-lg mx-auto space-y-2">

        {/* 텍스트 검색창 */}
        <form onSubmit={e => { e.preventDefault(); search(query, selectedGrade) }}>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="이름, 클럽명 또는 회원ID..."
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl bg-soft text-sm focus:border-accent focus:ring-2 focus:ring-accentSoft"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sub text-lg">🔍</span>
          </div>
        </form>

        {/* ✅ 등급 필터 버튼 */}
        {gradeOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gradeOptions.map(g => (
              <button
                key={g}
                onClick={() => handleGradeSelect(g)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  selectedGrade === g
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-sub border-line hover:border-accent hover:text-accent'
                }`}
              >
                {g}
              </button>
            ))}
            {selectedGrade && (
              <button
                onClick={() => handleGradeSelect('')}
                className="px-3 py-1 rounded-full text-xs font-semibold border border-red-200 text-red-400 bg-white hover:bg-red-50 transition-colors"
              >
                ✕ 초기화
              </button>
            )}
          </div>
        )}

        {/* 현재 필터 표시 */}
        {(query || selectedGrade) && searched && !loading && (
          <p className="text-xs text-sub">
            {[query && `"${query}"`, selectedGrade && `등급: ${selectedGrade}`].filter(Boolean).join(' + ')}
            {' 검색 결과 '}
            <span className="font-bold text-accent">{results.length}명</span>
          </p>
        )}

        {/* 뷰 모드 탭 (클럽 검색 결과 있을 때만) */}
        {results.length > 0 && hasClubResults && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('member')}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode === 'member' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}
            >
              회원별
            </button>
            <button
              onClick={() => setViewMode('club')}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode === 'club' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}
            >
              클럽별
            </button>
          </div>
        )}
      </div>

      {/* 결과 목록 */}
      <div className="max-w-lg mx-auto">
        {loading ? (
          <SkeletonList count={5} />
        ) : results.length > 0 ? (
          <div className="px-4">
            {viewMode === 'club' && hasClubResults ? (
              <div className="space-y-3">
                {clubGroups.map(([clubName, members]) => (
                  <div key={clubName} className="bg-white border border-line rounded-lg overflow-hidden">
                    <div className="bg-soft2 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">🎾 {clubName}</span>
                      <span className="text-xs text-accent font-bold">{members.length}명</span>
                    </div>
                    {members.map(m => (
                      <button key={m.member_id} onClick={() => setSelectedMember(m.member_id)}
                        className="w-full flex items-center gap-3 py-2.5 px-3 border-t border-line/50 hover:bg-soft transition-colors text-left">
                        <div className="w-8 h-8 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                          <span className="text-accent text-xs font-bold">{(m.display_name || m.name || '?')[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 truncate">{m.display_name || m.name}</span>
                            {m.grade && (
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded shrink-0 ${
                                selectedGrade === m.grade
                                  ? 'bg-accent text-white'
                                  : 'bg-soft2 text-sub'
                              }`}>{m.grade}</span>
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
              results.map(m => (
                <button key={m.member_id} onClick={() => setSelectedMember(m.member_id)}
                  className="w-full flex items-center gap-3 py-3 px-2 border-b border-line/50 hover:bg-soft transition-colors text-left">
                  <div className="w-9 h-9 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm font-bold">{(m.display_name || m.name || '?')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">{m.display_name || m.name}</span>
                      {m.grade && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded shrink-0 ${
                          selectedGrade === m.grade
                            ? 'bg-accent text-white'
                            : 'bg-soft2 text-sub'
                        }`}>{m.grade}</span>
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
            {selectedGrade && (
              <button
                onClick={() => handleGradeSelect('')}
                className="mt-3 text-xs text-accent underline"
              >
                등급 필터 해제하기
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎾</p>
            <p className="text-sm text-sub">이름, 클럽명을 검색하거나<br />위에서 등급을 선택하세요.</p>
          </div>
        )}
      </div>

      <PlayerDetail memberId={selectedMember} open={!!selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}