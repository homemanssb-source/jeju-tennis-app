import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { uploadPopupImage, deletePopupImage } from '../../lib/popupStorage'

const EMPTY_FORM = {
  title: '', content: '', image_url: '', link_url: '',
  start_at: '', end_at: '', sort_order: 0, is_active: true,
}

// timestamptz(ISO) ↔ <input type="datetime-local"> 값 (브라우저 로컬 시각 기준)
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null
}
function fmt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getStatus(p) {
  const now = Date.now()
  if (!p.is_active) return { label: '숨김', cls: 'bg-gray-100 text-gray-400' }
  if (p.start_at && new Date(p.start_at).getTime() > now) return { label: '예약', cls: 'bg-yellow-50 text-yellow-600' }
  if (p.end_at && new Date(p.end_at).getTime() <= now) return { label: '종료', cls: 'bg-gray-100 text-gray-500' }
  return { label: '게시 중', cls: 'bg-green-50 text-green-600' }
}

export default function PopupAdmin() {
  const showToast = useContext(ToastContext)
  const [popups, setPopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // 수정 중 새로 올린 이미지 (저장 안 하고 취소하면 정리)
  const [uploadedUrl, setUploadedUrl] = useState(null)

  useEffect(() => { fetchPopups() }, [])

  async function fetchPopups() {
    setLoading(true)
    const { data, error } = await supabase.from('home_popups')
      .select('*').order('sort_order').order('created_at', { ascending: false })
    if (error) showToast?.(error.message, 'error')
    setPopups(data || [])
    setLoading(false)
  }

  function resetForm({ discardUpload = true } = {}) {
    if (discardUpload && uploadedUrl) deletePopupImage(uploadedUrl)
    setUploadedUrl(null)
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(p) {
    resetForm()
    setForm({
      title: p.title || '',
      content: p.content || '',
      image_url: p.image_url || '',
      link_url: p.link_url || '',
      start_at: toLocalInput(p.start_at),
      end_at: toLocalInput(p.end_at),
      sort_order: p.sort_order || 0,
      is_active: p.is_active,
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadPopupImage(file)
      if (uploadedUrl) deletePopupImage(uploadedUrl)
      setUploadedUrl(url)
      setForm(f => ({ ...f, image_url: url }))
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  function removeImage() {
    if (uploadedUrl) { deletePopupImage(uploadedUrl); setUploadedUrl(null) }
    setForm(f => ({ ...f, image_url: '' }))
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast?.('제목을 입력하세요.', 'error'); return }
    if (!form.image_url && !form.content.trim()) {
      showToast?.('이미지나 내용 중 하나는 있어야 합니다.', 'error'); return
    }
    if (form.start_at && form.end_at && form.start_at >= form.end_at) {
      showToast?.('종료 시각이 시작 시각보다 늦어야 합니다.', 'error'); return
    }

    const payload = {
      title: form.title.trim(),
      content: form.content.trim() || null,
      image_url: form.image_url || null,
      link_url: form.link_url.trim() || null,
      start_at: fromLocalInput(form.start_at),
      end_at: fromLocalInput(form.end_at),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }

    setSaving(true)
    const prev = editingId ? popups.find(p => p.id === editingId) : null
    const { error } = editingId
      ? await supabase.from('home_popups').update(payload).eq('id', editingId)
      : await supabase.from('home_popups').insert([payload])
    setSaving(false)
    if (error) { showToast?.(error.message, 'error'); return }

    // 이미지를 바꿨으면 이전 이미지 정리
    if (prev?.image_url && prev.image_url !== payload.image_url) deletePopupImage(prev.image_url)

    showToast?.(editingId ? '수정 완료' : '팝업 등록 완료')
    resetForm({ discardUpload: false })
    fetchPopups()
  }

  async function handleToggleActive(p) {
    const { error } = await supabase.from('home_popups').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.(p.is_active ? '숨김 처리됨' : '다시 게시됨')
    fetchPopups()
  }

  async function handleDelete(p) {
    if (!confirm(`"${p.title}" 팝업을 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('home_popups').delete().eq('id', p.id)
    if (error) { showToast?.(error.message, 'error'); return }
    if (p.image_url) deletePopupImage(p.image_url)
    showToast?.('삭제 완료')
    fetchPopups()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">🪧 메인 팝업 관리</h2>
        <button onClick={() => showForm ? resetForm() : (resetForm(), setShowForm(true))}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? '닫기' : '+ 팝업 추가'}
        </button>
      </div>
      <p className="text-xs text-sub mb-4">
        앱 메인 화면에 들어오면 뜨는 팝업입니다. 게시 기간 안의 "게시 중" 팝업만 순서대로 보이고,
        회원이 "오늘 하루 보지 않기"를 누르면 그날은 다시 뜨지 않습니다.
      </p>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-sub mb-1">제목 * <span className="text-gray-400">(이미지가 없을 때 팝업 상단에 표시)</span></label>
            <input type="text" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="예: 2026 제주시장배 참가 접수 안내"
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">이미지</label>
            {form.image_url ? (
              <div className="relative rounded-lg overflow-hidden border border-line bg-soft">
                <img src={form.image_url} alt="미리보기" className="w-full max-h-72 object-contain" />
                <button onClick={removeImage}
                  className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  이미지 빼기
                </button>
              </div>
            ) : (
              <label className={`flex items-center justify-center h-24 border-2 border-dashed border-line rounded-lg text-sm text-sub cursor-pointer hover:bg-soft ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? '업로드 중...' : '📷 이미지 선택 (5MB 이하, 세로 포스터도 가능)'}
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">내용 <span className="text-gray-400">(선택 — 이미지 아래에 글로 표시)</span></label>
            <textarea value={form.content} rows={3}
              onChange={e => setForm({ ...form, content: e.target.value })}
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">링크 <span className="text-gray-400">(선택 — 앱 안의 화면은 /entry, /notice 처럼, 외부는 https://...)</span></label>
            <input type="text" value={form.link_url}
              onChange={e => setForm({ ...form, link_url: e.target.value })}
              placeholder="/entry"
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sub mb-1">게시 시작 <span className="text-gray-400">(비우면 바로)</span></label>
              <input type="datetime-local" value={form.start_at}
                onChange={e => setForm({ ...form, start_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">게시 종료 <span className="text-gray-400">(비우면 계속)</span></label>
              <input type="datetime-local" value={form.end_at}
                onChange={e => setForm({ ...form, end_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">순서 <span className="text-gray-400">(작을수록 먼저)</span></label>
              <input type="number" value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-5">
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              게시하기
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || uploading}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? '저장 중...' : editingId ? '수정 완료' : '등록'}
            </button>
            <button onClick={() => resetForm()} className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 팝업 목록 */}
      {loading ? (
        <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
      ) : popups.length === 0 ? (
        <p className="text-center py-8 text-sub text-sm">등록된 팝업이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {popups.map(p => {
            const st = getStatus(p)
            return (
              <div key={p.id} className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${st.label === '게시 중' ? '' : 'opacity-60'}`}>
                <div className="w-12 h-16 rounded overflow-hidden bg-gray-100 shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">📝</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-sub truncate">
                    {p.start_at || p.end_at
                      ? `${p.start_at ? fmt(p.start_at) : '즉시'} ~ ${p.end_at ? fmt(p.end_at) : '계속'}`
                      : '기간 제한 없음'}
                    {' · '}순서 {p.sort_order}
                    {p.link_url && ` · 🔗 ${p.link_url}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(p)}
                    className="text-xs text-accent hover:underline px-2 py-1">수정</button>
                  <button onClick={() => handleToggleActive(p)}
                    className="text-xs text-yellow-600 hover:underline px-2 py-1">
                    {p.is_active ? '숨기기' : '보이기'}
                  </button>
                  <button onClick={() => handleDelete(p)}
                    className="text-xs text-red-500 hover:underline px-2 py-1">삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
