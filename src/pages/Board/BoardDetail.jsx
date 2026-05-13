import { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { colors, categoryColors, CATEGORY_LABEL } from '../../lib/boardTheme'
import { useAdmin } from '../../hooks/useAdmin'
import { fetchPostById, incrementViews } from '../../hooks/usePosts'
import AttachmentList from '../../components/Board/AttachmentList'
import { ToastContext } from '../../App'

function formatDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function BoardDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const showToast = useContext(ToastContext)
  const { isAdmin } = useAdmin()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = await fetchPostById(postId)
        if (active) setPost(data)
        incrementViews(postId)
      } catch (e) {
        if (active) setErr(e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [postId])

  async function handleDelete() {
    if (!confirm(`"${post.title}" 글을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }
    showToast?.('삭제되었습니다.')
    navigate('/board')
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: colors.textLight }}>로딩 중...</div>
  }
  if (err || !post) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 36, margin: 0 }}>⚠️</p>
        <p style={{ color: colors.textMid, fontSize: 13 }}>게시글을 불러올 수 없습니다</p>
        <button onClick={() => navigate('/board')}
          style={{ marginTop: 12, background: colors.primary, color: '#fff', border: 'none',
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          목록으로
        </button>
      </div>
    )
  }

  const catKey = post.sub_category || post.category
  const cc = categoryColors[catKey] || categoryColors.notice

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 90 }}>
      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.border}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'transparent', border: 'none', fontSize: 18, color: colors.textDark, cursor: 'pointer' }}>←</button>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.textDark, flex: 1 }}>
          {CATEGORY_LABEL[post.category] || post.category}
        </h1>
        {isAdmin && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ background: 'transparent', border: 'none', fontSize: 18, color: colors.textMid, cursor: 'pointer', padding: '4px 8px' }}>⋯</button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '100%',
                background: '#fff', border: `1px solid ${colors.border}`,
                borderRadius: 10, padding: 4, minWidth: 110,
                boxShadow: '0 6px 16px rgba(0,0,0,0.1)', zIndex: 20,
              }}>
                <button onClick={() => { setMenuOpen(false); navigate(`/board/edit/${post.id}`) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', border: 'none', background: 'transparent',
                    fontSize: 13, color: colors.textDark, cursor: 'pointer', borderRadius: 6 }}>
                  ✏️ 수정
                </button>
                <button onClick={() => { setMenuOpen(false); handleDelete() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', border: 'none', background: 'transparent',
                    fontSize: 13, color: '#d14545', cursor: 'pointer', borderRadius: 6 }}>
                  🗑 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {post.pinned && (
            <span style={{ fontSize: 10.5, fontWeight: 800,
              background: colors.primary, color: '#fff',
              padding: '2px 8px', borderRadius: 8 }}>📌 고정</span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: cc.bg, color: cc.text,
            padding: '3px 8px', borderRadius: 8,
          }}>{CATEGORY_LABEL[catKey] || catKey}</span>
        </div>

        <h2 style={{
          margin: '12px 0 0', fontSize: 20, fontWeight: 900,
          color: colors.textDark, lineHeight: 1.35,
        }}>{post.title}</h2>

        <div style={{
          marginTop: 8, display: 'flex', gap: 10,
          fontSize: 11.5, color: colors.textLight,
        }}>
          <span>{formatDateTime(post.created_at)}</span>
          <span>·</span>
          <span>조회 {post.view_count || 0}</span>
        </div>

        <div style={{
          marginTop: 16, padding: 14,
          background: colors.surface,
          borderRadius: 14,
          border: `1px solid ${colors.border}`,
          fontSize: 14, color: colors.textDark,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>{post.content}</div>

        <AttachmentList attachments={post.post_attachments} />
      </div>
    </div>
  )
}
