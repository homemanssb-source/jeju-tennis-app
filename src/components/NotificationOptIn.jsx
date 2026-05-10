import { useState, useEffect } from 'react'
import { isPushSupported, getPushSubscription, subscribePush } from '../lib/push'

const STORAGE_KEY = 'jta_notification_optin_dismissed_at'
const SUPPRESS_DAYS = 7

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
    getPushSubscription().then(sub => {
      if (!sub) setShow(true)
    })
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
    <div style={{
      background: 'linear-gradient(135deg, #fff 0%, #fef3ec 100%)',
      border: '1px solid #f5d4b8', borderRadius: 18,
      padding: '14px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 12px rgba(192,97,43,0.08)',
      position: 'relative',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 14,
        background: '#c0612b', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#2d1a0e' }}>
          알림 받기
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6a62', lineHeight: 1.4 }}>
          {tip || '대회 공지·접수 시작·결과 등록 알림을 즉시 받아보세요'}
        </p>
      </div>
      <button
        onClick={handleEnable}
        disabled={loading}
        style={{
          background: '#c0612b', color: '#fff', border: 'none',
          padding: '8px 14px', borderRadius: 12,
          fontSize: 12, fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          flexShrink: 0, opacity: loading ? 0.6 : 1,
        }}>
        {loading ? '설정 중...' : '알림 켜기'}
      </button>
      <button
        onClick={dismiss}
        aria-label="닫기"
        style={{
          background: 'transparent', border: 'none', color: '#bdb1a8',
          fontSize: 18, cursor: 'pointer', padding: '4px 6px',
          flexShrink: 0,
        }}>×</button>
    </div>
  )
}
