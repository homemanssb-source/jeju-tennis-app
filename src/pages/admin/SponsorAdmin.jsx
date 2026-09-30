import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'
import { uploadSponsorImage, deletePopupImage } from '../../lib/popupStorage'

const EMPTY_FORM = {
  company_name: '', description: '', image_url: '', link_url: '',
  start_at: '', end_at: '', sort_order: 0, is_active: true,
}

// timestamptz(ISO) ↔ <input type="date"> 값 (시작은 그날 0시, 종료는 그날 끝까지)
function toDateInput(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}
function startOfDay(v) {
  return v ? new Date(`${v}T00:00:00+09:00`).toISOString() : null
}
function endOfDay(v) {
  // 종료일 다음 날 0시 (end_at 은 "이 시각 전까지" 로 비교)
  if (!v) return null
  const d = new Date(`${v}T00:00:00+09:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}
function fmtRange(b) {
  if (!b.start_at && !b.end_at) return '기간 제한 없음'
  const s = b.start_at ? toDateInput(b.start_at).slice(5).replace('-', '/') : '즉시'
  const e = b.end_at
    ? toDateInput(new Date(new Date(b.end_at).getTime() - 1).toISOString()).slice(5).replace('-', '/')
    : '계속'
  return `${s} ~ ${e}`
}

function getStatus(b) {
  const now = Date.now()
  if (!b.is_active) return { label: '숨김', cls: 'bg-gray-100 text-gray-400' }
  if (b.start_at && new Date(b.start_at).getTime() > now) return { label: '예약', cls: 'bg-yellow-50 text-yellow-600' }
  if (b.end_at && new Date(b.end_at).getTime() <= now) return { label: '종료', cls: 'bg-gray-100 text-gray-500' }
  return { label: '게시 중', cls: 'bg-green-50 text-green-600' }
}

export default function SponsorAdmin() {
  const showToast = useContext(ToastContext)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // 수정 중 새로 올린 이미지 (저장 안 하고 취소하면 정리)
  const [uploadedUrl, setUploadedUrl] = useState(null)

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    setLoading(true)
    const { data, error } = await supabase.from('sponsor_banners')
      .select('*').order('sort_order').order('created_at', { ascending: false })
    if (error) showToast?.(error.message, 'error')
    setBanners(data || [])
    setLoading(false)
  }

  function resetForm({ discardUpload = true } = {}) {
    if (discardUpload && uploadedUrl) deletePopupImage(uploadedUrl)
    setUploadedUrl(null)
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
    setShowUrlInput(false)
  }

  function startEdit(b) {
    resetForm()
    setForm({
      company_name: b.company_name || '',
      description: b.description || '',
      image_url: b.image_url || '',
      link_url: b.link_url || '',
      start_at: toDateInput(b.start_at),
      end_at: b.end_at ? toDateInput(new Date(new Date(b.end_at).getTime() - 1).toISOString()) : '',
      sort_order: b.sort_order || 0,
      is_active: b.is_active,
    })
    setEditingId(b.id)
    setShowForm(true)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSponsorImage(file)
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
    if (!form.company_name.trim()) { showToast?.('업체명을 입력하세요.', 'error'); return }
    if (form.start_at && form.end_at && form.start_at > form.end_at) {
      showToast?.('종료일이 시작일보다 빠를 수 없습니다.', 'error'); return
    }

    const payload = {
      company_name: form.company_name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      link_url: form.link_url.trim() || null,
      start_at: startOfDay(form.start_at),
      end_at: endOfDay(form.end_at),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }

    setSaving(true)
    const prev = editingId ? banners.find(b => b.id === editingId) : null
    const { error } = editingId
      ? await supabase.from('sponsor_banners').update(payload).eq('id', editingId)
      : await supabase.from('sponsor_banners').insert([payload])
    setSaving(false)
    if (error) { showToast?.(error.message, 'error'); return }

    // 이미지를 바꿨으면 이전 이미지 정리 (이 앱이 올린 이미지만 지워짐)
    if (prev?.image_url && prev.image_url !== payload.image_url) deletePopupImage(prev.image_url)

    showToast?.(editingId ? '수정 완료' : '배너 추가 완료')
    resetForm({ discardUpload: false })
    fetchBanners()
  }

  async function handleToggleActive(b) {
    const { error } = await supabase.from('sponsor_banners').update({ is_active: !b.is_active }).eq('id', b.id)
    if (error) { showToast?.(error.message, 'error'); return }
    showToast?.(b.is_active ? '숨김 처리됨' : '다시 게시됨')
    fetchBanners()
  }

  async function handleDelete(b) {
    if (!confirm(`"${b.company_name}" 배너를 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('sponsor_banners').delete().eq('id', b.id)
    if (error) { showToast?.(error.message, 'error'); return }
    if (b.image_url) deletePopupImage(b.image_url)
    showToast?.('삭제 완료')
    fetchBanners()
  }

  // 순서 한 칸 올리기/내리기 (목록 순서대로 sort_order 를 다시 매김)
  async function move(index, dir) {
    const target = index + dir
    if (target < 0 || target >= banners.length) return
    const next = [...banners]
    ;[next[index], next[target]] = [next[target], next[index]]
    setBanners(next)
    const results = await Promise.all(next.map((b, i) =>
      b.sort_order === i ? null : supabase.from('sponsor_banners').update({ sort_order: i }).eq('id', b.id)
    ))
    const failed = results.find(r => r?.error)
    if (failed) showToast?.(failed.error.message, 'error')
    fetchBanners()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">🏢 스폰서 배너 관리</h2>
        <button onClick={() => showForm ? resetForm() : (resetForm(), setShowForm(true))}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? '닫기' : '+ 배너 추가'}
        </button>
      </div>
      <p className="text-xs text-sub mb-4">
        메인 화면 맨 아래 SPONSORS 영역에 로고와 업체명이 나란히 보입니다.
        게시 기간 안의 "게시 중" 배너만 순서대로 보이고, 누르면 링크로 이동합니다.
      </p>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-sub mb-1">업체명 *</label>
            <input type="text" value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              placeholder="예: 제주테니스샵"
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">
              로고 이미지 <span className="text-gray-400">(정사각형 권장 — 없으면 업체명 첫 글자로 표시)</span>
            </label>
            {form.image_url ? (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-line bg-soft">
                {/* 메인 화면에 보이는 모양 그대로 미리보기 */}
                <div className="flex flex-col items-center gap-1 w-16">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-white">
                    <img src={form.image_url} alt="미리보기" className="w-full h-full object-cover"
                      onError={e => { e.target.style.opacity = 0.2 }} />
                  </div>
                  <span className="text-[9px] font-semibold text-gray-400 text-center leading-tight line-clamp-2">
                    {form.company_name || '업체명'}
                  </span>
                </div>
                <div className="flex-1 text-xs text-sub">메인 화면에 이렇게 보입니다.</div>
                <button onClick={removeImage}
                  className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded">
                  이미지 빼기
                </button>
              </div>
            ) : (
              <>
                <label className={`flex items-center justify-center h-20 border-2 border-dashed border-line rounded-lg text-sm text-sub cursor-pointer hover:bg-soft ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploading ? '업로드 중...' : '📷 이미지 선택 (5MB 이하, PNG 투명 배경 유지)'}
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
                {showUrlInput ? (
                  <input type="text" value={form.image_url}
                    onChange={e => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://... (이미지 주소)"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 mt-2" />
                ) : (
                  <button onClick={() => setShowUrlInput(true)}
                    className="text-xs text-sub underline mt-1">이미지 주소로 직접 입력</button>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">설명 <span className="text-gray-400">(선택 — 관리용 메모)</span></label>
            <input type="text" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="예: 라켓·스트링·의류 전문"
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block text-xs text-sub mb-1">링크 <span className="text-gray-400">(선택 — 홈페이지·인스타·네이버지도 주소, 앱 안의 화면은 /shop 처럼)</span></label>
            <input type="text" value={form.link_url}
              onChange={e => setForm({ ...form, link_url: e.target.value })}
              placeholder="https://..."
              className="w-full text-sm border border-line rounded-lg px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sub mb-1">게시 시작일 <span className="text-gray-400">(비우면 바로)</span></label>
              <input type="date" value={form.start_at}
                onChange={e => setForm({ ...form, start_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">게시 종료일 <span className="text-gray-400">(그날까지, 비우면 계속)</span></label>
              <input type="date" value={form.end_at}
                onChange={e => setForm({ ...form, end_at: e.target.value })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">순서 <span className="text-gray-400">(작을수록 왼쪽)</span></label>
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
              {saving ? '저장 중...' : editingId ? '수정 완료' : '추가'}
            </button>
            <button onClick={() => resetForm()} className="text-sm text-sub px-4 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 배너 목록 */}
      {loading ? (
        <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
      ) : banners.length === 0 ? (
        <p className="text-center py-8 text-sub text-sm">등록된 배너가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {banners.map((b, i) => {
            const st = getStatus(b)
            return (
              <div key={b.id} className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${st.label === '게시 중' ? '' : 'opacity-60'}`}>
                <div className="flex flex-col shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-xs text-sub px-1 disabled:opacity-20">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === banners.length - 1}
                    className="text-xs text-sub px-1 disabled:opacity-20">▼</button>
                </div>
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {b.image_url ? (
                    <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-black text-orange-700">
                      {b.company_name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{b.company_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-sub truncate">
                    {fmtRange(b)}
                    {b.link_url ? ` · 🔗 ${b.link_url}` : ' · 링크 없음'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(b)}
                    className="text-xs text-accent hover:underline px-2 py-1">수정</button>
                  <button onClick={() => handleToggleActive(b)}
                    className="text-xs text-yellow-600 hover:underline px-2 py-1">
                    {b.is_active ? '숨기기' : '보이기'}
                  </button>
                  <button onClick={() => handleDelete(b)}
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
