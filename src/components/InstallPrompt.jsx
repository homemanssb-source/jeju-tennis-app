import { useState, useEffect } from 'react'

const STORAGE_KEY = 'jta_install_prompt_dismissed_at'
const SUPPRESS_DAYS = 7

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function detectPlatform() {
  const ua = (navigator.userAgent || '').toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isSafari = isIOS && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)
  const isAndroid = /android/.test(ua)
  return { isIOS, isSafari, isAndroid }
}

function suppressedRecently() {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0)
    if (!ts) return false
    const days = (Date.now() - ts) / 86400000
    return days < SUPPRESS_DAYS
  } catch { return false }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)
  const platform = detectPlatform()

  useEffect(() => {
    if (isStandalone()) return
    if (suppressedRecently()) return

    // Android/Chrome: 네이티브 설치 다이얼로그용 이벤트 캐치
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari: beforeinstallprompt 미지원 → 5초 후 가이드 배너 표시
    let iosTimer = null
    if (platform.isIOS && platform.isSafari) {
      iosTimer = setTimeout(() => setShow(true), 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [platform.isIOS, platform.isSafari])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
    setShow(false)
    setIosModalOpen(false)
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') dismiss()
      setDeferredPrompt(null)
      setShow(false)
    } else if (platform.isIOS) {
      setIosModalOpen(true)
    }
  }

  if (!show) return null

  return (
    <>
      {/* 하단 고정 배너 */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: '#fff', borderTop: '1px solid #f0e8e0',
        padding: '12px 16px env(safe-area-inset-bottom, 12px)',
        zIndex: 60, boxShadow: '0 -6px 20px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          maxWidth: 512, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#c0612b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>📱</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2d1a0e' }}>
              앱으로 설치하기
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6a62' }}>
              {platform.isIOS
                ? '홈 화면에 추가하고 알림을 받으세요'
                : '한 번 설치하면 빠르게 열리고 알림을 받을 수 있어요'}
            </p>
          </div>
          <button
            onClick={handleInstall}
            style={{
              background: '#c0612b', color: '#fff', border: 'none',
              padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}>
            설치
          </button>
          <button
            onClick={dismiss}
            aria-label="닫기"
            style={{
              background: 'transparent', border: 'none', color: '#bdb1a8',
              fontSize: 18, cursor: 'pointer', padding: '4px 6px', flexShrink: 0,
            }}>×</button>
        </div>
      </div>

      {/* iOS 설치 안내 모달 */}
      {iosModalOpen && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 70,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: 22,
              maxWidth: 360, width: '100%',
              fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, background: '#c0612b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>📱</div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#2d1a0e' }}>
                  iPhone에 설치하기
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6a62' }}>
                  Safari에서 아래 단계로 진행하세요
                </p>
              </div>
            </div>

            <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, color: '#2d1a0e', lineHeight: 1.7 }}>
              <li>화면 하단의 <strong>공유 버튼</strong> <span style={{
                display: 'inline-block', width: 18, height: 18, lineHeight: '16px',
                textAlign: 'center', border: '1.5px solid #2d1a0e', borderRadius: 4,
                fontSize: 11, fontWeight: 700, verticalAlign: 'middle',
              }}>↑</span> 을 누릅니다</li>
              <li>메뉴에서 <strong>"홈 화면에 추가"</strong>를 선택합니다</li>
              <li>오른쪽 위 <strong>"추가"</strong>를 누르면 완료!</li>
            </ol>

            <div style={{
              marginTop: 14, padding: '10px 12px', background: '#fef3ec',
              borderRadius: 10, fontSize: 11, color: '#92400e',
            }}>
              ℹ️ Chrome/네이버 앱에서는 설치되지 않아요. 반드시 <strong>Safari</strong>로 열어주세요.
            </div>

            <button
              onClick={dismiss}
              style={{
                marginTop: 16, width: '100%', background: '#c0612b', color: '#fff',
                border: 'none', padding: '12px', borderRadius: 12,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
              확인
            </button>
          </div>
        </div>
      )}
    </>
  )
}
