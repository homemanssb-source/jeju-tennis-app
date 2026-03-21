import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const DEFAULT_RULES = `1. 예선 및 본선 5:5 타이브레이크 No-Ad (예선: 순위 결정전, 본선진출 : 토너먼트)
※ 경기진행 상황에 따라 변동될 수 있음
2. 미스 폴은 인정하지 않는다. 즉 미스 폴 한 선수의 실점으로 처리한다.
3. 로빙엄파이어(Roving Umplire) 제도시행(순회심판): 감독관 및 선임된 로빙 엄파이어는 경기 중 현장에서 풋폴트 및 인·아웃의 판정에 대한 확신이 되면 즉시 시정명령과 동시에 사실적인 문제를 결정 할 수 있다. 이에 대한 결정에는 어떠한 경우라도 이의신청을 받아들일 수 없으며, 결정의 절차는 협회의 경기규정에 따른다.
4. 풋 폴트는 상대선수가 콜을 요할 시 진행요원이 심판으로 경기를 참관하여 풋 폴트를 콜 할 수 있다.
5. 선수끼리의 합의가 안 될 시 진행요원이 분쟁을 조정을 위해 언제든지 투입 가능하다.
6. 상품(금)을 받은 선수가 부정선수로 확인될 시는 상품(금)을 회수 한다.
7. 워밍업 및 경기 중 부상으로 인한 치료 시간은 팀 당 10분간을 허용한다. (근육경련시 팀당 1회 5분)
8. 신분요청시 신분증을 10분이내 제출하지 못 할 경우 실격 처리한다.
9. 출전 선수는 지병이 있을 경우 주최측에서 참가 제한 할 수 있고, 신고하지 않은 지병으로 인한 사고에 대해서는 대회 주최·주관측은 책임지지 않는다. (출전 선수는 생활체육공제보험 가입을 권장함)
10. 대회 주최측은 만일의 사태에 대비하여 주최자배상책임공제 보험에 가입한다. 대회 중 발생한 부상 및 사고의 경우 주최자의 법률 과실 여부에 따라 보험이 적용범위 내에서 책임이 있으며 보험이 적용하는 범위 외에는 주최측에서 책임을지지 않으며 추가 적인 보상은 없다.
11. 2026년도 제주시협회 회원등록을 하고 본인에게 해당되는 등급으로 출전해야 하며 위반 시 부정페어로 간주하여 제주시테니스협회 상벌위원회에 회부한다.
12. 경기 중 네트를 넘어가 상대방을 위협하거나 심한 욕설을 할 경우, 경기부에 판정 및 결정에 대한 불복 등 경기본부에서 심각한 상황으로 판단 될 시 엄정 조치한다.`

const EMPTY_META = {
  date: '', venue: '', host: '제주시테니스협회',
  fee: '', account: '', deadline: '', contact: '',
  divisions: [{ name: '', desc: '' }],
  prizes: '', rules: DEFAULT_RULES,
}

const EMPTY_FORM = {
  title: '', content: '', link: '', pinned: false,
  notice_type: 'general',
  event_id: null,
  meta: EMPTY_META,
}

