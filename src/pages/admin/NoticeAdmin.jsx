import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

export default function NoticeAdmin() {
  const showToast = useContext(ToastContext)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState({ title: '', content: '', link: '', pinned: false })
  const [editId, setEditId] = useState(null)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ title: '', content: '', link: '', pinned: false })
    setEditId(null)
    setModal('add')
  }

  function openEdit(n) {
    setForm({ title: n.title, content: n.content || '', link: n.link || '', pinned: n.pinned || false })
    setEditId(n.id)
    setModal('edit')
  }

  async function handleSave() {
    if (!form.title) {
      showToast?.('제목을 입력해주세요.', 'error')
      return
    }

    if (modal === 'add') {
      const { error } = await supabase.from('notices').insert([form])
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('공지가 등록되었습니다.')
    } else {
      const { error } = await supabase.from('notices').update(form).eq('id', editId)
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('공지가 수정되었습니다.')
    }
    setModal(null)
    fetchNotices()
  }

  async function handleDelete(n) {
    if (!confirm(`"${n.title}" 공지를 삭제하시겠습니까?`)) return
    await supabase.from('notices').delete().eq('id', n.id)
    showToast?.('삭제되었습니다.')
    fetchNotices()
  }

  async function togglePin(n) {
    await supabase.from('notices').update({ pinned: !n.pinned }).eq('id', n.id)
    showToast?.(n.pinned ? '고정 해제' : '고정 설정')
    fetchNotices()
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('ko-KR')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">📌 공지 관리</h2>
        <button onClick={openAdd}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 공지 추가
        </button>
      </div>

      {/* 공지 목록 */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-sub text-sm">로딩 중...</p>
        ) : notices.length === 0 ? (
          <p className="text-center py-8 text-sub text-sm">등록된 공지 없음</p>
        ) : notices.map(n => (
          <div key={n.id} className={`bg-white rounded-r border p-4
            ${n.pinned ? 'border-accent/30 bg-accentSoft/30' : 'border-line'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {n.pinned && <span className="text-xs">📍</span>}
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                </div>
                {n.content && (
                  <p className="text-xs text-sub mt-1 line-clamp-2">{n.content}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-sub">{formatDate(n.created_at)}</span>
                  {n.link && (
                    <span className="text-[11px] text-accent">링크 있음</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => togglePin(n)}
                  className={`text-xs px-2 py-1 rounded ${n.pinned ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}>
                  {n.pinned ? '고정' : '일반'}
                </button>
                <button onClick={() => openEdit(n)}
                  className="text-xs text-accent hover:underline px-2 py-1">수정</button>
                <button onClick={() => handleDelete(n)}
                  className="text-xs text-red-500 hover:underline px-2 py-1">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 추가/수정 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-r2 p-6 w-full max-w-md">
            <h3 className="text-base font-bold mb-4">
              {modal === 'add' ? '공지 추가' : '공지 수정'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">제목</label>
                <input type="text" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">내용</label>
                <textarea value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 h-28 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">링크 (선택)</label>
                <input type="url" value={form.link}
                  onChange={e => setForm({ ...form, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-sm border border-line rounded-lg px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pinned}
                  onChange={e => setForm({ ...form, pinned: e.target.checked })}
                  className="rounded" />
                <span className="text-sm">고정 공지</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 border border-line rounded-lg text-sm text-sub hover:bg-soft2">
                취소
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
