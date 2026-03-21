// src/pages/admin/PushAdmin.jsx
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../../lib/supabase'
import { ToastContext } from '../../App'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const TEMPLATES = [
  { id: 'entry_open',  label: '📣 신청 오픈',  title: '🎾 참가신청이 시작됐습니다!',       body: '{event_name} 참가신청이 오픈되었습니다. 지금 바로 신청하세요.', url: '/entry',  needEvent: true },
  { id: 'entry_close', label: '⏰ 마감 임박',  title: '⏰ 참가신청 마감이 임박했습니다!',   body: '{event_name} 참가신청 마감이 얼마 남지 않았습니다.',           url: '/entry',  needEvent: true },
  { id: 'event_day',   label: '🎾 대회 당일',  title: '🎾 오늘 대회 날입니다!',             body: '{event_name}이(가) 오늘 진행됩니다. 모두 파이팅! 🙌',         url: '/notice', needEvent: true },
  { id: 'notice',      label: '📢 공지사항',   title: '📢 새 공지사항이 등록되었습니다',    body: '{notice_title}',                                               url: '/notice', needNotice: true },
  { id: 'custom',      label: '✏️ 직접 입력',  title: '',                                    body: '',                                                             url: '/' },
]

export default function PushAdmin() {
  const showToast = useContext(ToastContext)
  const [events, setEvents]             = useState([])
  const [notices, setNotices]           = useState([])
  const [tpl, setTpl]                   = useState(TEMPLATES[0])
  const [form, setForm]                 = useState({ title: TEMPLATES[0].title, body: TEMPLATES[0].body, url: TEMPLATES[0].url, eventId: '', noticeId: '' })
  const [sending, setSending]           = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)
  const [history, setHistory]           = useState([])
  const [subCount, setSubCount]         = useState(null)

  useEffect(() => { fetchEvents(); fetchNotices(); fetchSubCount() }, [])

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('event_id, event_name, event_date, status').order('event_date', { ascending: false }).limit(30)
    setEvents(data || [])
  }
  async function fetchNotices() {
    const { data } = await supabase.from('notices').select('id, title').order('created_at', { ascending: false }).limit(20)
    setNotices(data || [])
  }
  async function fetchSubCount() {
    const { count } = await supabase.from('push_subscriptions').select('*', { count: 'exact', head: true })
    setSubCount(count ?? 0)
  }

  function selectTemplate(t) {
    setTpl(t)
    setForm(prev => ({ ...prev, title: t.title, body: t.body, url: t.url, eventId: '', noticeId: '' }))
  }

  function resolveForm() {
    let title = form.title, body = form.body
    if (form.eventId) {
      const ev = events.find(e => e.event_id === form.eventId)
      if (ev) { title = title.replace('{event_name}', ev.event_name); body = body.replace('{event_name}', ev.event_name) }
    }
    if (form.noticeId) {
      const n = notices.find(n => n.id === form.noticeId)
      if (n) { title = title.replace('{notice_title}', n.title); body = body.replace('{notice_title}', n.title) }
    }
    return { title, body, url: form.url || '/' }
  }

  async function handleSend() {
    const { title, body, url } = resolveForm()
    if (!title.trim() || !body.trim()) { showToast?.('제목과 내용을 입력해 주세요.', 'error'); setConfirmModal(false); return }
    if (/{[a-z_]+}/.test(title) || /{[a-z_]+}/.test(body)) { showToast?.('대회 또는 공지를 선택해 변수를 채워주세요.', 'error'); setConfirmModal(false); return }
    setConfirmModal(false); setSending(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/push-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ title, body, url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '발송 실패')
      showToast?.(`✅ 발송 완료 (${json.sent}명 수신)`)
      setHistory(prev => [{ id: Date.now(), title, body, url, at: new Date().toLocaleString('ko-KR'), sent: json.sent }, ...prev.slice(0, 9)])
      fetchSubCount()
    } catch (e) {
      showToast?.(`발송 실패: ${e.message}`, 'error')
    } finally { setSending(false) }
  }

  const preview = resolveForm()
  const hasVapid = !!import.meta.env.VITE_VAPID_PUBLIC_KEY

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold">🔔 푸시 알림 발송</h2>
        {subCount !== null && <span className="text-xs text-sub bg-soft px-3 py-1 rounded-full">구독자 {subCount}명</span>}
      </div>

      {!hasVapid && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-800 leading-relaxed">
          ⚠️ <strong>VITE_VAPID_PUBLIC_KEY</strong> 환경변수가 필요합니다. 설정 가이드를 먼저 완료해 주세요.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-line p-4">
            <p className="text-xs font-semibold text-sub mb-2">템플릿 선택</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => selectTemplate(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${tpl.id === t.id ? 'bg-accent text-white border-accent' : 'bg-white text-sub border-line hover:bg-soft2'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tpl.needEvent && (
            <div className="bg-white rounded-xl border border-line p-4">
              <label className="block text-xs font-semibold text-sub mb-1.5">대회 선택</label>
              <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">-- 선택하면 이름이 자동 치환됩니다 --</option>
                {events.map(ev => <option key={ev.event_id} value={ev.event_id}>[{ev.status}] {ev.event_name} ({ev.event_date})</option>)}
              </select>
            </div>
          )}
          {tpl.needNotice && (
            <div className="bg-white rounded-xl border border-line p-4">
              <label className="block text-xs font-semibold text-sub mb-1.5">공지사항 선택</label>
              <select value={form.noticeId} onChange={e => setForm({ ...form, noticeId: e.target.value })} className="w-full text-sm border border-line rounded-lg px-3 py-2">
                <option value="">-- 선택하면 제목이 자동 치환됩니다 --</option>
                {notices.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            </div>
          )}

          <div className="bg-white rounded-xl border border-line p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-sub mb-1">알림 제목</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full text-sm border border-line rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sub mb-1">알림 내용</label>
              <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="w-full text-sm border border-line rounded-lg px-3 py-2 h-20 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sub mb-1">클릭 이동 URL</label>
              <input type="text" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full text-sm border border-line rounded-lg px-3 py-2" placeholder="/ 또는 /entry 또는 /notice" />
            </div>
          </div>

          <button onClick={() => setConfirmModal(true)} disabled={sending || !hasVapid}
            className="w-full py-3 bg-accent text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {sending ? '발송 중...' : `🔔 전체 구독자(${subCount ?? '?'}명)에게 발송`}
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-line p-4">
            <p className="text-xs font-semibold text-sub mb-3">📱 알림 미리보기</p>
            <div className="bg-gray-100 rounded-xl p-3">
              <div className="bg-white rounded-xl p-3 shadow-sm flex gap-3 items-start">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-lg shrink-0">🎾</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{preview.title || '(제목 없음)'}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{preview.body || '(내용 없음)'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">jeju-tennis-app.vercel.app · 방금 전</p>
                </div>
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-sub mb-3">📋 이번 세션 발송 이력</p>
              <div className="space-y-2.5">
                {history.map(h => (
                  <div key={h.id} className="border-b border-line pb-2.5 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{h.title}</p>
                    <p className="text-[11px] text-sub truncate">{h.body}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{h.at} · {h.sent}명 수신</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-soft rounded-xl p-4 text-xs space-y-1.5">
            <p className="font-semibold text-gray-700 mb-1">🔧 VAPID 연동 상태</p>
            <div className="flex items-center gap-2">
              <span className="text-sub w-28">Public Key</span>
              <span className={hasVapid ? 'text-green-600' : 'text-red-500'}>{hasVapid ? '설정됨 ✓' : '미설정'}</span>
            </div>
          </div>
        </div>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold mb-1">🔔 푸시 알림 발송</h3>
            <p className="text-xs text-sub mb-4">전체 구독자({subCount}명)에게 아래 알림을 발송합니다.</p>
            <div className="bg-soft rounded-xl p-3 mb-5 space-y-1">
              <p className="text-sm font-semibold">{preview.title}</p>
              <p className="text-xs text-sub">{preview.body}</p>
              <p className="text-[10px] text-accent mt-1">{preview.url}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmModal(false)} className="flex-1 py-2.5 border border-line rounded-xl text-sm text-sub hover:bg-soft2">취소</button>
              <button onClick={handleSend} className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-blue-700">발송</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