export default function NoticeAdmin() {
  const showToast = useContext(ToastContext)
  const [notices, setNotices] = useState([])
  const [events, setEvents] = useState([]) // 연동할 대회 목록
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [loadingEvent, setLoadingEvent] = useState(false)

  useEffect(() => { fetchNotices(); fetchEvents() }, [])

  async function fetchNotices() {
    setLoading(true)
    const { data } = await supabase.from('notices').select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  async function fetchEvents() {
    // OPEN 대회 목록 가져오기 (공지 연동용)
    const { data } = await supabase.from('events')
      .select('event_id, event_name, event_date, event_date_end, entry_fee_team, entry_close_at, account_number, account_holder, account_bank, description')
      .order('event_date', { ascending: false })
    setEvents(data || [])
  }

  // 대회 선택 시 기본정보 자동 채우기
  async function handleEventSelect(eventId) {
    if (!eventId) {
      setForm(f => ({ ...f, event_id: null, title: '', meta: { ...EMPTY_META } }))
      return
    }

    setLoadingEvent(true)
    const ev = events.find(e => e.event_id === eventId)
    if (!ev) { setLoadingEvent(false); return }

    // 부서 목록 가져오기
    const { data: divData } = await supabase.from('event_divisions')
      .select('division_name').eq('event_id', eventId).order('created_at')

    const divisions = divData && divData.length > 0
      ? divData.map(d => ({ name: d.division_name, desc: '' }))
      : [{ name: '', desc: '' }]

    // 날짜 포맷
    const startDate = ev.event_date ? new Date(ev.event_date) : null
    const endDate = ev.event_date_end ? new Date(ev.event_date_end) : null
    const formatMD = (d) => d ? `${d.getMonth() + 1}.${d.getDate()}` : ''
    const dayKor = (d) => d ? ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] : ''

    let dateStr = ''
    if (startDate && endDate) {
      dateStr = `2026.${formatMD(startDate)}(${dayKor(startDate)}) ~ ${formatMD(endDate)}(${dayKor(endDate)})`
    } else if (startDate) {
      dateStr = `2026.${formatMD(startDate)}(${dayKor(startDate)})`
    }

    // 마감일 포맷
    let deadlineStr = ''
    if (ev.entry_close_at) {
      const d = new Date(new Date(ev.entry_close_at).getTime() + 9 * 60 * 60 * 1000)
      deadlineStr = `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시까지`
    }

    // 계좌 포맷
    let accountStr = ''
    if (ev.account_number) {
      accountStr = `${ev.account_bank ? ev.account_bank + ' ' : ''}${ev.account_number}${ev.account_holder ? ' (' + ev.account_holder + ')' : ''}`
    }

    // 참가비 포맷
    let feeStr = ev.entry_fee_team > 0 ? `팀당 ${ev.entry_fee_team.toLocaleString()}원` : ''

    setForm(f => ({
      ...f,
      event_id: eventId,
      title: ev.event_name || f.title,
      meta: {
        ...f.meta,
        date: dateStr,
        venue: '',
        host: '제주시테니스협회',
        fee: feeStr,
        account: accountStr,
        deadline: deadlineStr,
        contact: '',
        divisions,
        prizes: f.meta.prizes,
        rules: f.meta.rules,
      }
    }))
    setLoadingEvent(false)
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
      event_id: n.event_id || null,
      meta: n.meta || EMPTY_META,
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
      event_id: form.notice_type === 'tournament' ? (form.event_id || null) : null,
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
                    n.notice_type === 'tournament' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {n.notice_type === 'tournament' ? '🏆 대회공지' : '📋 일반'}
                  </span>
                  {n.event_id && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">🔗 대회연동</span>}
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
                {/* 공지 타입 */}
                <div>
                  <label className="block text-xs font-medium text-sub mb-2">공지 유형</label>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, notice_type: 'general', event_id: null }))}
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

                {/* 대회공지 - 대회 연동 드롭다운 */}
                {form.notice_type === 'tournament' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-blue-700">🔗 대회 연동 (선택)</p>
                    <p className="text-xs text-blue-500">대회를 선택하면 기본 정보가 자동으로 채워집니다.</p>
                    <select
                      value={form.event_id || ''}
                      onChange={e => handleEventSelect(e.target.value || null)}
                      className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 bg-white">
                      <option value="">직접 입력 (연동 안 함)</option>
                      {events.map(ev => (
                        <option key={ev.event_id} value={ev.event_id}>
                          {ev.event_name} ({ev.event_date})
                        </option>
                      ))}
                    </select>
                    {loadingEvent && <p className="text-xs text-blue-500">대회 정보 불러오는 중...</p>}
                    {form.event_id && !loadingEvent && (
                      <p className="text-xs text-green-600 font-medium">✅ 연동됨 — 앱에서 참가신청 버튼이 해당 대회로 연결됩니다.</p>
                    )}
                  </div>
                )}

                {/* 제목 */}
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

                {/* 대회 공지 상세 */}
                {form.notice_type === 'tournament' && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-lg p-3 flex items-center justify-between">
                      <p className="text-xs text-orange-700 font-medium">🏆 대회 기본 정보</p>
                      {form.event_id && <span className="text-xs text-orange-500">자동입력됨 · 수정 가능</span>}
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

                      {/* 대회 미연동 시에만 외부링크 입력 */}
                      {!form.event_id && (
                        <div className="col-span-2">
                          <label className="block text-xs text-sub mb-1">외부 참가신청 링크 (선택)</label>
                          <input type="url" value={form.link}
                            onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                            placeholder="https://docs.google.com/..."
                            className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                        </div>
                      )}
                    </div>

                    {/* 부서 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-sub">
                          부서별 참가자격
                          {form.event_id && <span className="text-blue-500 ml-1">(자동입력 · 수정가능)</span>}
                        </label>
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

                    {/* 시상 */}
                    <div>
                      <label className="block text-xs text-sub mb-1">시상</label>
                      <input type="text" value={form.meta.prizes}
                        onChange={e => setMeta('prizes', e.target.value)}
                        placeholder="예: 우승 50만원, 준우승 30만원, 공동3위 15만원"
                        className="w-full text-sm border border-line rounded-lg px-3 py-2" />
                    </div>

                    {/* 경기방법 */}
                    <div>
                      <label className="block text-xs text-sub mb-1">경기방법 / 기타</label>
                      <textarea value={form.meta.rules}
                        onChange={e => setMeta('rules', e.target.value)}
                        placeholder="예: 1. 예선 및 본선 5:5 타이브레이크 No-Ad&#10;※ 경기진행 상황에 따라 변동될 수 있음"
                        rows={5}
                        className="w-full text-sm border border-line rounded-lg px-3 py-2 resize-none" />
                    </div>
                  </div>
                )}

                {/* 고정 */}
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