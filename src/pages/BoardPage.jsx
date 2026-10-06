import { useState, useContext } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const CATEGORIES = [
  { value: 'suggestion', label: '건의' },
  { value: 'question', label: '문의' },
  { value: 'complaint', label: '불만' },
  { value: 'general', label: '기타' },
]

export default function BoardPage() {
  const showToast = useContext(ToastContext)
  const [tab, setTab] = useState('write') // 'write' | 'myPosts'

  // 공통 인증
  const [authName, setAuthName] = useState('')
  const [authPin, setAuthPin] = useState('')

  // 글쓰기
  const [category, setCategory] = useState('suggestion')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 내 글 목록
  const [myPosts, setMyPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [postsLoaded, setPostsLoaded] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)

  async function handleSubmitPost() {
    if (!authName.trim() || authPin.length !== 6) {
      showToast?.('이름과 PIN 6자리를 입력해주세요.', 'error'); return
    }
    if (!title.trim() || !content.trim()) {
      showToast?.('제목과 내용을 입력해주세요.', 'error'); return
    }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('rpc_create_board_post', {
      p_name: authName.trim(), p_pin: authPin,
      p_category: category, p_title: title.trim(), p_content: content.trim(),
    })
    if (error) { showToast?.('등록 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      showToast?.('✅ 글이 등록되었습니다.')
      setTitle(''); setContent(''); setCategory('suggestion')
    }
    setSubmitting(false)
  }

  async function handleLoadMyPosts() {
    if (!authName.trim() || authPin.length !== 6) {
      showToast?.('이름과 PIN 6자리를 입력해주세요.', 'error'); return
    }

    setLoadingPosts(true)
    const { data, error } = await supabase.rpc('rpc_get_my_board_posts', {
      p_name: authName.trim(), p_pin: authPin,
    })
    if (error) { showToast?.('조회 실패: ' + error.message, 'error') }
    else if (data && !data.ok) { showToast?.('⚠️ ' + data.message, 'error') }
    else if (data && data.ok) {
      setMyPosts(data.posts || [])
      setPostsLoaded(true)
      if (!data.posts || data.posts.length === 0) showToast?.('작성한 글이 없습니다.')
    }
    setLoadingPosts(false)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  function getCategoryLabel(val) {
    return CATEGORIES.find(c => c.value === val)?.label || val
  }

  return (
    <div className="pb-20">
      <PageHeader title="💬 건의/문의" subtitle="건의사항, 문의사항을 작성해주세요" />
      <div className="max-w-lg mx-auto px-5 py-4 space-y-4">

        {/* 본인 확인 영역 */}
        <div className="bg-soft rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">본인 확인</p>
          <p className="text-xs text-sub">※ PIN 초기값은 전화번호 뒷6자리입니다.</p>
          <div className="flex gap-2">
            <input type="text" value={authName} onChange={e => setAuthName(e.target.value)}
              placeholder="이름" className="flex-1 min-w-0 text-sm border border-line rounded-lg px-3 py-2" />
            <input type="password" inputMode="numeric" maxLength={6} value={authPin}
              onChange={e => setAuthPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN 6자리" className="w-32 shrink-0 text-sm border border-line rounded-lg px-3 py-2 tracking-widest" />
          </div>
        </div>

        {/* 탭 전환 */}
        <div className="flex border border-line rounded-lg overflow-hidden">
          <button onClick={() => { setTab('write'); setSelectedPost(null) }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'write' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
            ✏️ 글쓰기
          </button>
          <button onClick={() => { setTab('myPosts'); setSelectedPost(null) }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'myPosts' ? 'bg-accent text-white' : 'bg-white text-sub'}`}>
            📋 내 글 확인
          </button>
        </div>

        {/* 글쓰기 탭 */}
        {tab === 'write' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">분류</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="제목을 입력하세요" maxLength={100}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="내용을 입력하세요" rows={5} maxLength={2000}
                className="w-full text-sm border border-line rounded-lg px-3 py-2.5 resize-none" />
              <p className="text-xs text-sub text-right mt-1">{content.length}/2000</p>
            </div>
            <button onClick={handleSubmitPost} disabled={submitting || !authName.trim() || authPin.length !== 6 || !title.trim() || !content.trim()}
              className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
                hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? '등록 중...' : '📮 작성 완료'}
            </button>
          </div>
        )}

        {/* 내 글 확인 탭 */}
        {tab === 'myPosts' && (
          <div className="space-y-3">
            {!postsLoaded && (
              <button onClick={handleLoadMyPosts} disabled={loadingPosts || !authName.trim() || authPin.length !== 6}
                className="w-full bg-accent text-white py-3 rounded-lg font-semibold text-sm
                  hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {loadingPosts ? '조회 중...' : '🔍 내 글 조회'}
              </button>
            )}

            {postsLoaded && myPosts.length === 0 && (
              <div className="text-center py-8 text-sub text-sm">작성한 글이 없습니다.</div>
            )}

            {postsLoaded && !selectedPost && myPosts.map(post => (
              <button key={post.id} onClick={() => setSelectedPost(post)}
                className="w-full text-left bg-white border border-line rounded-lg p-3 hover:bg-soft transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 bg-soft rounded text-sub">{getCategoryLabel(post.category)}</span>
                  {post.admin_reply && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded">답변완료</span>}
                  {!post.admin_reply && <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded">대기중</span>}
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">{post.title}</p>
                <p className="text-xs text-sub mt-1">{formatDate(post.created_at)}</p>
              </button>
            ))}

            {/* 글 상세 */}
            {selectedPost && (
              <div className="space-y-3">
                <button onClick={() => setSelectedPost(null)} className="text-sm text-accent font-medium -ml-2 px-2 py-2">← 목록으로</button>
                <div className="border border-line rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-soft rounded text-sub">{getCategoryLabel(selectedPost.category)}</span>
                    <span className="text-xs text-sub">{formatDate(selectedPost.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold">{selectedPost.title}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPost.content}</p>
                </div>

                {selectedPost.admin_reply ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                    <p className="text-xs font-medium text-green-700">📩 관리자 답변 ({formatDate(selectedPost.admin_replied_at)})</p>
                    <p className="text-sm text-green-800 whitespace-pre-wrap">{selectedPost.admin_reply}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-700">⏳ 아직 답변이 등록되지 않았습니다.</p>
                  </div>
                )}
              </div>
            )}

            {postsLoaded && (
              <button onClick={() => { setPostsLoaded(false); setMyPosts([]); setSelectedPost(null) }}
                className="w-full text-sm text-sub py-2">새로고침</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
