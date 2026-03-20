// JTA 테니스 Service Worker
const CACHE_NAME = 'jta-ranking-v5';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192x192.png', '/icon-512x512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
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

  // 모든 요청 network-first
  // iOS Safari는 cache-first 시 구버전을 계속 보여주는 문제 있음
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 네트워크 성공 시 캐시 갱신
        if (res && res.status === 200 && res.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => {
        // 오프라인 시 캐시 폴백
        return caches.match(e.request).then(cached => cached || caches.match('/index.html'));
      })
  );
});

self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(d.title || '🎾 JTA 테니스', {
      body: d.body || '새로운 알림이 있습니다.',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'jta-notification',
      renotify: true,
      data: { url: d.url || '/' },
      actions: [
        { action: 'open', title: '확인하기' },
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
