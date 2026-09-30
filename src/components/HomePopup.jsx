// src/components/HomePopup.jsx
// 메인 화면 팝업 — 관리자가 등록한 home_popups 중 게시 기간 안의 것만 노출
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const HIDE_KEY_PREFIX = 'jta_popup_hide_'        // + id → 'YYYY-MM-DD' (그날 하루 숨김)
const SESSION_CLOSED_KEY = 'jta_popup_closed'    // 이번 방문 동안 닫음

function todayKST() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function isHiddenToday(id) {
  try { return localStorage.getItem(HIDE_KEY_PREFIX + id) === todayKST() } catch { return false }
}

function closedThisSession() {
  try { return sessionStorage.getItem(SESSION_CLOSED_KEY) === '1' } catch { return false }
}

export default function HomePopup({ onDone }) {
  const navigate = useNavigate()
  const [popups, setPopups] = useState([])
  const [idx, setIdx] = useState(0)
  const touchX = useRef(null)

  useEffect(() => {
    if (closedThisSession()) { onDone?.(); return }
    let cancelled = false
    supabase.from('home_popups')
      .select('id, title, content, image_url, link_url')
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        const list = error ? [] : (data || []).filter(p => !isHiddenToday(p.id))
        setPopups(list)
        if (list.length === 0) onDone?.()
      })
    return () => { cancelled = true }
  }, [])

  function close() {
    try { sessionStorage.setItem(SESSION_CLOSED_KEY, '1') } catch {}
    setPopups([])
    onDone?.()
  }

  function hideToday() {
    const today = todayKST()
    try { popups.forEach(p => localStorage.setItem(HIDE_KEY_PREFIX + p.id, today)) } catch {}
    close()
  }

  function openLink(url) {
    if (!url) return
    if (url.startsWith('/')) { close(); navigate(url); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function go(delta) {
    setIdx(i => (i + delta + popups.length) % popups.length)
  }

  if (popups.length === 0) return null
  const p = popups[Math.min(idx, popups.length - 1)]
  const multi = popups.length > 1

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
        onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (!multi || touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
          touchX.current = null
        }}
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
                <h3 style={{ margin: '0 0 8px', paddingRight: multi ? 44 : 0, fontSize: 17, fontWeight: 800, color: '#2d1a0e' }}>{p.title}</h3>
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

          {multi && (
            <span style={{
              position: 'absolute', top: 10, right: 10, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, fontWeight: 700,
            }}>
              {idx + 1} / {popups.length}
            </span>
          )}
        </div>

        {multi && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 0 2px' }}>
            <button onClick={() => go(-1)} aria-label="이전" style={navBtn}>‹</button>
            {popups.map((_, i) => (
              <span key={i} onClick={() => setIdx(i)} style={{
                width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                background: i === idx ? '#c0612b' : '#e0d6cc',
              }} />
            ))}
            <button onClick={() => go(1)} aria-label="다음" style={navBtn}>›</button>
          </div>
        )}

        <div style={{ display: 'flex', borderTop: '1px solid #f0e8e0', marginTop: multi ? 6 : 0 }}>
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

const navBtn = {
  border: 'none', background: 'none', fontSize: 20, lineHeight: 1,
  color: '#8a7a70', cursor: 'pointer', padding: '0 4px',
}

const footBtn = {
  flex: 1, padding: '13px 0', border: 'none', background: '#fff',
  fontSize: 13, cursor: 'pointer',
}
