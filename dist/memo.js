import { MEMO_LIMIT, normalizeTags, parseMemos, searchMemos } from './memo-model.mjs';

const KEY = 'shizuoka-portal.memos.v2';
const LEGACY_KEY = 'shizuoka-portal.memo.v1';
const $ = selector => document.querySelector(selector);
const title = $('#memo-title');
const tags = $('#memo-tags');
const body = $('#memo-body');
const status = $('#memo-status');
const list = $('#memo-list');
const search = $('#memo-search');
let memos = [];
let currentId = null;
let dirty = false;

function node(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function readLatest() {
  return parseMemos(localStorage.getItem(KEY));
}

function migrateLegacy() {
  if (localStorage.getItem(KEY) !== null) return;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  const legacy = JSON.parse(raw);
  if (!legacy || typeof legacy.title !== 'string' || legacy.title.length > 120 ||
      typeof legacy.body !== 'string' || legacy.body.length > 30000 || (!legacy.title.trim() && !legacy.body.trim())) return;
  const now = Number.isFinite(Date.parse(legacy.updatedAt)) ? legacy.updatedAt : new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify([{ id:newId(), title:legacy.title, body:legacy.body, tags:[], createdAt:now, updatedAt:now }]));
}

function updateTags() {
  const normalized = normalizeTags(tags.value);
  const preview = $('#memo-tag-preview');
  preview.replaceChildren(...normalized.map(tag => node('button', 'memo-tag', `#${tag}`)));
  preview.querySelectorAll('.memo-tag').forEach(button => {
    button.type = 'button';
    button.title = `${button.textContent} を検索`;
  });
}

function updateCount() {
  $('#memo-count').textContent = `${body.value.length.toLocaleString('ja-JP')} / 30,000`;
}

function markDirty() {
  dirty = true;
  status.textContent = 'Unsaved changes';
  updateTags();
  updateCount();
}

function clearEditor(message = 'New memo') {
  currentId = null;
  dirty = false;
  title.value = '';
  tags.value = '';
  body.value = '';
  status.textContent = message;
  $('#memo-delete').disabled = true;
  updateTags();
  updateCount();
  renderList();
}

function canLeaveEditor() {
  return !dirty || window.confirm('保存していない変更があります。破棄しますか？');
}

function openMemo(id) {
  if (id === currentId) return;
  if (!canLeaveEditor()) return;
  const memo = memos.find(item => item.id === id);
  if (!memo) return;
  currentId = id;
  dirty = false;
  title.value = memo.title;
  body.value = memo.body;
  tags.value = memo.tags.map(tag => `#${tag}`).join(' ');
  status.textContent = `Saved ${formatDate(memo.updatedAt)}`;
  $('#memo-delete').disabled = false;
  updateTags();
  updateCount();
  renderList();
  title.focus();
}

function renderList() {
  const results = searchMemos(memos, search.value);
  list.replaceChildren();
  $('#memo-result-count').textContent = `${results.length} ${results.length === 1 ? 'note' : 'notes'}`;
  $('#memo-search-clear').hidden = !search.value;
  $('#memo-empty').hidden = results.length > 0;
  $('#memo-empty').textContent = memos.length ? '検索に一致するメモはありません。' : '保存済みメモはありません。';
  for (const memo of results) {
    const item = node('li');
    const button = node('button', 'memo-list-item');
    button.type = 'button';
    button.dataset.id = memo.id;
    button.setAttribute('aria-current', memo.id === currentId ? 'true' : 'false');
    button.append(node('strong', '', memo.title.trim() || 'Untitled'));
    if (memo.tags.length) button.append(node('span', 'memo-list-tags', memo.tags.map(tag => `#${tag}`).join(' ')));
    const excerpt = memo.body.trim().replace(/\s+/g, ' ').slice(0, 90);
    if (excerpt) button.append(node('span', 'memo-list-excerpt', excerpt));
    const time = node('time', '', formatDate(memo.updatedAt));
    time.dateTime = memo.updatedAt;
    button.append(time);
    button.addEventListener('click', () => openMemo(memo.id));
    item.append(button);
    list.append(item);
  }
}

function load() {
  try {
    migrateLegacy();
    memos = readLatest();
    renderList();
  } catch {
    memos = [];
    status.textContent = '保存済みメモを読み込めませんでした。既存データは変更していません。';
    renderList();
  }
}

function saveMemo() {
  const normalizedTags = normalizeTags(tags.value);
  const memoTitle = title.value.trim();
  const memoBody = body.value;
  if (!memoTitle && !memoBody.trim()) {
    status.textContent = 'タイトルまたは本文を入力してください。';
    title.focus();
    return;
  }
  try {
    const latest = readLatest();
    const now = new Date().toISOString();
    if (currentId) {
      const index = latest.findIndex(item => item.id === currentId);
      if (index < 0) {
        status.textContent = 'このメモは別のタブで削除されています。New Memoから保存してください。';
        return;
      }
      latest[index] = { ...latest[index], title:memoTitle, body:memoBody, tags:normalizedTags, updatedAt:now };
    } else {
      if (latest.length >= MEMO_LIMIT) {
        status.textContent = 'メモは300件まで保存できます。不要なメモを削除してください。';
        return;
      }
      currentId = newId();
      latest.push({ id:currentId, title:memoTitle, body:memoBody, tags:normalizedTags, createdAt:now, updatedAt:now });
    }
    localStorage.setItem(KEY, JSON.stringify(latest));
    memos = latest;
    dirty = false;
    tags.value = normalizedTags.map(tag => `#${tag}`).join(' ');
    status.textContent = `Saved ${formatDate(now)}`;
    $('#memo-delete').disabled = false;
    updateTags();
    renderList();
  } catch {
    status.textContent = '保存できませんでした。入力内容はこの画面に残っています。';
  }
}

title.addEventListener('input', markDirty);
tags.addEventListener('input', markDirty);
body.addEventListener('input', markDirty);
$('#memo-save').addEventListener('click', saveMemo);
$('#memo-new').addEventListener('click', () => {
  if (!canLeaveEditor()) return;
  clearEditor();
  title.focus();
});
$('#memo-delete').addEventListener('click', () => {
  if (!currentId || !window.confirm('このメモを削除しますか？この操作は取り消せません。')) return;
  try {
    const latest = readLatest().filter(item => item.id !== currentId);
    localStorage.setItem(KEY, JSON.stringify(latest));
    memos = latest;
    clearEditor('Deleted');
    search.focus();
  } catch {
    status.textContent = '削除できませんでした。';
  }
});
search.addEventListener('input', renderList);
$('#memo-search-clear').addEventListener('click', () => {
  search.value = '';
  renderList();
  search.focus();
});
$('#memo-tag-preview').addEventListener('click', event => {
  const tag = event.target.closest('.memo-tag');
  if (!tag) return;
  search.value = tag.textContent;
  renderList();
  search.focus();
});
window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) {
    try { memos = readLatest(); renderList(); }
    catch { status.textContent = '別のタブの更新を読み込めませんでした。'; }
  }
});

load();
clearEditor(status.textContent.includes('読み込めません') ? status.textContent : 'New memo');
