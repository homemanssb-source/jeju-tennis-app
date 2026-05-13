import { useEffect, useState, useContext } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getSession } from '../../lib/supabase'
import { colors, MAIN_TABS } from '../../lib/boardTheme'
import { useAdmin } from '../../hooks/useAdmin'
import { uploadAttachment } from '../../lib/supabaseStorage'
import AttachmentUploader from '../../components/Board/AttachmentUploader'
import { ToastContext } from '../../App'

export default function BoardWrite() {
  const { postId } = useParams()           // edit 모드면 존재
  const navigate = useNavigate()
  const showToast = useContext(ToastContext)
  const { isAdmin, loading: adminLoading } = useAdmin()

  const [category, setCategory]       = useState('club')
  const [subCategory, setSubCategory] = useState('association')
  const [pinned, setPinned]           = useState(false)
  const [title, setTitle]             = useState('')
  const [content, setContent]         = useState('')
  const [files, setFiles]             = useState([])
  const [submitting, setSubmitting]   = useState(false)
  const [loading, setLoading]         = useState(!!postId)

  // 관리자 가드
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      showToast?.('관리자만 작성할 수 있습니다.', 'error')
      navigate('/board')
    }
  }, [adminLoading, isAdmin, navigate, showToast])

  // 편집 모드: 기존 글 로드
  useEffect(() => {
    if (!postId) return
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_attachments(*)')
        .eq('id', postId)
        .single()
      if (!active) return
      if (error) {
        showToast?.('글을 불러올 수 없습니다.', 'error')
        navigate('/board')
        return
      }
      setCategory(data.category)
      setSubCategory(data.sub_category || 'association')
      setPinned(!!data.pinned)
      setTitle(data.title || '')
      setContent(data.content || '')
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [postId, navigate, showToast])

  async function handleSubmit() {
    if (!title.trim()) { showToast?.('제목을 입력하세요.', 'error'); return }
    if (!content.trim()) { showToast?.('내용을 입력하세요.', 'error'); return }
    setSubmitting(true)
    try {
      const session = await getSession()
      const authorId = session?.user?.id || null

      const payload = {
        category,
        sub_category: category === 'notice' ? subCategory : null,
        title: title.trim(),
        content: content,
        pinned: category === 'notice' ? pinned : false,
        author_id: authorId,
      }

      let id = postId
      if (postId) {
        const { error } = await supabase.from('posts').update(payload).eq('id', postId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('posts').insert(payload).select('id').single()
        if (error) throw error
        id = data.id
      }

      // 첨부파일 업로드
      if (files.length > 0) {
        const metas = []
        for (const f of files) {
          const meta = await uploadAttachment(id, f)
          metas.push({ ...meta, post_id: id })
        }
        const { error: attErr } = await supabase.from('post_attachments').insert(metas)
        if (attErr) throw attErr
      }

      showToast?.(postId ? '✅ 수정되었습니다.' : '✅ 등록되었습니다.')
      navigate(`/board/${id}`)
    } catch (e) {
      showToast?.((postId ? '수정' : '등록') + ' 실패: ' + e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (adminLoading || loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: colors.textLight }}>로딩 중...</div>
  }
  if (!isAdmin) return null

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', paddingBottom: 90 }}>
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
          {postId ? '글 수정' : '새 글 작성'}
        </h1>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
        {/* 카테고리 (공지사항 제외 — 공지사항은 /admin/notices에서 작성) */}
        <label style={labelStyle}>카테고리</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
          {MAIN_TABS.filter(t => t.key !== 'notice').map(t => (
            <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
          ))}
        </select>
        <p style={{ margin: '6px 2px 0', fontSize: 11, color: colors.textMid }}>
          ℹ️ 공지사항은 <strong>관리자 → 공지 관리</strong> 페이지에서 작성/수정합니다.
        </p>

        {/* 제목 */}
        <label style={labelStyle}>제목</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          style={inputStyle}
        />

        {/* 내용 */}
        <label style={labelStyle}>내용</label>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={12}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
        />

        {/* 첨부 */}
        <label style={labelStyle}>첨부파일</label>
        <AttachmentUploader files={files} onChange={setFiles} />

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button onClick={() => navigate(-1)} disabled={submitting}
            style={{
              flex: 1, padding: '13px',
              background: colors.surface, color: colors.textMid,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>취소</button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{
              flex: 2, padding: '13px',
              background: colors.primary, color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1,
            }}>{submitting ? '저장 중...' : (postId ? '수정 완료' : '등록')}</button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  marginTop: 14, marginBottom: 6,
  fontSize: 12, fontWeight: 700, color: colors.textDark,
}
const inputStyle = {
  width: '100%', padding: '11px 12px',
  background: colors.surface,
  border: `1px solid ${colors.borderStrong}`,
  borderRadius: 12, fontSize: 14, color: colors.textDark,
  outline: 'none', boxSizing: 'border-box',
}
