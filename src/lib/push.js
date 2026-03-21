// src/lib/push.js
// 웹 자체 VAPID 푸시 — 프론트엔드 구독/해제 유틸

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// base64url → Uint8Array 변환 (VAPID 키 형식 변환)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// ─── 푸시 지원 여부 ──────────────────────────────
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// ─── 현재 구독 상태 확인 ─────────────────────────
export async function getPushSubscription() {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

// ─── 구독 요청 ───────────────────────────────────
export async function subscribePush() {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.')
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY 환경변수가 없습니다.')

  // SW 등록 (이미 등록돼 있으면 기존 것 반환)
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  // 브라우저 권한 요청 + VAPID 구독 생성
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  // Supabase Edge Function에 구독 정보 저장
  const json = sub.toJSON()
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-subscribe`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    }
  )
  if (!res.ok) {
    // DB 저장 실패 시 브라우저 구독도 롤백 (불일치 방지)
    await sub.unsubscribe().catch(() => {})
    throw new Error('구독 정보 저장 실패')
  }
  return sub
}

// ─── 구독 해제 ───────────────────────────────────
export async function unsubscribePush() {
  const sub = await getPushSubscription()
  if (!sub) return

  // Supabase에서 삭제
  await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-subscribe`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }
  )

  // 브라우저 구독 해제
  await sub.unsubscribe()
}
