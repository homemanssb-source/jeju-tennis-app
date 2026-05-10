import { useState, useEffect } from 'react'
import { isPushSupported, getPushSubscription, subscribePush } from '../lib/push'

const STORAGE_KEY = 'jta_notification_optin_dismissed_at'
const SUPPRESS_DAYS = 7
const SHOW_DELAY_MS = 1200  // 홈 진입 후 잠깐 기다렸다가 표시

function suppressedRecently() {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0)
    if (!ts) return false
    return (Date.now() - ts) / 86400000 < SUPPRESS_DAYS
  } catch { return false }
}

export default function NotificationOptIn() {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState('')

  useEffect(() => {
    if (!isPushSupported()) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'denied') return
    if (suppressedRecently()) return

    let timer = null
    getPushSubscription().then(sub => {
      if (sub) return
      timer = setTimeout(() => setShow(true), SHOW_DELAY_MS)
    })
    return () => { if (timer) clearTimeout(timer) }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  async function handleEnable() {
    setLoading(true)
    try {
      await subscribePush()
      setTip('✅ 알림이 설정되었습니다!')
      setTimeout(() => { setShow(false); setTip('') }, 1500)
    } catch (e) {
      console.error('[OptIn]', e)
      setTip('설정 실패. 브라우저 권한을 확인해주세요.')
      setTimeout(() => setTip(''), 2500)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'jtaFadeIn 200ms ease-out',
      }}
      onClick={dismiss}
    >
      <style>{`
        @keyframes jtaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes jtaPop {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 22,
          padding: '24px 22px 18px',
          maxWidth: 340, width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
          fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
          animation: 'jtaPop 220ms ease-out',
          textAlign: 'center',
        }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: '#fef3ec', margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 34,
        }}>🔔</div>

        <h3 style={{
          margin: 0, fontSize: 18, fontWeight: 900, color: '#2d1a0e',
          letterSpacing: -0.3,
        }}>알림을 받으시겠어요?</h3>

        <p style={{
          margin: '8px 0 0', fontSize: 12.5, color: '#7a6a62',
          lineHeight: 1.55,
        }}>
          {tip || (
            <>
              대회 공지·접수 시작·결과 등록을<br/>
              <strong style={{ color: '#c0612b' }}>실시간 알림</strong>으로 받아볼 수 있어요.
            </>
          )}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <button
            onClick={handleEnable}
            disabled={loading}
            style={{
              background: '#c0612b', color: '#fff', border: 'none',
              padding: '13px', borderRadius: 14,
              fontSize: 14, fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}>
            {loading ? '설정 중...' : '🔔 알림 켜기'}
          </button>
          <button
            onClick={dismiss}
            disabled={loading}
            style={{
              background: 'transparent', color: '#94857c', border: 'none',
              padding: '8px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
            나중에 (7일 동안 안 보기)
          </button>
        </div>
      </div>
    </div>
  )
}
