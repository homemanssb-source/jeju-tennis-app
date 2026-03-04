import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function SponsorAdmin() {
  const showToast = useContext(ToastContext)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    company_name: '', description: '', image_url: '', link_url: '', sort_order: 0,
  })

  useEffect(() => { fetchBanners() }, [])

  async function fetchBanners() {
    setLoading(true)
    const { data } = await supabase.from('sponsor_banners')
      .select('*').order('sort_order').order('created_at', { ascending: false })
    setBanners(data || [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ company_name: '', description: '', image_url: '', link_url: '', sort_order: 0 })
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(b) {
    setForm({
      company_name: b.company_name || '',
      description: b.description || '',
      image_url: b.image_url || '',
      link_url: b.link_url || '',
      sort_order: b.sort_order || 0,
    })
    setEditingId(b.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.company_name) { showToast?.('업체명을 입력하세요.', 'error'); return }

    if (editingId) {
      const { error } = await supabase.from('sponsor_banners').update({
        company_name: form.company_name,
        description: form.description || null,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        sort_order: form.sort_order,
      }).eq('id', editingId)
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('수정 완료')
    } else {
      const { error } = await supabase.from('sponsor_banners').insert([{
        company_name: form.company_name,
        description: form.description || null,
        image_url: form.image_url || null,
        link_url: form.link_url || null,
        sort_order: form.sort_order,
      }])
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('배너 추가 완료')
    }
    resetForm()
    fetchBanners()
  }

  async function handleToggleActive(b) {
    await supabase.from('sponsor_banners').update({ is_active: !b.is_active }).eq('id', b.id)
    showToast?.(b.is_active ? '비활성화됨' : '활성화됨')
    fetchBanners()
  }

  async function handleDelete(b) {
    if (!confirm(`"${b.company_name}" 배너를 삭제하시겠습니까?`)) return
    await supabase.from('sponsor_banners').delete().eq('id', b.id)
    showToast?.('삭제 완료')
    fetchBanners()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🏢 업체 홍보 배너 관리</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? '닫기' : '+ 배너 추가'}
        </button>
      </div>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-line p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">업체명 *</label>
              <input type="text" value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                placeholder="예: 제주테니스샵"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">설명 (한줄)</label>
              <input type="text" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="예: 라켓·스트링·의류 전문"
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-sub mb-1">이미지 URL</label>
              <input type="text" value={form.image_url}
                onChange={e => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              {form.image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-line">
                  <img src={form.image_url} alt="미리보기" className="w-full h-32 object-cover"
                    onError={e => { e.target.style.display = 'none' }} />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">링크 URL</label>
              <input type="text" value={form.link_url}
                onChange={e => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://..."
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-sub mb-1">정렬 순서</label>
              <input type="number" value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm">
              {editingId ? '수정 완료' : '추가'}
            </button>
            <button onClick={resetForm} className="text-sm text-sub px-4 py-2">취소</button>
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
          {banners.map(b => (
            <div key={b.id} className={`bg-white border rounded-lg p-3 flex items-center gap-3 ${
              !b.is_active ? 'opacity-50' : ''
            }`}>
              {/* 썸네일 */}
              <div className="w-16 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {b.image_url ? (
                  <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">🏢</div>
                )}
              </div>
              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{b.company_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    b.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>{b.is_active ? '활성' : '비활성'}</span>
                  <span className="text-xs text-sub">순서: {b.sort_order}</span>
                </div>
                {b.description && <p className="text-xs text-sub truncate">{b.description}</p>}
              </div>
              {/* 액션 */}
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
          ))}
        </div>
      )}
    </div>
  )
}
