import { useState, useEffect } from 'react'
import { isPushSupported, getPushSubscription, subscribePush } from '../lib/push'

const STORAGE_KEY_INSTALL   = 'jta_notification_optin_install_dismissed_at'
const STORAGE_KEY_SUBSCRIBE = 'jta_notification_optin_subscribe_dismissed_at'
const STORAGE_KEY_LEGACY    = 'jta_notification_optin_dismissed_at'
const SUPPRESS_DAYS = 7
const SHOW_DELAY_MS = 1200

function suppressedRecently(key) {
  try {
    const ts = Number(localStorage.getItem(key) || 0)
    if (!ts) return false
    return (Date.now() - ts) / 86400000 < SUPPRESS_DAYS
  } catch { return false }
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function detectPlatform() {
  const ua = (navigator.userAgent || '').toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  return { isIOS }
}

export default function NotificationOptIn() {
  const [show, setShow] = useState(false)
  const [variant, setVariant] = useState('subscribe')  // 'subscribe' | 'iosInstall'
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState('')
  const platform = detectPlatform()

  useEffect(() => {
    const standalone = isStandalone()

    // 과거 단일 키(legacy) 흔적은 standalone으로 진입했을 때 제거
    // (브라우저에서 닫은 게 PWA에서 재차 막지 않도록)
    if (standalone) {
      try { localStorage.removeItem(STORAGE_KEY_LEGACY) } catch {}
    }

    // ── iOS Safari (브라우저 모드): PWA 설치를 먼저 해야 알림 가능 ──
    if (platform.isIOS && !standalone) {
      if (suppressedRecently(STORAGE_KEY_INSTALL)) return
      const t = setTimeout(() => {
        setVariant('iosInstall')
        setShow(true)
      }, SHOW_DELAY_MS)
      return () => clearTimeout(t)
    }

    // ── Android / iOS standalone: 표준 푸시 구독 흐름 ──
    if (suppressedRecently(STORAGE_KEY_SUBSCRIBE)) return
    if (!isPushSupported()) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'denied') return

    let timer = null
    getPushSubscription().then(sub => {
      if (sub) return
      timer = setTimeout(() => {
        setVariant('subscribe')
        setShow(true)
      }, SHOW_DELAY_MS)
    })
    return () => { if (timer) clearTimeout(timer) }
  }, [platform.isIOS])

  function dismiss() {
    try {
      const key = variant === 'iosInstall' ? STORAGE_KEY_INSTALL : STORAGE_KEY_SUBSCRIBE
      localStorage.setItem(key, String(Date.now()))
    } catch {}
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
        @keyframes jtaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes jtaPop {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 22,
          padding: variant === 'iosInstall' ? '22px 22px 16px' : '24px 22px 18px',
          maxWidth: 340, width: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
          fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
          animation: 'jtaPop 220ms ease-out',
          textAlign: variant === 'iosInstall' ? 'left' : 'center',
        }}>

        {variant === 'subscribe' ? (
          <>
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
              <button onClick={handleEnable} disabled={loading} style={{
                background: '#c0612b', color: '#fff', border: 'none',
                padding: '13px', borderRadius: 14,
                fontSize: 14, fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '설정 중...' : '🔔 알림 켜기'}
              </button>
              <button onClick={dismiss} disabled={loading} style={{
                background: 'transparent', color: '#94857c', border: 'none',
                padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                나중에 (7일 동안 안 보기)
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 16,
                background: '#fef3ec',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
              }}>📱</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#2d1a0e' }}>
                  iPhone에서 알림 받기
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6a62' }}>
                  먼저 홈 화면에 추가해야 합니다
                </p>
              </div>
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#2d1a0e', lineHeight: 1.55 }}>
              iPhone은 <strong>홈 화면에 추가</strong>한 뒤 그 아이콘으로 앱을 열어야 알림을 받을 수 있어요.
            </p>

            <ol style={{
              margin: '0 0 12px', padding: '0 0 0 18px',
              fontSize: 12.5, color: '#2d1a0e', lineHeight: 1.7,
            }}>
              <li>Safari 하단 <strong>공유 버튼</strong> <span style={{
                display: 'inline-block', width: 16, height: 16, lineHeight: '14px',
                textAlign: 'center', border: '1.5px solid #2d1a0e', borderRadius: 4,
                fontSize: 10, fontWeight: 700, verticalAlign: 'middle',
              }}>↑</span> 누르기</li>
              <li><strong>"홈 화면에 추가"</strong> 선택</li>
              <li>오른쪽 위 <strong>"추가"</strong> 누르기</li>
              <li>홈 화면의 <strong>JTA 아이콘</strong>으로 다시 열면 알림이 떠요</li>
            </ol>

            <div style={{
              padding: '10px 12px', background: '#fef3ec',
              borderRadius: 10, fontSize: 11, color: '#92400e', lineHeight: 1.45,
            }}>
              ℹ️ 반드시 <strong>Safari</strong>로 열어야 합니다 (Chrome/네이버앱 ✕)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
              <button onClick={dismiss} style={{
                background: '#c0612b', color: '#fff', border: 'none',
                padding: '12px', borderRadius: 14,
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}>
                알겠습니다
              </button>
              <button onClick={dismiss} style={{
                background: 'transparent', color: '#94857c', border: 'none',
                padding: '6px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                7일 동안 안 보기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
