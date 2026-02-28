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
  const [viewMode, setViewMode] = useState('member')
  const timerRef = useRef(null)

  async function search(q) {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    const { data, error } = await supabase.from('members_public')
      .select('member_id, name, display_name, club, division, grade, status')
      .neq('status', '\uC0AD\uC81C')
      .or(`name.ilike.%${trimmed}%,club.ilike.%${trimmed}%,member_id.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
      .limit(100)
    if (!error) setResults(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    const val = e.target.value; setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  function getClubGroups() {
    const clubs = {}
    results.forEach(m => {
      const club = m.club || '\uC18C\uC18D \uC5C6\uC74C'
      if (!clubs[club]) clubs[club] = []
      clubs[club].push(m)
    })
    return Object.entries(clubs).sort((a, b) => b[1].length - a[1].length)
  }

  const clubGroups = getClubGroups()
  const hasClubResults = results.some(m => m.club && m.club.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="pb-20">
      <PageHeader title={'\uD83D\uDD0E \uAC80\uC0C9'} subtitle={'\uC774\uB984 \uB610\uB294 \uD074\uB7FD\uBA85\uC73C\uB85C \uAC80\uC0C9'} />
      <div className="px-5 py-3 max-w-lg mx-auto">
        <form onSubmit={e => { e.preventDefault(); search(query) }}>
          <div className="relative">
            <input type="text" value={query} onChange={handleChange}
              placeholder={'\uC774\uB984, \uD074\uB7FD\uBA85 \uB610\uB294 \uD68C\uC6D0ID...'}
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl bg-soft text-sm focus:border-accent focus:ring-2 focus:ring-accentSoft" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sub text-lg">{'\uD83D\uDD0D'}</span>
          </div>
        </form>
        {results.length > 0 && hasClubResults && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => setViewMode('member')}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode === 'member' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}>
              {'\uD68C\uC6D0\uBCC4'}
            </button>
            <button onClick={() => setViewMode('club')}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${viewMode === 'club' ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}>
              {'\uD074\uB7FD\uBCC4'}
            </button>
          </div>
        )}
      </div>
      <div className="max-w-lg mx-auto">
        {loading ? <SkeletonList count={5} /> : results.length > 0 ? (
          <div className="px-4">
            <p className="text-xs text-sub px-1 mb-2">{'\uAC80\uC0C9 \uACB0\uACFC ' + results.length + '\uBA85'}</p>
            {viewMode === 'club' && hasClubResults ? (
              <div className="space-y-3">
                {clubGroups.map(([clubName, members]) => (
                  <div key={clubName} className="bg-white border border-line rounded-lg overflow-hidden">
                    <div className="bg-soft2 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">{'\uD83C\uDFBE ' + clubName}</span>
                      <span className="text-xs text-accent font-bold">{members.length + '\uBA85'}</span>
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
                            {m.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{m.grade}</span>}
                          </div>
                          <p className="text-xs text-sub mt-0.5">{m.division || '-'}</p>
                        </div>
                        <span className="text-xs text-sub shrink-0">{'\u3009'}</span>
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
                      {m.grade && <span className="px-1.5 py-0.5 bg-soft2 text-sub text-[10px] font-medium rounded shrink-0">{m.grade}</span>}
                    </div>
                    <p className="text-xs text-sub mt-0.5 truncate">{(m.club || '-') + ' \u00B7 ' + (m.division || '-')}</p>
                  </div>
                  <span className="text-xs text-sub shrink-0">{'\u3009'}</span>
                </button>
              ))
            )}
          </div>
        ) : searched ? (
          <div className="text-center py-12"><p className="text-4xl mb-3">{'\uD83D\uDE14'}</p><p className="text-sm text-sub">{'\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}</p></div>
        ) : (
          <div className="text-center py-12"><p className="text-4xl mb-3">{'\uD83C\uDFBE'}</p><p className="text-sm text-sub">{'\uC774\uB984 \uB610\uB294 \uD074\uB7FD\uBA85\uC744 \uAC80\uC0C9\uD574\uBCF4\uC138\uC694.'}</p></div>
        )}
      </div>
      <PlayerDetail memberId={selectedMember} open={!!selectedMember} onClose={() => setSelectedMember(null)} />
    </div>
  )
}