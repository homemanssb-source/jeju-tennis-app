// src/pages/admin/MarketAdmin.jsx
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { deleteMarketImage } from '../../lib/marketStorage'

const STATUS_STYLE = {
  '판매중':  'bg-green-50 text-green-700',
  '예약중':  'bg-amber-50 text-amber-700',
  '거래완료': 'bg-gray-100 text-gray-500',
}
const REPORT_STYLE = {
  '검토중':   'bg-red-50 text-red-600',
  '처리완료': 'bg-gray-100 text-gray-500',
  '무혐의':   'bg-green-50 text-green-600',
}
const STATUSES = ['판매중', '예약중', '거래완료']
const TABS = ['게시물 관리', '신고 관리']

export default function MarketAdmin() {
  const showToast = useContext(ToastContext)
  const [tab, setTab] = useState(0)

  // ── 게시물 관리 ─────────────────────────────────
  const [posts, setPosts]         = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postSearch, setPostSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectedPost, setSelectedPost] = useState(null)
  const [comments, setComments]         = useState([])
  const [showDetail, setShowDetail]     = useState(false)

  // ── 신고 관리 ────────────────────────────────────
  const [reports, setReports]         = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportFilter, setReportFilter]     = useState('검토중')

  useEffect(() => {
    if (tab === 0) fetchPosts()
    else fetchReports()
  }, [tab, statusFilter, reportFilter])

  // ── 게시물 목록 ──────────────────────────────────
  async function fetchPosts() {
    setPostsLoading(true)
    let q = supabase.from('market_posts').select('*').order('created_at', { ascending: false })
    if (statusFilter !== '전체') q = q.eq('status', statusFilter)
    const { data, error } = await q
    if (error) showToast('불러오기 실패', 'error')
    setPosts(data || [])
    setPostsLoading(false)
  }

  async function fetchComments(postId) {
    const { data } = await supabase.from('market_comments')
      .select('*').eq('post_id', postId).order('created_at')
    setComments(data || [])
  }

  async function handleOpenDetail(post) {
    setSelectedPost(post)
    await fetchComments(post.post_id)
    setShowDetail(true)
  }

  async function handleDeletePost(post) {
    if (!window.confirm(`"${post.title}" 게시물을 삭제하시겠습니까?`)) return
    for (const url of (post.images || [])) await deleteMarketImage(url)
    const { error } = await supabase.from('market_posts').delete().eq('post_id', post.post_id)
    if (error) { showToast('삭제 실패', 'error'); return }
    showToast('게시물이 삭제되었습니다.')
    setShowDetail(false)
    fetchPosts()
  }

  async function handleForceStatus(post, newStatus) {
    const { error } = await supabase.from('market_posts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('post_id', post.post_id)
    if (error) { showToast('변경 실패', 'error'); return }
    setSelectedPost(p => ({ ...p, status: newStatus }))
    setPosts(prev => prev.map(p => p.post_id === post.post_id ? { ...p, status: newStatus } : p))
    showToast(`상태를 "${newStatus}"(으)로 변경했습니다.`)
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('market_comments').delete().eq('comment_id', commentId)
    if (error) { showToast('댓글 삭제 실패', 'error'); return }
    showToast('댓글이 삭제되었습니다.')
    fetchComments(selectedPost.post_id)
  }

  // ── 신고 목록 ────────────────────────────────────
  async function fetchReports() {
    setReportsLoading(true)
    let q = supabase.from('market_reports')
      .select('*, market_posts(post_id, title, author_name, status)')
      .order('created_at', { ascending: false })
    if (reportFilter !== '전체') q = q.eq('status', reportFilter)
    const { data, error } = await q
    if (error) showToast('신고 목록 불러오기 실패', 'error')
    setReports(data || [])
    setReportsLoading(false)
  }

  async function handleReportStatus(reportId, newStatus) {
    const { error } = await supabase.from('market_reports')
      .update({ status: newStatus }).eq('report_id', reportId)
    if (error) { showToast('처리 실패', 'error'); return }
    showToast('신고 처리 상태가 변경되었습니다.')
    fetchReports()
  }

  async function handleDeleteReportedPost(report) {
    if (!report.market_posts) { showToast('이미 삭제된 게시물입니다.', 'error'); return }
    if (!window.confirm(`"${report.market_posts.title}" 게시물을 삭제하시겠습니까?`)) return
    // 이미지 삭제
    const { data: postData } = await supabase.from('market_posts')
      .select('images').eq('post_id', report.market_posts.post_id).single()
    if (postData?.images) {
      for (const url of postData.images) await deleteMarketImage(url)
    }
    const { error } = await supabase.from('market_posts')
      .delete().eq('post_id', report.market_posts.post_id)
    if (error) { showToast('삭제 실패', 'error'); return }
    // 신고 상태도 처리완료로
    await supabase.from('market_reports').update({ status: '처리완료' }).eq('report_id', report.report_id)
    showToast('게시물이 삭제되었습니다.')
    fetchReports()
  }

  // ── 필터링 ───────────────────────────────────────
  const filteredPosts = posts.filter(p => {
    if (!postSearch.trim()) return true
    const q = postSearch.toLowerCase()
    return p.title?.toLowerCase().includes(q) ||
           p.author_name?.toLowerCase().includes(q) ||
           p.club?.toLowerCase().includes(q)
  })

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">🛒 용품 거래 관리</h2>
        <div className="flex gap-1">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                ${tab === i ? 'bg-accent text-white border-accent' : 'bg-white text-sub border-line hover:bg-soft2'}`}>
              {t}
              {i === 1 && reports.filter(r => r.status === '검토중').length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {reports.filter(r => r.status === '검토중').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ 게시물 관리 탭 ══════════════════════════ */}
      {tab === 0 && (
        <>
          {/* 필터 + 검색 */}
          <div className="flex gap-2 flex-wrap">
            <input value={postSearch} onChange={e => setPostSearch(e.target.value)}
              placeholder="제목 / 작성자 / 클럽 검색..."
              className="flex-1 min-w-[180px] text-sm border border-line rounded-lg px-3 py-2" />
            <div className="flex gap-1">
              {['전체', '판매중', '예약중', '거래완료'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                    ${statusFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-sub border-line'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-sub">총 {filteredPosts.length}개</p>

          {postsLoading ? (
            <div className="text-center py-10 text-sub text-sm">불러오는 중...</div>
          ) : (
            <div className="bg-white rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-soft border-b border-line">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-sub">게시물</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-sub w-20">상태</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-sub w-24">작성자</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-sub w-24">등록일</th>
                    <th className="px-3 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPosts.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-sub text-sm">게시물이 없습니다.</td></tr>
                  ) : filteredPosts.map(post => (
                    <tr key={post.post_id} className="hover:bg-soft/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {post.images?.[0]
                            ? <img src={post.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-line" />
                            : <div className="w-10 h-10 rounded-lg bg-soft flex items-center justify-center text-xl flex-shrink-0">🎾</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[240px]">{post.title}</p>
                            <p className="text-xs text-sub">{post.category} · {post.condition} · {Number(post.price).toLocaleString()}원</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[post.status]}`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-medium text-gray-700">{post.author_name}</p>
                        <p className="text-[10px] text-sub">{post.club}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-sub whitespace-nowrap">
                        {formatDate(post.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => handleOpenDetail(post)}
                          className="text-xs text-accent hover:underline">
                          상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ 신고 관리 탭 ════════════════════════════ */}
      {tab === 1 && (
        <>
          <div className="flex gap-1">
            {['전체', '검토중', '처리완료', '무혐의'].map(s => (
              <button key={s} onClick={() => setReportFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                  ${reportFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-sub border-line'}`}>
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-sub">총 {reports.length}건</p>

          {reportsLoading ? (
            <div className="text-center py-10 text-sub text-sm">불러오는 중...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-sub">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm">신고가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.report_id} className="bg-white rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REPORT_STYLE[r.status]}`}>
                          {r.status}
                        </span>
                        <span className="text-[10px] text-sub">{formatDate(r.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-0.5">
                        신고 대상: {r.market_posts?.title || <span className="text-red-400">(삭제된 게시물)</span>}
                      </p>
                      <p className="text-xs text-sub">작성자: {r.market_posts?.author_name || '-'}</p>
                      <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-700">신고 사유: {r.reason}</p>
                      </div>
                    </div>
                    {r.market_posts && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[r.market_posts.status]}`}>
                        {r.market_posts.status}
                      </span>
                    )}
                  </div>

                  {/* 처리 액션 */}
                  <div className="flex gap-2 pt-3 border-t border-line">
                    {r.status === '검토중' && (
                      <>
                        <button onClick={() => handleDeleteReportedPost(r)}
                          disabled={!r.market_posts}
                          className="flex-1 py-1.5 bg-red-500 text-white text-xs rounded-lg font-medium
                                     disabled:opacity-40">
                          게시물 삭제
                        </button>
                        <button onClick={() => handleReportStatus(r.report_id, '무혐의')}
                          className="flex-1 py-1.5 border border-line text-xs rounded-lg text-sub hover:bg-soft">
                          무혐의 처리
                        </button>
                        <button onClick={() => handleReportStatus(r.report_id, '처리완료')}
                          className="flex-1 py-1.5 border border-line text-xs rounded-lg text-sub hover:bg-soft">
                          처리 완료
                        </button>
                      </>
                    )}
                    {r.status !== '검토중' && (
                      <button onClick={() => handleReportStatus(r.report_id, '검토중')}
                        className="text-xs text-sub hover:underline">
                        검토중으로 되돌리기
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ 게시물 상세 모달 ═══════════════════════ */}
      {showDetail && selectedPost && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">게시물 상세</h3>
              <button onClick={() => setShowDetail(false)} className="text-sub text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 이미지 */}
              {selectedPost.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedPost.images.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded-xl flex-shrink-0 border border-line" />
                  ))}
                </div>
              )}

              {/* 기본 정보 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[selectedPost.status]}`}>
                    {selectedPost.status}
                  </span>
                  <span className="text-xs text-sub">{selectedPost.category} · {selectedPost.condition}</span>
                </div>
                <p className="text-base font-bold text-gray-900">{selectedPost.title}</p>
                <p className="text-lg font-bold text-accent">{Number(selectedPost.price).toLocaleString()}원</p>
                <p className="text-xs text-sub">
                  {selectedPost.author_name} · {selectedPost.club} · {formatDate(selectedPost.created_at)}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-soft rounded-xl p-3">
                  {selectedPost.content}
                </p>
              </div>

              {/* 상태 강제 변경 */}
              <div className="border border-line rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">거래 상태 강제 변경</p>
                <div className="flex gap-2">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => handleForceStatus(selectedPost, s)}
                      disabled={selectedPost.status === s}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors
                        ${selectedPost.status === s
                          ? 'bg-accent text-white border-accent font-semibold'
                          : 'border-line text-sub hover:bg-soft'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 댓글 목록 */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">댓글 {comments.length}개</p>
                {comments.length === 0 ? (
                  <p className="text-xs text-sub text-center py-3">댓글이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {comments.map(c => (
                      <div key={c.comment_id}
                        className={`flex items-start gap-2 p-2.5 rounded-xl
                          ${c.is_private ? 'bg-amber-50 border border-amber-200' : 'bg-soft'}`}>
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center
                                        text-[10px] font-bold text-blue-600 flex-shrink-0">
                          {c.author_name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-medium text-gray-800">{c.author_name}</span>
                            {c.is_private && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded">🔒 비밀</span>}
                            {c.member_id === selectedPost.member_id && (
                              <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 rounded">판매자</span>
                            )}
                            <span className="text-[10px] text-sub">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-xs text-gray-700 break-words">{c.content}</p>
                        </div>
                        <button onClick={() => handleDeleteComment(c.comment_id)}
                          className="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0">
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 하단 액션 */}
            <div className="px-5 py-4 border-t border-line flex gap-2 flex-shrink-0">
              <button onClick={() => handleDeletePost(selectedPost)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">
                게시물 삭제
              </button>
              <button onClick={() => setShowDetail(false)}
                className="flex-1 py-2.5 border border-line text-sub rounded-xl text-sm hover:bg-soft">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
