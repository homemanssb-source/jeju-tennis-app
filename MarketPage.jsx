// src/pages/MarketPage.jsx
import { useState, useEffect, useContext, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { uploadMarketImage, deleteMarketImage } from '../lib/marketStorage'
import PageHeader from '../components/PageHeader'
import { ToastContext } from '../App'

const CATEGORIES = ['전체', '라켓', '스트링', '신발', '가방', '의류', '기타']
const CONDITIONS = ['새 상품', '거의 새것', '사용감 있음']
const STATUSES   = ['판매중', '예약중', '거래완료']

const STATUS_STYLE = {
  '판매중':  'bg-green-50 text-green-700',
  '예약중':  'bg-amber-50 text-amber-700',
  '거래완료': 'bg-gray-100 text-gray-400',
}

const REPORT_REASONS = [
  '허위/과장 정보',
  '부적절한 내용',
  '사기 의심',
  '중복 게시물',
  '기타',
]

// ─── PIN 인증 모달 ────────────────────────────────────────
function PinModal({ open, onClose, onVerified }) {
  const showToast = useContext(ToastContext)
  const [name, setName]       = useState('')
  const [pin, setPin]         = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!open) { setName(''); setPin('') } }, [open])

  async function handleVerify() {
    if (!name.trim()) { showToast('이름을 입력해주세요.', 'error'); return }
    if (pin.length !== 6) { showToast('PIN 6자리를 입력해주세요.', 'error'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('rpc_verify_member_pin', {
      p_name: name.trim(), p_pin: pin,
    })
    setLoading(false)
    if (error || !data?.ok) {
      showToast(data?.message || '인증 실패. 이름 또는 PIN을 확인해주세요.', 'error')
      return
    }
    onVerified(data)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 pt-5"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-bold text-gray-900 mb-1">회원 인증</h3>
        <p className="text-xs text-sub mb-4">등록된 이름과 PIN 6자리를 입력해주세요.</p>
        <label className="block text-xs font-medium text-gray-700 mb-1">이름</label>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          placeholder="홍길동"
          className="w-full border border-line rounded-xl px-3 py-2.5 text-sm mb-3" />
        <label className="block text-xs font-medium text-gray-700 mb-1">PIN 6자리</label>
        <input type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
          placeholder="••••••"
          className="w-full border border-line rounded-xl px-3 py-2.5 text-sm mb-5 tracking-widest" />
        <button onClick={handleVerify} disabled={loading}
          className="w-full bg-accent text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
          {loading ? '인증 중...' : '인증하기'}
        </button>
      </div>
    </div>
  )
}

// ─── 신고 모달 ───────────────────────────────────────────
function ReportModal({ open, postId, memberId, onClose }) {
  const showToast = useContext(ToastContext)
  const [reason, setReason]   = useState('')
  const [custom, setCustom]   = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { if (!open) { setReason(''); setCustom('') } }, [open])

  async function handleSubmit() {
    const finalReason = reason === '기타' ? custom.trim() : reason
    if (!finalReason) { showToast('신고 사유를 입력해주세요.', 'error'); return }
    setSending(true)
    const { error } = await supabase.from('market_reports').insert({
      post_id: postId, member_id: memberId, reason: finalReason,
    })
    setSending(false)
    if (error) { showToast('신고 접수 실패', 'error'); return }
    showToast('신고가 접수되었습니다. 검토 후 처리합니다.')
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl px-5 pt-5"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-bold text-gray-900 mb-1">게시물 신고</h3>
        <p className="text-xs text-sub mb-4">신고 사유를 선택해주세요. 검토 후 조치됩니다.</p>
        <div className="space-y-2 mb-4">
          {REPORT_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-colors
                ${reason === r ? 'bg-red-50 border-red-300 text-red-700 font-medium' : 'border-line text-gray-700'}`}>
              {r}
            </button>
          ))}
        </div>
        {reason === '기타' && (
          <textarea value={custom} onChange={e => setCustom(e.target.value)}
            placeholder="신고 사유를 직접 입력해주세요."
            rows={3}
            className="w-full border border-line rounded-xl px-3 py-2.5 text-sm mb-4 resize-none" />
        )}
        <button onClick={handleSubmit} disabled={!reason || sending}
          className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
          {sending ? '접수 중...' : '신고하기'}
        </button>
      </div>
    </div>
  )
}

// ─── 이미지 업로더 ────────────────────────────────────────
function ImageUploader({ memberId, images, onChange, maxCount = 4 }) {
  const inputRef = useRef()
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    if (images.length + files.length > maxCount) {
      alert(`사진은 최대 ${maxCount}장까지 등록 가능합니다.`)
      e.target.value = ''; return
    }
    setUploading(true)
    try {
      const urls = []
      for (const f of files) urls.push(await uploadMarketImage(f, memberId))
      onChange([...images, ...urls])
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemove(idx) {
    const url = images[idx]
    onChange(images.filter((_, i) => i !== idx))
    await deleteMarketImage(url)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {images.map((url, idx) => (
        <div key={idx} className="relative w-20 h-20 flex-shrink-0">
          <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-line" />
          <button type="button" onClick={() => handleRemove(idx)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white
                       rounded-full text-xs flex items-center justify-center shadow">×</button>
        </div>
      ))}
      {images.length < maxCount && (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-line rounded-xl
                     flex flex-col items-center justify-center text-sub text-xs gap-1 active:bg-soft flex-shrink-0">
          {uploading
            ? <span className="text-[10px] text-accent">업로드 중...</span>
            : <><span className="text-2xl leading-none text-sub">+</span><span>사진 추가</span></>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={handleFileChange} />
    </div>
  )
}

// ─── 게시물 등록/수정 폼 ──────────────────────────────────
function PostForm({ member, editPost, onClose, onSaved }) {
  const showToast = useContext(ToastContext)
  const [form, setForm] = useState({
    title:     editPost?.title     || '',
    content:   editPost?.content   || '',
    price:     editPost?.price     ?? '',
    category:  editPost?.category  || '라켓',
    condition: editPost?.condition || '거의 새것',
    images:    editPost?.images    || [],
  })
  const [saving, setSaving] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.title.trim())                         { showToast('제목을 입력해주세요.', 'error'); return }
    if (form.price === '' || isNaN(Number(form.price))) { showToast('가격을 입력해주세요.', 'error'); return }
    if (!form.content.trim())                       { showToast('설명을 입력해주세요.', 'error'); return }
    setSaving(true)
    const payload = {
      member_id: member.member_id, author_name: member.name, club: member.club || '',
      title: form.title.trim(), content: form.content.trim(),
      price: Number(form.price), category: form.category,
      condition: form.condition, images: form.images,
    }
    let error
    if (editPost) {
      ;({ error } = await supabase.from('market_posts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('post_id', editPost.post_id))
    } else {
      ;({ error } = await supabase.from('market_posts').insert(payload))
    }
    setSaving(false)
    if (error) { showToast('저장 실패: ' + error.message, 'error'); return }
    showToast(editPost ? '수정 완료!' : '게시물 등록 완료!')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
        <button onClick={onClose} className="text-sub text-sm">취소</button>
        <span className="font-bold text-gray-900 text-sm">{editPost ? '게시물 수정' : '판매 등록'}</span>
        <button onClick={handleSave} disabled={saving}
          className="text-accent font-semibold text-sm disabled:opacity-50">
          {saving ? '저장 중...' : '완료'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">사진 (최대 4장)</p>
          <ImageUploader memberId={member.member_id} images={form.images}
            onChange={v => setField('images', v)} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">카테고리</p>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.filter(c => c !== '전체').map(c => (
              <button key={c} type="button" onClick={() => setField('category', c)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors
                  ${form.category === c ? 'bg-accent text-white border-accent' : 'border-line text-sub'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">제목</p>
          <input value={form.title} onChange={e => setField('title', e.target.value)}
            placeholder="예) 윌슨 프로스태프 97 판매합니다"
            className="w-full border border-line rounded-xl px-3 py-2.5 text-sm" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">가격</p>
          <div className="relative">
            <input type="number" inputMode="numeric"
              value={form.price} onChange={e => setField('price', e.target.value)}
              placeholder="0" className="w-full border border-line rounded-xl px-3 py-2.5 text-sm pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sub">원</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">상품 상태</p>
          <div className="flex gap-2">
            {CONDITIONS.map(c => (
              <button key={c} type="button" onClick={() => setField('condition', c)}
                className={`flex-1 py-2 rounded-xl text-xs border transition-colors
                  ${form.condition === c ? 'bg-accent text-white border-accent' : 'border-line text-sub'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">설명</p>
          <textarea value={form.content} onChange={e => setField('content', e.target.value)}
            placeholder="상품 설명, 사용 기간, 거래 방식 등을 적어주세요."
            rows={5} className="w-full border border-line rounded-xl px-3 py-2.5 text-sm resize-none" />
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed pb-4">
          ※ 본 게시판은 회원 간 직거래를 위한 공간입니다. 거래에 관한 분쟁은 당사자 간 해결을 원칙으로 하며,
          제주시테니스협회는 책임을 지지 않습니다.
        </p>
      </div>
    </div>
  )
}

// ─── 상세 보기 ────────────────────────────────────────────
function PostDetail({ post: initialPost, member, onClose, onUpdated }) {
  const showToast = useContext(ToastContext)
  const [post, setPost]           = useState(initialPost)
  const [comments, setComments]   = useState([])
  const [liked, setLiked]         = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [isPrivate, setIsPrivate]     = useState(false)
  const [imgIdx, setImgIdx]           = useState(0)
  const [commentMember, setCommentMember] = useState(null)
  const [submitting, setSubmitting]       = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showEditForm, setShowEditForm]     = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  // pinTarget: null | 'comment' | 'like' | 'edit' | { action:'status', newStatus } | { action:'delete' } | 'report'
  const [pinTarget, setPinTarget] = useState(null)
  const [reportMemberId, setReportMemberId] = useState(null)

  const isOwner = member && post.member_id === member.member_id
  const isDone  = post.status === '거래완료'
  const images  = post.images || []

  useEffect(() => { fetchComments(); fetchLikes() }, [post.post_id])

  async function fetchComments() {
    const { data } = await supabase.from('market_comments')
      .select('*').eq('post_id', post.post_id).order('created_at')
    // 비밀 댓글 필터: 본인(판매자 or 작성자)만 열람
    const visible = (data || []).filter(c => {
      if (!c.is_private) return true
      if (!member) return false
      return c.member_id === member.member_id || member.member_id === post.member_id
    })
    setComments(visible)
  }

  async function fetchLikes() {
    const { count } = await supabase.from('market_likes')
      .select('*', { count: 'exact', head: true }).eq('post_id', post.post_id)
    setLikeCount(count || 0)
    if (member) {
      const { data } = await supabase.from('market_likes')
        .select('id').eq('post_id', post.post_id).eq('member_id', member.member_id).maybeSingle()
      setLiked(!!data)
    }
  }

  async function handleLike(m) {
    if (liked) {
      await supabase.from('market_likes').delete()
        .eq('post_id', post.post_id).eq('member_id', m.member_id)
      setLiked(false); setLikeCount(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('market_likes').insert({ post_id: post.post_id, member_id: m.member_id })
      setLiked(true); setLikeCount(prev => prev + 1)
    }
  }

  async function submitComment() {
    if (!commentText.trim() || !commentMember) return
    setSubmitting(true)
    const { error } = await supabase.from('market_comments').insert({
      post_id: post.post_id, member_id: commentMember.member_id,
      author_name: commentMember.name, content: commentText.trim(),
      is_private: isPrivate,
    })
    setSubmitting(false)
    if (error) { showToast('댓글 등록 실패', 'error'); return }
    setCommentText('')
    fetchComments()
  }

  async function handleDeleteComment(cid) {
    await supabase.from('market_comments').delete().eq('comment_id', cid)
    fetchComments()
  }

  async function handleStatusChange(m, newStatus) {
    if (m.member_id !== post.member_id) { showToast('본인 게시물만 변경 가능합니다.', 'error'); return }
    const { error } = await supabase.from('market_posts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('post_id', post.post_id)
    if (error) { showToast('상태 변경 실패', 'error'); return }
    setPost(p => ({ ...p, status: newStatus }))
    setShowStatusMenu(false); setPinTarget(null)
    showToast('상태가 변경되었습니다.')
    onUpdated()
  }

  async function handleDelete(m) {
    if (m.member_id !== post.member_id) { showToast('본인 게시물만 삭제 가능합니다.', 'error'); return }
    for (const url of images) await deleteMarketImage(url)
    const { error } = await supabase.from('market_posts').delete().eq('post_id', post.post_id)
    if (error) { showToast('삭제 실패', 'error'); return }
    showToast('게시물이 삭제되었습니다.')
    onUpdated(); onClose()
  }

  function handlePinVerified(m) {
    const t = pinTarget
    setPinTarget(null)
    if (t === 'comment')       { setCommentMember(m) }
    else if (t === 'like')     { handleLike(m) }
    else if (t === 'edit')     {
      if (m.member_id !== post.member_id) { showToast('본인 게시물만 수정할 수 있습니다.', 'error'); return }
      setShowEditForm(true)
    }
    else if (t === 'report')   { setReportMemberId(m.member_id); setShowReportModal(true) }
    else if (t?.action === 'status') { handleStatusChange(m, t.newStatus) }
    else if (t?.action === 'delete') { handleDelete(m) }
  }

  if (showEditForm && member) {
    return (
      <PostForm member={member} editPost={post}
        onClose={() => setShowEditForm(false)}
        onSaved={async () => {
          const { data } = await supabase.from('market_posts')
            .select('*').eq('post_id', post.post_id).single()
          if (data) setPost(data)
          onUpdated()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0">
        <button onClick={onClose} className="text-2xl leading-none text-sub px-1">‹</button>
        <span className="font-bold text-sm text-gray-900">용품 거래</span>
        <div className="flex gap-3 items-center">
          {isOwner ? (
            <>
              <button onClick={() => setPinTarget('edit')} className="text-xs text-accent font-medium">수정</button>
              <button onClick={() => setPinTarget({ action: 'delete' })} className="text-xs text-red-400 font-medium">삭제</button>
            </>
          ) : (
            <button onClick={() => setPinTarget('report')} className="text-xs text-sub">신고</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 이미지 */}
        {images.length > 0 ? (
          <div className="relative bg-gray-100 select-none">
            <img src={images[imgIdx]} alt=""
              className={`w-full aspect-square object-cover ${isDone ? 'opacity-50' : ''}`} />
            {images.length > 1 && (
              <>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {images.map((_, dotIdx) => (
                    <button key={dotIdx} onClick={() => setImgIdx(dotIdx)}
                      className={`w-1.5 h-1.5 rounded-full ${dotIdx === imgIdx ? 'bg-white' : 'bg-white/50'}`} />
                  ))}
                </div>
                {imgIdx > 0 && (
                  <button onClick={() => setImgIdx(prev => prev - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8
                               bg-black/30 rounded-full text-white flex items-center justify-center text-lg">‹</button>
                )}
                {imgIdx < images.length - 1 && (
                  <button onClick={() => setImgIdx(prev => prev + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8
                               bg-black/30 rounded-full text-white flex items-center justify-center text-lg">›</button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-soft flex items-center justify-center text-6xl">🎾</div>
        )}

        <div className="px-4 py-4 space-y-4">
          {/* 상태 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[post.status]}`}>
              {post.status}
            </span>
            <span className="text-xs text-sub">{post.category} · {post.condition}</span>
          </div>

          {/* 제목 + 가격 */}
          <div>
            <h2 className={`text-base font-bold mb-1 ${isDone ? 'text-sub' : 'text-gray-900'}`}>{post.title}</h2>
            <p className={`text-xl font-bold ${isDone ? 'text-sub line-through' : 'text-accent'}`}>
              {Number(post.price).toLocaleString()}원
            </p>
          </div>

          {/* 판매자 + 상태 변경 */}
          <div className="flex items-center gap-2 py-3 border-t border-b border-line">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                            text-sm font-bold text-blue-700 flex-shrink-0">
              {post.author_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{post.author_name}</p>
              <p className="text-xs text-sub">{post.club || ''}</p>
            </div>
            {isOwner && (
              <div className="relative flex-shrink-0">
                <button onClick={() => setShowStatusMenu(s => !s)}
                  className="text-xs border border-line rounded-lg px-3 py-1.5 text-sub">
                  상태 변경
                </button>
                {showStatusMenu && (
                  <div className="absolute right-0 top-9 bg-white border border-line rounded-xl
                                  shadow-lg p-1 min-w-[100px] z-10">
                    {STATUSES.map(s => (
                      <button key={s}
                        onClick={() => { setShowStatusMenu(false); setPinTarget({ action: 'status', newStatus: s }) }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-soft
                          ${post.status === s ? 'font-bold text-accent' : 'text-gray-700'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 설명 */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>

          {/* 댓글 */}
          <div className="border-t border-line pt-4">
            <p className="text-sm font-bold text-gray-900 mb-3">댓글 {comments.length}</p>
            {comments.length === 0 && (
              <p className="text-xs text-sub text-center py-4">첫 댓글을 남겨보세요.</p>
            )}
            <div className="space-y-3 mb-3">
              {comments.map(c => (
                <div key={c.comment_id}
                  className={`flex gap-2 p-2.5 rounded-xl
                    ${c.is_private ? 'bg-amber-50 border border-amber-100' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center
                                  text-xs font-bold text-blue-600 flex-shrink-0">
                    {c.author_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-gray-800">{c.author_name}</span>
                      {c.member_id === post.member_id && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">판매자</span>
                      )}
                      {c.is_private && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🔒 비밀</span>
                      )}
                      <span className="text-[10px] text-sub">
                        {new Date(c.created_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mt-0.5 break-words">{c.content}</p>
                  </div>
                  {member && c.member_id === member.member_id && (
                    <button onClick={() => handleDeleteComment(c.comment_id)}
                      className="text-[10px] text-red-400 flex-shrink-0 self-start mt-1">삭제</button>
                  )}
                </div>
              ))}
            </div>

            {/* 댓글 입력 */}
            {commentMember ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={commentText} onChange={e => setCommentText(e.target.value)}
                    placeholder={`${commentMember.name}으로 댓글 작성...`}
                    onKeyDown={e => e.key === 'Enter' && !isPrivate && submitComment()}
                    className="flex-1 border border-line rounded-xl px-3 py-2 text-xs" />
                  <button onClick={submitComment} disabled={submitting || !commentText.trim()}
                    className="bg-accent text-white px-3 py-2 rounded-xl text-xs font-medium
                               disabled:opacity-50 flex-shrink-0">
                    등록
                  </button>
                </div>
                {/* 비밀 댓글 토글 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setIsPrivate(v => !v)}
                    className={`w-8 h-4 rounded-full transition-colors flex items-center
                      ${isPrivate ? 'bg-amber-400' : 'bg-gray-200'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5
                      ${isPrivate ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-[11px] text-sub">
                    {isPrivate ? '🔒 비밀 댓글 (판매자와 나만 볼 수 있어요)' : '공개 댓글'}
                  </span>
                </label>
              </div>
            ) : (
              <button onClick={() => setPinTarget('comment')}
                className="w-full border border-line rounded-xl py-2.5 text-xs text-sub">
                댓글 달기 (PIN 인증 필요)
              </button>
            )}
          </div>
          <div className="h-6" />
        </div>
      </div>

      {/* 하단 */}
      <div className="border-t border-line px-4 py-3 flex gap-3 flex-shrink-0">
        <button onClick={() => setPinTarget('like')}
          className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl transition-colors
            ${liked ? 'border-red-300 bg-red-50 text-red-500' : 'border-line text-sub'}`}>
          {liked ? '♥' : '♡'}
        </button>
        <div className="flex items-center flex-1">
          {likeCount > 0 && <span className="text-xs text-sub">관심 {likeCount}명</span>}
        </div>
        <button onClick={() => setPinTarget('comment')}
          className="flex-1 bg-accent text-white rounded-xl text-sm font-semibold py-2.5">
          문의하기
        </button>
      </div>

      {/* 통합 PIN 모달 */}
      <PinModal open={!!pinTarget} onClose={() => setPinTarget(null)} onVerified={handlePinVerified} />

      {/* 신고 모달 */}
      <ReportModal
        open={showReportModal}
        postId={post.post_id}
        memberId={reportMemberId}
        onClose={() => { setShowReportModal(false); setReportMemberId(null) }}
      />
    </div>
  )
}

// ─── 목록 ────────────────────────────────────────────────
export default function MarketPage() {
  const showToast = useContext(ToastContext)
  const [posts, setPosts]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [category, setCategory]         = useState('전체')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectedPost, setSelectedPost] = useState(null)
  const [showForm, setShowForm]         = useState(false)
  const [showPin, setShowPin]           = useState(false)
  const [member, setMember]             = useState(null)

  useEffect(() => { fetchPosts() }, [category, statusFilter])

  async function fetchPosts() {
    setLoading(true)
    let q = supabase.from('market_posts').select('*').order('created_at', { ascending: false })
    if (category !== '전체')     q = q.eq('category', category)
    if (statusFilter !== '전체') q = q.eq('status', statusFilter)
    const { data, error } = await q
    if (error) showToast('게시물 불러오기 실패', 'error')
    setPosts(data || [])
    setLoading(false)
  }

  function handleFabClick() {
    if (member) setShowForm(true)
    else setShowPin(true)
  }

  function formatTime(ts) {
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60)    return '방금 전'
    if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="🛒 용품 거래"
        subtitle="회원 간 테니스 용품 직거래"
        right={member ? <span className="text-xs text-accent font-medium">{member.name} ✓</span> : null}
      />

      {/* 카테고리 */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto hide-scrollbar border-b border-line">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${category === c ? 'bg-accent text-white border-accent' : 'border-line text-sub bg-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 px-4 py-2 border-b border-line">
        {['전체', '판매중', '예약중', '거래완료'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors
              ${statusFilter === s ? 'bg-gray-800 text-white' : 'text-sub'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="divide-y divide-line">
          {[1, 2, 3].map(n => (
            <div key={n} className="px-4 py-4 flex gap-3 animate-pulse">
              <div className="w-20 h-20 rounded-xl bg-soft flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-soft rounded w-1/3" />
                <div className="h-4 bg-soft rounded w-2/3" />
                <div className="h-3 bg-soft rounded w-1/4" />
                <div className="h-4 bg-soft rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-sub">
          <p className="text-4xl mb-3">🎾</p>
          <p className="text-sm">등록된 게시물이 없습니다.</p>
          <p className="text-xs mt-1">+ 버튼으로 첫 판매 글을 올려보세요!</p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {posts.map(post => {
            const isDone = post.status === '거래완료'
            return (
              <button key={post.post_id} onClick={() => setSelectedPost(post)}
                className="w-full text-left px-4 py-4 bg-white active:bg-soft flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-soft flex-shrink-0 overflow-hidden border border-line">
                  {post.images?.[0]
                    ? <img src={post.images[0]} alt=""
                        className={`w-full h-full object-cover ${isDone ? 'opacity-40' : ''}`} />
                    : <span className="w-full h-full flex items-center justify-center text-3xl">🎾</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[post.status]}`}>
                      {post.status}
                    </span>
                    <span className="text-[10px] text-sub">{post.category}</span>
                  </div>
                  <p className={`text-sm font-medium truncate ${isDone ? 'text-sub line-through' : 'text-gray-900'}`}>
                    {post.title}
                  </p>
                  <p className="text-[11px] text-sub mt-0.5 truncate">
                    {post.author_name}{post.club ? ` · ${post.club}` : ''}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-sm font-bold ${isDone ? 'text-sub line-through' : 'text-gray-900'}`}>
                      {Number(post.price).toLocaleString()}원
                    </span>
                    <span className="text-[10px] text-sub">{formatTime(post.created_at)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button onClick={handleFabClick}
        className="fixed bottom-20 right-4 w-14 h-14 bg-accent text-white rounded-full
                   shadow-lg text-3xl flex items-center justify-center z-30
                   active:scale-95 transition-transform">
        +
      </button>

      <PinModal open={showPin} onClose={() => setShowPin(false)}
        onVerified={m => { setMember(m); setShowPin(false); setShowForm(true) }} />

      {showForm && member && (
        <PostForm member={member} onClose={() => setShowForm(false)} onSaved={fetchPosts} />
      )}

      {selectedPost && (
        <PostDetail post={selectedPost} member={member}
          onClose={() => setSelectedPost(null)} onUpdated={fetchPosts} />
      )}
    </div>
  )
}
