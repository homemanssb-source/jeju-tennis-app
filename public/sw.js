// JTA 제주시테니스 Service Worker
const CACHE_NAME = 'jta-ranking-v2'; // 버전 올려서 기존 캐시 강제 삭제

// 캐시할 정적 에셋만 (JS/HTML 제외)
const STATIC_ASSETS = ['/icon-192x192.png', '/icon-512x512.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).hostname.includes('supabase')) return;

  const url = new URL(e.request.url);

  // 이미지/아이콘만 캐시 우선
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // JS/HTML/API 등은 항상 네트워크 우선 (Network-First)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // manifest.json 정도만 캐시
        if (url.pathname === '/manifest.json' && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => {
        // 오프라인일 때만 캐시 폴백
        return caches.match(e.request) || caches.match('/');
      })
  );
});

// 이하 push/notificationclick 핸들러는 그대로 유지
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(d.title || '🎾 JTA 제주시테니스', {
      body: d.body || '새로운 알림이 있습니다.',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'jta-notification',
      renotify: true,
      data: { url: d.url || '/' },
      actions: [
        { action: 'open',  title: '확인하기' },
        { action: 'close', title: '닫기' }
      ]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});