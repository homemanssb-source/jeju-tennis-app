import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { SkeletonCard } from '../components/Skeleton'

export default function NoticePage() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotices()
  }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    setNotices(data || [])
    setLoading(false)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="pb-4">
      <PageHeader title="📌 공지사항" />

      <div className="max-w-lg mx-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📌</p>
            <p className="text-sm text-sub">등록된 공지가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notices.map(n => (
              <div
                key={n.id}
                className={`rounded-r p-4 border transition-colors
                  ${n.pinned ? 'bg-accentSoft border-accent/20' : 'bg-soft border-line/50'}`}
              >
                <div className="flex items-start gap-2">
                  {n.pinned && <span className="text-xs shrink-0 mt-0.5">📍</span>}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                    {n.content && (
                      <p className="text-sm text-sub mt-1.5 whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-sub">{formatDate(n.created_at)}</span>
                      {n.link && (
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent font-medium hover:underline"
                        >
                          링크 열기 →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
