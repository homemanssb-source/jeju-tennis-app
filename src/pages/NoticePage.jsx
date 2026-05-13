import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { SkeletonCard } from '../components/Skeleton'
import { markNoticesRead } from '../hooks/useNoticeBadge'
import { NoticeList } from '../components/Notice/NoticeContent'

export default function NoticePage() {
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotices()
    markNoticesRead()
  }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase.from('notices').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  return (
    <div className="pb-20">
      <PageHeader title="📢 공지사항" />
      <div className="max-w-lg mx-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm text-sub">등록된 공지가 없습니다.</p>
          </div>
        ) : (
          <NoticeList
            notices={notices}
            onSelectTournament={n => navigate(`/board/notice/${n.id}`)}
          />
        )}
      </div>
    </div>
  )
}
