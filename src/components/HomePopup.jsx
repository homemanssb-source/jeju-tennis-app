// src/components/HomePopup.jsx
// 메인 화면 팝업 — 관리자가 등록한 home_popups 중 게시 기간 안의 것만 노출
// 팝업은 하나씩 따로 뜨고, 닫기·오늘 하루 보지 않기도 팝업마다 따로 적용된다.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const HIDE_KEY_PREFIX = 'jta_popup_hide_'        // + id → 'YYYY-MM-DD' (그날 하루 숨김)
const SESSION_CLOSED_KEY = 'jta_popup_closed_ids' // 이번 방문 동안 닫은 팝업 id 목록 (JSON)

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function isHiddenToday(id) {
  try { return localStorage.getItem(HIDE_KEY_PREFIX + id) === todayKST() } catch { return false }
}

function closedIds() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_CLOSED_KEY) || '[]') } catch { return [] }
}

function markClosed(id) {
  try {
    const ids = closedIds()
    if (!ids.includes(id)) sessionStorage.setItem(SESSION_CLOSED_KEY, JSON.stringify([...ids, id]))
  } catch {}
}

export default function HomePopup({ onDone }) {
  const navigate = useNavigate()
  const [popups, setPopups] = useState([])   // 아직 안 닫은 팝업 (맨 앞이 지금 보이는 것)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    supabase.from('home_popups')
      .select('id, title, content, image_url, link_url')
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        const closed = closedIds()
        const list = error ? [] : (data || []).filter(p => !isHiddenToday(p.id) && !closed.includes(p.id))
        setPopups(list)
        setTotal(list.length)
        if (list.length === 0) onDone?.()
      })
    return () => { cancelled = true }
  }, [])

  // 지금 팝업만 닫고 다음 팝업으로
  function close() {
    const cur = popups[0]
    if (!cur) return
    markClosed(cur.id)
    const rest = popups.slice(1)
    setPopups(rest)
    if (rest.length === 0) onDone?.()
  }

  function hideToday() {
    const cur = popups[0]
    if (!cur) return
    try { localStorage.setItem(HIDE_KEY_PREFIX + cur.id, todayKST()) } catch {}
    close()
  }

  function openLink(url) {
    if (!url) return
    if (url.startsWith('/')) { close(); navigate(url); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (popups.length === 0) return null
  const p = popups[0]
  const order = total - popups.length + 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.title}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={close}
    >
      <div
        key={p.id}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: '#fff',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
        }}
      >
        <div style={{ position: 'relative' }}>
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              onClick={() => openLink(p.link_url)}
              style={{
                display: 'block', width: '100%', maxHeight: '60vh', objectFit: 'contain',
                background: '#f5f0ea', cursor: p.link_url ? 'pointer' : 'default',
              }}
            />
          )}

          {(!p.image_url || p.content) && (
            <div style={{ padding: '18px 18px 14px' }}>
              {!p.image_url && (
                <h3 style={{ margin: '0 0 8px', paddingRight: total > 1 ? 44 : 0, fontSize: 17, fontWeight: 800, color: '#2d1a0e' }}>{p.title}</h3>
              )}
              {p.content && (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#4a3a30', whiteSpace: 'pre-wrap', maxHeight: '30vh', overflowY: 'auto' }}>
                  {p.content}
                </p>
              )}
              {p.link_url && (
                <button
                  onClick={() => openLink(p.link_url)}
                  style={{
                    marginTop: 14, width: '100%', padding: '10px 0', border: 'none', borderRadius: 10,
                    background: '#c0612b', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  자세히 보기
                </button>
              )}
            </div>
          )}

          {total > 1 && (
            <span style={{
              position: 'absolute', top: 10, right: 10, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, fontWeight: 700,
            }}>
              {order} / {total}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', borderTop: '1px solid #f0e8e0' }}>
          <button onClick={hideToday} style={{ ...footBtn, color: '#8a7a70', borderRight: '1px solid #f0e8e0' }}>
            오늘 하루 보지 않기
          </button>
          <button onClick={close} style={{ ...footBtn, color: '#2d1a0e', fontWeight: 700 }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

const footBtn = {
  flex: 1, padding: '13px 0', border: 'none', background: '#fff',
  fontSize: 13, cursor: 'pointer',
}
