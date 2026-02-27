import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import PlayerDetail from '../components/PlayerDetail'
import { SkeletonList } from '../components/Skeleton'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const timerRef = useRef(null)

  async function search(q) {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    const { data, error } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '삭제')
      .or(`name.ilike.%${trimmed}%,member_id.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
      .limit(30)
    if (!error) setResults(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    const val = e.target.value; setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  return (
    <div className="pb-20">
      <PageHeader title="🔎 검색" subtitle="이름 또는 회원ID로 검색" />
      <div className="px-5 py-3 max-w-lg mx-auto">
        <form onSubmit={e => { e.preventDefault(); search(query) }}>
          <div className="relative">
            <input type="text" value={query} onChange={handleChange}
              placeholder="이름 또는 회원ID 입력..."
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl bg-soft text-sm
                focus:border-accent focus:ring-2 focus:ring-accentSoft" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sub text-lg">🔍</span>
          </div>
        </form>
      </div>
      <div className="max-w-lg mx-auto">
        {loading ? <SkeletonList count={5} /> : results.length > 0 ? (
          <div className="px-4">
            <p className="text-xs text-sub px-1 mb-2">검색 결과 {results.length}건</p>
            {results.map(m => (
              <button key={m.member_id} onClick={() => setSelectedMember(m.member_id)}
                className="w-full flex items-center gap-3 py-3 px-2 border-b border-line/50 hover:bg-soft transition-colors text-left">
                <div className="w-9 h-9 bg-accentSoft rounded-full flex items-center justify-center shrink-0">
                  <span className="text-accent text-sm font-bold">{(m.display_name || m.name || '?')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{m.display_name || m.name}</span>
                    {m.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{m.grade}</span>}
                  </div>
                  <p className="text-xs text-sub mt-0.5 truncate">{m.club || '-'} · {m.division || '-'}</p>
                </div>
                <span className="text-xs text-sub shrink-0">〉</span>
              </button>
            ))}
          </div>
        ) : searched ? (
          <div className="text-center py-12"><p className="text-4xl mb-3">😔</p><p className="text-sm text-sub">검색 결과가 없습니다.</p></div>
        ) : (
          <div className="text-center py-12"><p className="text-4xl mb-3">🎾</p><p className="text-sm text-sub">회원을 검색해보세요.</p></div>
        )}
      </div>
      <PlayerDetail memberId={selectedMember} open={!!selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}
