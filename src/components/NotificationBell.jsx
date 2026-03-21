// src/components/NotificationBell.jsx
import { useState, useEffect } from 'react'
import { isPushSupported, getPushSubscription, subscribePush, unsubscribePush } from '../lib/push'

export default function NotificationBell() {
  const [supported, setSupported]   = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [tip, setTip]               = useState('')

  useEffect(() => {
    if (!isPushSupported()) return
    setSupported(true)
    getPushSubscription().then(sub => setSubscribed(!!sub))
  }, [])

  function showTip(msg) {
    setTip(msg)
    setTimeout(() => setTip(''), 2500)
  }

  async function handleClick() {
    if (!supported) return
    // iOS 16.3 이하 등 Notification API 자체가 없는 환경 방어
    if (typeof Notification === 'undefined') {
      showTip('이 브라우저는 알림을 지원하지 않습니다')
      return
    }
    if (Notification.permission === 'denied') {
      showTip('브라우저 설정에서 알림을 허용해 주세요')
      return
    }
    setLoading(true)
    try {
      if (subscribed) {
        await unsubscribePush()
        setSubscribed(false)
        showTip('알림이 해제되었습니다')
      } else {
        await subscribePush()
        setSubscribed(true)
        showTip('✅ 알림이 설정되었습니다!')
      }
    } catch (e) {
      console.error('[Push]', e)
      showTip('설정 실패. 브라우저 권한을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={handleClick}
        disabled={loading}
        title={subscribed ? '알림 끄기' : '알림 켜기'}
        style={{
          background: subscribed ? 'rgba(192,97,43,0.12)' : 'rgba(192,97,43,0.06)',
          border: 'none', borderRadius: 12, padding: '5px 10px',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 17 }}>
          {loading ? '⏳' : subscribed ? '🔔' : '🔕'}
        </span>
        {!subscribed && !loading && (
          <span style={{ fontSize: 10, color: '#c0612b', fontWeight: 700 }}>알림 ON</span>
        )}
        {subscribed && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'block' }} />
        )}
      </button>

      {tip && (
        <div style={{
          position: 'absolute', top: '110%', right: 0,
          background: '#2d1a0e', color: '#fff', fontSize: 11,
          borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap',
          zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>
          {tip}
        </div>
      )}
    </div>
  )
}
