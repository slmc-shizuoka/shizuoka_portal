const DB_NAME = 'shizuoka-portal-gallery';
const STORE = 'frames';
const MAX_IMAGES = 3;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const $ = selector => document.querySelector(selector);
const form = $('#gallery-form');
const input = $('#gallery-file');
const caption = $('#gallery-caption');
const grid = $('#gallery-grid');
const status = $('#gallery-status');
const viewer = $('#gallery-viewer');
let activeUrls = [];
let viewerUrl = null;
let selectedId = null;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Database request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Database transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Database transaction aborted'));
  });
}

const database = new Promise((resolve, reject) => {
  if (!('indexedDB' in globalThis)) {
    reject(new Error('IndexedDB unavailable'));
    return;
  }
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) {
      const store = request.result.createObjectStore(STORE, { keyPath:'id' });
      store.createIndex('createdAt', 'createdAt');
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Database unavailable'));
});

async function allFrames() {
  const db = await database;
  return requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
}

async function saveFrame(frame) {
  const db = await database;
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(frame);
  await transactionDone(transaction);
}

async function removeFrame(id) {
  const db = await database;
  const transaction = db.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle:'medium' }).format(new Date(value));
}

function clearUrls() {
  activeUrls.forEach(url => URL.revokeObjectURL(url));
  activeUrls = [];
}

function closeViewer() {
  viewer.close();
}

function openViewer(frame) {
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl = URL.createObjectURL(frame.blob);
  selectedId = frame.id;
  $('#gallery-viewer-title').textContent = frame.caption || 'Untitled';
  $('#gallery-viewer-image').src = viewerUrl;
  $('#gallery-viewer-image').alt = frame.caption || '保存した画像';
  $('#gallery-viewer-date').textContent = `Saved ${formatDate(frame.createdAt)}`;
  $('#gallery-viewer-date').dateTime = frame.createdAt;
  viewer.showModal();
}

async function render() {
  try {
    const frames = (await allFrames()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    clearUrls();
    grid.replaceChildren();
    $('#gallery-count').textContent = `${String(frames.length).padStart(2, '0')} / 03 — COLLECTION`;
    grid.dataset.count = String(frames.length);
    $('#gallery-capacity').textContent = frames.length >= MAX_IMAGES
      ? (frames.length > MAX_IMAGES ? '以前保存した画像は残しています。追加するには2枚以下に整理してください。' : '3枚のコレクションが揃いました。入れ替える場合は、画像を開いて削除してください。')
      : `あと${MAX_IMAGES - frames.length}枚保存できます。`;
    $('#gallery-empty').hidden = frames.length > 0;
    for (const [index, frame] of frames.entries()) {
      if (!frame || typeof frame.id !== 'string' || !(frame.blob instanceof Blob) || !ALLOWED_TYPES.has(frame.blob.type)) continue;
      const button = node('button', 'glass-frame');
      button.type = 'button';
      button.setAttribute('aria-label', `${frame.caption || '保存画像'}を拡大表示`);
      const imageWrap = node('span', 'glass-frame-image');
      const image = node('img');
      const url = URL.createObjectURL(frame.blob);
      activeUrls.push(url);
      image.src = url;
      image.alt = frame.caption || '保存した画像';
      image.loading = 'lazy';
      imageWrap.append(image);
      const details = node('span', 'glass-frame-details');
      details.append(node('strong', '', frame.caption || 'Untitled'), node('time', '', formatDate(frame.createdAt)));
      details.querySelector('time').dateTime = frame.createdAt;
      button.append(node('span', 'glass-frame-number', `COLLECTION / ${String(index + 1).padStart(2, '0')}`), imageWrap, details);
      button.addEventListener('click', () => openViewer(frame));
      grid.append(button);
    }
  } catch {
    status.textContent = 'Galleryを読み込めませんでした。ブラウザの保存設定を確認してください。';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const file = input.files?.[0];
  if (!file) {
    status.textContent = '画像を選択してください。';
    input.focus();
    return;
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    status.textContent = 'JPEG・PNG・WebP・GIF・AVIF形式の画像を選択してください。';
    return;
  }
  if (file.size > MAX_BYTES) {
    status.textContent = '画像サイズは15MB以下にしてください。';
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  status.textContent = 'Saving…';
  try {
    const frames = await allFrames();
    if (frames.length >= MAX_IMAGES) {
      status.textContent = '保存できる画像は3枚までです。画像を開いて1枚削除すると入れ替えられます。';
      return;
    }
    const now = new Date().toISOString();
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await saveFrame({ id, blob:file, caption:caption.value.trim(), filename:file.name.slice(0, 180), createdAt:now });
    form.reset();
    await render();
    $('#gallery-upload').open = false;
    status.textContent = 'Saved to Gallery';
    $('#gallery-upload summary').focus();
  } catch {
    status.textContent = '保存できませんでした。ブラウザの空き容量や保存設定を確認してください。選択した画像はそのまま残しています。';
  } finally {
    submit.disabled = false;
  }
});

$('#gallery-viewer-close').addEventListener('click', closeViewer);
viewer.addEventListener('close', () => {
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl = null;
  selectedId = null;
  $('#gallery-viewer-image').removeAttribute('src');
});
$('#gallery-delete').addEventListener('click', async () => {
  if (!selectedId || !window.confirm('この画像をGalleryから削除しますか？')) return;
  try {
    await removeFrame(selectedId);
    closeViewer();
    await render();
    status.textContent = 'Frame deleted';
  } catch {
    status.textContent = '画像を削除できませんでした。';
  }
});
window.addEventListener('pagehide', clearUrls);

render();
