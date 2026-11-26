// 今日ページの画面のファイルを、この端末に置いておく（電波が無くても、弱くても開けるように）。
// 画面のファイル（同じ場所の index.html、アイコン、設定）だけを扱う。Googleの窓口との通信には手を出さない。
// 開くたびに新しい画面を取りに行く。数秒（NET_TIMEOUT_MS）待っても返事が無ければ、置いてある画面を先に出す
// （電車や地下で、何十秒も白い画面のままにならないように）。遅れて届いた新しい画面は、置き場所に入れて次に使う。
// 置いてある画面が無いとき（初めて開いたとき）は、遅くても新しい画面を待つ。中身は index.html が前回の分を出す。
const CACHE = 'today-shell-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
const NET_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // 窓口との通信は素通し
  // 新しい画面を取りに行き、取れたら置き場所に入れる（返事が遅くて置いてある画面を先に出したときも、入れておく）
  let store = Promise.resolve();
  const net = fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); store = caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  e.waitUntil(net.then(() => store, () => {}));
  e.respondWith(new Promise((resolve, reject) => {
    let done = false;
    const finish = r => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    // 待ちすぎたら、置いてある画面を出す（無ければ、そのまま新しい画面を待つ）
    const timer = setTimeout(() => { cached().then(r => { if (r) finish(r); }, () => {}); }, NET_TIMEOUT_MS);
    net.then(finish, err => {
      cached().then(r => { if (r) finish(r); else if (!done) { done = true; clearTimeout(timer); reject(err); } }, () => { if (!done) { done = true; reject(err); } });
    });
  }));
});
