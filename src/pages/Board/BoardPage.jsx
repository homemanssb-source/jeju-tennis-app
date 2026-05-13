import { useContext, useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/boardTheme'
import { useAdmin } from '../../hooks/useAdmin'
import BoardTabBar from '../../components/Board/TabBar'
import PostCard from '../../components/Board/PostCard'
import PinnedCard from '../../components/Board/PinnedCard'
import { NoticeList } from '../../components/Notice/NoticeContent'
import { ToastContext } from '../../App'
import { markNoticesRead } from '../../hooks/useNoticeBadge'

export default function BoardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const showToast = useContext(ToastContext)
  const { isAdmin } = useAdmin()

  const category = searchParams.get('tab') || 'notice'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (category === 'notice') {
      const { data } = await supabase.from('notices').select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      setItems(data || [])
    } else {
      const { data } = await supabase.from('posts')
        .select('id, category, sub_category, title, content, pinned, view_count, created_at, post_attachments(id)')
        .eq('category', category)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      setItems((data || []).map(p => ({ ...p, _source: 'post' })))
    }
    setLoading(false)
  }, [category])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (category === 'notice') markNoticesRead()
  }, [category])

  function setTab(t) { setSearchParams({ tab: t }) }

  function handlePostClick(item) {
    navigate(`/board/post/${item.id}`)
  }

  function handleEdit(item) { navigate(`/board/edit/${item.id}`) }

  async function handleDelete(item) {
    if (!confirm(`"${item.title}" 글을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('posts').delete().eq('id', item.id)
    if (error) { showToast?.('삭제 실패: ' + error.message, 'error'); return }
    showToast?.('삭제되었습니다.')
    load()
  }

  function handleFab() {
    if (category === 'notice') navigate('/admin/notices')
    else navigate(`/board/write?tab=${category}`)
  }

  const isNotice       = category === 'notice'
  const pinnedItems    = isNotice ? [] : items.filter(p => p.pinned)
  const regularItems   = isNotice ? items : items.filter(p => !p.pinned)
  const showDisclaimer = !isNotice

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
          style={{ background: 'transparent', border: 'none',
            fontSize: 18, color: colors.textDark, cursor: 'pointer' }}>←</button>
        <h1 style={{
          margin: 0, fontSize: 16, fontWeight: 900,
          color: colors.textDark, flex: 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          JTA 광장
          <span style={{
            width: 6, height: 6, borderRadius: 3,
            background: colors.primary, display: 'inline-block',
          }} />
        </h1>
      </div>

      {/* 메인 탭 */}
      <BoardTabBar value={category} onChange={setTab} />

      {/* 목록 */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '12px 16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: colors.textLight, fontSize: 13, padding: 40 }}>
            로딩 중...
          </p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 36, margin: 0 }}>{isNotice ? '📭' : '🎾'}</p>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: colors.textMid }}>
              {isNotice ? '등록된 공지가 없습니다' : '아직 등록된 글이 없습니다'}
            </p>
          </div>
        ) : isNotice ? (
          // 공지사항: 기존 NoticePage와 동일한 카드 디자인
          <NoticeList
            notices={items}
            onSelectTournament={n => navigate(`/board/notice/${n.id}`)}
          />
        ) : (
          // 클럽/용품/레슨: posts 테이블 + 기본 카드
          <>
            {pinnedItems.map(p => (
              <PinnedCard key={p.id} post={p} isAdmin={isAdmin}
                onClick={() => handlePostClick(p)}
                onEdit={handleEdit}
                onDelete={handleDelete} />
            ))}
            {regularItems.map(p => (
              <PostCard key={p.id} post={p} isAdmin={isAdmin}
                onClick={() => handlePostClick(p)}
                onEdit={handleEdit}
                onDelete={handleDelete} />
            ))}
          </>
        )}
      </div>

      {/* FAB (admin only) */}
      {isAdmin && (
        <button
          onClick={handleFab}
          style={{
            position: 'fixed', right: 16, bottom: 80, zIndex: 20,
            width: 56, height: 56, borderRadius: 28,
            background: colors.primary, color: '#fff',
            border: 'none', fontSize: 24, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(192,97,43,0.35)',
          }}
          aria-label="글 작성">＋</button>
      )}

      {/* 면책 스트립 (공지사항 제외) */}
      {showDisclaimer && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 56,
          background: colors.primaryTint,
          borderTop: `1px solid ${colors.border}`,
          padding: '8px 16px',
          fontSize: 11, color: colors.textMid, textAlign: 'center',
          lineHeight: 1.4,
        }}>
          ℹ️ 본 정보는 협회가 단순 게시만 하며, 거래·계약에는 관여하지 않습니다.
        </div>
      )}
    </div>
  )
}
