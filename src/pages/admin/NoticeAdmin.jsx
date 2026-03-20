import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const EMPTY_FORM = {
  title: '', content: '', link: '', pinned: false,
  notice_type: 'general',
  meta: {
    date: '', venue: '', host: '제주시테니스협회',
    fee: '', account: '', deadline: '', contact: '',
    divisions: [{ name: '', desc: '' }],
    prizes: '', rules: '',
  }
}

export default function NoticeAdmin() {
  const showToast = useContext(ToastContext)
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)

  useEffect(() => { fetchNotices() }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase.from('notices').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('add')
  }

  function openEdit(n) {
    setForm({
      title: n.title || '',
      content: n.content || '',
      link: n.link || '',
      pinned: n.pinned || false,
      notice_type: n.notice_type || 'general',
      meta: n.meta || EMPTY_FORM.meta,
    })
    setEditId(n.id)
    setModal('edit')
  }

  async function handleSave() {
    if (!form.title) { showToast?.('제목을 입력해주세요.', 'error'); return }
    const payload = {
      title: form.title,
      content: form.content || null,
      link: form.link || null,
      pinned: form.pinned,
      notice_type: form.notice_type,
      meta: form.notice_type === 'tournament' ? form.meta : null,
    }
    if (modal === 'add') {
      const { error } = await supabase.from('notices').insert([payload])
      if (error) { showToast?.(error.message, 'error'); return }
      showToast?.('공지가 등록되었습니다.')
    } else {
      const { error } = await supabase.from('notices').update(payload).eq('id', editId)
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

  // meta 헬퍼
  function setMeta(key, val) {
    setForm(f => ({ ...f, meta: { ...f.meta, [key]: val } }))
  }
  function setDivision(idx, key, val) {
    const divs = [...(form.meta.divisions || [])]
    divs[idx] = { ...divs[idx], [key]: val }
    setMeta('divisions', divs)
  }
  function addDivision() {
    setMeta('divisions', [...(form.meta.divisions || []), { name: '', desc: '' }])
  }
  function removeDivision(idx) {
    const divs = [...(form.meta.divisions || [])]
    divs.splice(idx, 1)
    setMeta('divisions', divs)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">📢 공지 관리</h2>
        <button onClick={openAdd}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + 공지 추가
        </button>
      </div>

      {/* 공지 목록 */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-sub text-sm">로딩 중..</p>
        ) : notices.length === 0 ? (
          <p className="text-center py-8 text-sub text-sm">등록된 공지 없음</p>
        ) : notices.map(n => (
          <div key={n.id} className={`bg-white rounded-r border p-4 ${n.pinned ? 'border-accent/30 bg-accentSoft/30' : 'border-line'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {n.pinned && <span className="text-xs">📌</span>}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    n.notice_type === 'tournament'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {n.notice_type === 'tournament' ? '🏆 대회공지' : '📋 일반'}
                  </span>
                  <h3 className="text-sm font-semibold truncate">{n.title}</h3>
                </div>
                {n.notice_type === 'tournament' && n.meta && (
                  <p className="text-xs text-sub mt-1">
                    {n.meta.date && `📅 ${n.meta.date}`}
                    {n.meta.venue && ` · 📍 ${n.meta.venue}`}
                  </p>
                )}
                {n.notice_type === 'general' && n.content && (
                  <p className="text-xs text-sub mt-1 line-clamp-1">{n.content}</p>
                )}
                <span className="text-[11px] text-sub mt-1 block">{formatDate(n.created_at)}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => togglePin(n)}
                  className={`text-xs px-2 py-1 rounded ${n.pinned ? 'bg-accent text-white' : 'bg-soft2 text-sub'}`}>
                  {n.pinned ? '고정' : '일반'}
                </button>
                <button onClick={() => openEdit(n)} className="text-xs text-accent hover:underline px-2 py-1">수정</button>
                <button onClick={() => handleDelete(n)} className="text-xs text-red-500 hover:underline px-2 py-1">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg my-4">
            <div className="p-6">
              <h3 className="text-base font-bold mb-4">
                {modal === 'add' ? '공지 추가' : '공지 수정'}
              </h3>

              <div className="space-y-4">
                {/* 공지 타입 선택 */}
                <div>
                  <label className="block text-xs font-medium text-sub mb-2">공지 유형</label>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, notice_type: 'general' }))}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        form.notice_type === 'general' ? 'border-accent bg-accentSoft text-accent' : 'border-line text-sub'
                      }`}>
                      📋 일반 공지
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, notice_type: 'tournament' }))}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        form.notice_type === 'tournament' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-line text-sub'
                      }`}>
                      🏆 대회 공지
                    </button>
                  </div>
                </div>

                {/* 공통: 제목 */}
                <div>
                  <label className="block text-xs font-medium text-sub mb-1">제목 *</label>
                  <input type="text" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="예: 제2회 TF컵 개인 복식 테니스 대회"
                    className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                </div>

                {/* 일반 공지 */}
                {form.notice_type === 'general' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">내용</label>
                      <textarea value={form.content}
                        onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                        className="w-full text-sm border border-line rounded-lg px-3 py-2 h-28 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">링크 (선택)</label>
                      <input type="url" value={form.link}
                        onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                        placeholder="https://..."
                        className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                    </div>
                  </>
                )}

                {/* 대회 공지 */}
                {form.notice_type === 'tournament' && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-700 font-medium">🏆 대회 기본 정보</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-sub mb-1">일시</label>
                        <input type="text" value={form.meta.date}
                          onChange={e => setMeta('date', e.target.value)}
                          placeholder="예: 2026.2.21(토) ~ 2.22(일) 2일간"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">장소</label>
                        <input type="text" value={form.meta.venue}
                          onChange={e => setMeta('venue', e.target.value)}
                          placeholder="예: 연정구장"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">주최/주관</label>
                        <input type="text" value={form.meta.host}
                          onChange={e => setMeta('host', e.target.value)}
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">참가비</label>
                        <input type="text" value={form.meta.fee}
                          onChange={e => setMeta('fee', e.target.value)}
                          placeholder="예: 팀당 55,000원"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">계좌번호</label>
                        <input type="text" value={form.meta.account}
                          onChange={e => setMeta('account', e.target.value)}
                          placeholder="예: 700-100-462366 제주은행"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">신청마감</label>
                        <input type="text" value={form.meta.deadline}
                          onChange={e => setMeta('deadline', e.target.value)}
                          placeholder="예: 2월 15일 18시까지"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">문의처</label>
                        <input type="text" value={form.meta.contact}
                          onChange={e => setMeta('contact', e.target.value)}
                          placeholder="예: 김종현 010-8712-9173"
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-xs text-sub mb-1">참가신청 링크</label>
                        <input type="url" value={form.link}
                          onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                          placeholder="https://docs.google.com/..."
                          className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                      </div>
                    </div>

                    {/* 부서 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-sub">부서별 참가자격</label>
                        <button type="button" onClick={addDivision}
                          className="text-xs text-accent hover:underline">+ 부서 추가</button>
                      </div>
                      <div className="space-y-2">
                        {(form.meta.divisions || []).map((div, idx) => (
                          <div key={idx} className="flex gap-2 items-start">
                            <input type="text" value={div.name}
                              onChange={e => setDivision(idx, 'name', e.target.value)}
                              placeholder="부서명"
                              className="w-28 text-sm border border-line rounded-lg px-3 py-2 shrink-0" />
                            <input type="text" value={div.desc}
                              onChange={e => setDivision(idx, 'desc', e.target.value)}
                              placeholder="참가자격 설명"
                              className="flex-1 text-sm border border-line rounded-lg px-3 py-2" />
                            <button type="button" onClick={() => removeDivision(idx)}
                              className="text-red-400 text-sm px-1 shrink-0 mt-1">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 시상/경기방법 */}
                    <div>
                      <label className="block text-xs text-sub mb-1">시상</label>
                      <input type="text" value={form.meta.prizes}
                        onChange={e => setMeta('prizes', e.target.value)}
                        placeholder="예: 우승 50만원, 준우승 30만원, 공동3위 15만원"
                        className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-xs text-sub mb-1">경기방법 / 기타</label>
                      <textarea value={form.meta.rules}
                        onChange={e => setMeta('rules', e.target.value)}
                        placeholder="예: 예선 및 본선 5:5 타이브레이크 No-Ad&#10;경기진행 상황에 따라 변동될 수 있음"
                        rows={3}
                        className="w-full text-sm border border-line rounded-lg px-3 py-2 resize-none" />
                    </div>
                  </div>
                )}

                {/* 공통: 고정 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.pinned}
                    onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                    className="rounded" />
                  <span className="text-sm">📌 상단 고정 공지</span>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-2 border border-line rounded-lg text-sm text-sub">취소</button>
                <button onClick={handleSave}
                  className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}