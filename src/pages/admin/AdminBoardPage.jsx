import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const CATEGORY_LABELS = {
  suggestion: '건의', question: '문의', complaint: '불만', general: '기타',
}

export default function AdminBoardPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'unread' | 'replied'

  useEffect(() => { fetchPosts() }, [])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase.from('board_posts')
      .select('*').order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedPost) return
    setSubmitting(true)
    const { error } = await supabase.from('board_posts')
      .update({ admin_reply: replyText.trim(), admin_replied_at: new Date().toISOString(), is_read: true })
      .eq('id', selectedPost.id)
    if (error) { alert('답변 저장 실패: ' + error.message) }
    else {
      await fetchPosts()
      setSelectedPost(null); setReplyText('')
    }
    setSubmitting(false)
  }

  async function handleMarkRead(postId) {
    await supabase.from('board_posts').update({ is_read: true }).eq('id', postId)
    fetchPosts()
  }

  function formatDate(d) {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
  }

  const filtered = posts.filter(p => {
    if (filter === 'unread') return !p.is_read
    if (filter === 'replied') return !!p.admin_reply
    return true
  })
  const unreadCount = posts.filter(p => !p.is_read).length

  if (selectedPost) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedPost(null); setReplyText('') }}
          className="text-sm text-accent">← 목록으로</button>

        <div className="bg-white border border-line rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 bg-soft rounded">{CATEGORY_LABELS[selectedPost.category] || selectedPost.category}</span>
            <span className="text-xs text-sub">{formatDate(selectedPost.created_at)}</span>
            <span className="text-xs font-medium">{selectedPost.member_name}</span>
          </div>
          <h3 className="text-sm font-bold">{selectedPost.title}</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPost.content}</p>
        </div>

        {selectedPost.admin_reply ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-green-700">✅ 답변 완료 ({formatDate(selectedPost.admin_replied_at)})</p>
            <p className="text-sm text-green-800 whitespace-pre-wrap">{selectedPost.admin_reply}</p>
            <button onClick={() => setReplyText(selectedPost.admin_reply)}
              className="text-xs text-accent">답변 수정하기</button>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {selectedPost.admin_reply ? '답변 수정' : '답변 작성'}
          </label>
          <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
            rows={4} placeholder="답변을 입력하세요..."
            className="w-full text-sm border border-line rounded-lg px-3 py-2.5 resize-none" />
          <button onClick={handleReply}
            disabled={submitting || !replyText.trim()}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50">
            {submitting ? '저장 중...' : '💬 답변 저장'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">💬 건의/문의 관리</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">미읽음 {unreadCount}</span>}
          <button onClick={fetchPosts} className="text-xs text-accent">새로고침</button>
        </div>
      </div>

      <div className="flex gap-1">
        {[['all', '전체'], ['unread', '미읽음'], ['replied', '답변완료']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 text-xs rounded-lg ${filter === val ? 'bg-accent text-white' : 'bg-white border border-line text-sub'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-sub py-8 text-center">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-sub py-8 text-center">게시글이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <button key={post.id} onClick={() => { setSelectedPost(post); setReplyText(post.admin_reply || ''); if (!post.is_read) handleMarkRead(post.id) }}
              className="w-full text-left bg-white border border-line rounded-lg p-3 hover:bg-soft transition-colors">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {!post.is_read && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>}
                <span className="text-xs px-1.5 py-0.5 bg-soft rounded">{CATEGORY_LABELS[post.category] || post.category}</span>
                <span className="text-xs font-medium">{post.member_name}</span>
                <span className="text-xs text-sub ml-auto">{formatDate(post.created_at)}</span>
              </div>
              <p className="text-sm font-medium text-gray-800 truncate">{post.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {post.admin_reply
                  ? <span className="text-xs text-green-600">✅ 답변완료</span>
                  : <span className="text-xs text-yellow-600">⏳ 대기중</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
