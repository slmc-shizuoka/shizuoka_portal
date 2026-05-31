// =============================================
// SHIZUOKA PORTAL — Service Worker
// キャッシュ名にバージョンを付けて管理する。
// 更新時はCACHE_VERSIONの数字を上げるだけでOK。
// =============================================
const CACHE_VERSION = 'v1';
const CACHE_NAME = `shizuoka-portal-${CACHE_VERSION}`;

// インストール時にキャッシュしておくファイル一覧
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ===== インストール =====
// SWが初めて登録されたとき、必要ファイルを事前キャッシュする
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // 新しいSWをすぐに有効化(waitingをスキップ)
  self.skipWaiting();
});

// ===== アクティベート =====
// 古いキャッシュ(バージョンが異なるもの)を削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('shizuoka-portal-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // 開いているすべてのタブですぐに新SWを制御下に置く
  self.clients.claim();
});

// ===== フェッチ =====
// リクエスト処理の戦略: ネットワーク優先(Network First)
// → オンライン時は常に最新を取得、失敗時のみキャッシュを返す
// → 外部リンク(Google, auなど)はキャッシュしない
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 同一オリジン(Vercelのドメイン)のみキャッシュ戦略を適用
  // 外部リンクはそのままネットワークへ
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // ネットワーク取得成功 → キャッシュを更新しつつレスポンスを返す
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // ネットワーク失敗(オフライン) → キャッシュから返す
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // キャッシュにもない場合はメインHTMLを返す(SPAフォールバック)
          return caches.match('/');
        });
      })
  );
});
