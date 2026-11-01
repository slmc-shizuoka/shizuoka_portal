import { TASK_LIMIT, localDateKey, validDue, readTasks, taskCounts, visibleTasks } from './dashboard-model.mjs';

const TASK_KEY = 'shizuoka-portal.tasks.v1';
const $ = selector => document.querySelector(selector);
const list = $('#task-list');
const taskStatus = $('#task-status');
const titleInput = $('#task-title');
const dueInput = $('#task-due');
let tasks = [];
let filter = 'selected';
let selectedDay = localDateKey();
let editingId = null;
let deletedTask = null;
let today = localDateKey();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function loadTasks() {
  try { tasks = readTasks(localStorage.getItem(TASK_KEY)); }
  catch { taskStatus.textContent = '保存済みタスクを読み込めませんでした。ブラウザの保存設定を確認してください。既存データは変更していません。'; }
}
function commit(change, message) {
  try {
    // Read the latest data before every write to retain changes made in another tab.
    const latest = readTasks(localStorage.getItem(TASK_KEY));
    const next = change(latest);
    if (!next) return false;
    readTasks(JSON.stringify(next));
    localStorage.setItem(TASK_KEY, JSON.stringify(next));
    tasks = next;
    render();
    taskStatus.textContent = message;
    return true;
  } catch {
    taskStatus.textContent = '保存できませんでした。入力内容は残っています。ブラウザの保存設定や空き容量を確認してください。';
    return false;
  }
}
function stopEditing() {
  editingId = null;
  $('#task-form').reset();
  dueInput.value = selectedDay;
  titleInput.setCustomValidity(''); dueInput.setCustomValidity('');
  $('#task-submit').textContent = '追加';
  $('#task-edit-cancel').hidden = true;
}
function focusTask(id) {
  const row = [...list.children].find(node => node.dataset.id === id);
  (row?.querySelector('input') || titleInput).focus();
}
function render() {
  today = localDateKey();
  const date = new Date();
  $('#workspace-date').dateTime = today;
  $('#workspace-date').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  for (const [name, count] of Object.entries(taskCounts(tasks, today))) $(`#count-${name}`).textContent = count;
  $('#count-overdue').parentElement.classList.toggle('has-overdue', taskCounts(tasks, today).overdue > 0);
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  list.replaceChildren();
  const shown = filter === 'selected' ? visibleTasks(tasks.filter(task => task.due === selectedDay), 'all', today) : visibleTasks(tasks, filter, today);
  $('#task-empty').hidden = shown.length > 0;
  $('#task-empty').textContent = !tasks.length ? 'タスクはまだありません。次にやることを追加しましょう。' :
    ({ selected: 'この日のタスクはありません。期限に選択日を設定して追加できます。', open: '未完了のタスクはありません。', today: '今日が期限の未完了タスクはありません。', done: '完了したタスクはありません。', all: 'タスクはありません。' })[filter];
  shown.forEach(task => {
    const row = element('li', `task-row${task.done ? ' is-done' : ''}`); row.dataset.id = task.id;
    const check = element('input', 'task-check'); check.type = 'checkbox'; check.checked = task.done;
    check.setAttribute('aria-label', `${task.title}：${task.done ? '未完了に戻す' : '完了にする'}`);
    check.addEventListener('change', () => {
      if (!commit(latest => latest.map(item => item.id === task.id ? { ...item, done: check.checked } : item), check.checked ? 'タスクを完了しました。' : '未完了に戻しました。')) check.checked = task.done;
      focusTask(task.id);
    });
    const body = element('div', 'task-body');
    body.append(element('span', 'task-name', task.title));
    if (task.due) {
      const overdue = !task.done && task.due < today;
      const due = element('time', `task-due${overdue ? ' is-overdue' : ''}`, `${task.due.replaceAll('-', '.')} ${overdue ? '/ 期限超過' : !task.done && task.due === today ? '/ 今日' : ''}`);
      due.dateTime = task.due; body.append(due);
    }
    const controls = element('div', 'task-controls');
    const edit = element('button', '', '編集'); edit.type = 'button'; edit.setAttribute('aria-label', `${task.title}を編集`);
    edit.addEventListener('click', () => {
      editingId = task.id; titleInput.value = task.title; dueInput.value = task.due;
      titleInput.setCustomValidity(''); dueInput.setCustomValidity('');
      $('#task-submit').textContent = '更新'; $('#task-edit-cancel').hidden = false;
      titleInput.focus(); taskStatus.textContent = 'タスクを編集中です。';
    });
    const remove = element('button', '', '削除'); remove.type = 'button'; remove.setAttribute('aria-label', `${task.title}を削除`);
    remove.addEventListener('click', () => {
      let removed = null;
      if (commit(latest => { removed = latest.find(item => item.id === task.id); return latest.filter(item => item.id !== task.id); }, 'タスクを削除しました。')) {
        deletedTask = removed; $('#task-undo').hidden = !deletedTask;
        if (editingId === task.id) stopEditing();
        ($('#task-undo').hidden ? titleInput : $('#task-undo')).focus();
      }
    });
    controls.append(edit, remove); row.append(check, body, controls); list.append(row);
  });
}
$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const due = dueInput.value;
  if (!title) { titleInput.setCustomValidity('タスクを入力してください。'); titleInput.reportValidity(); return; }
  if (!validDue(due)) { dueInput.setCustomValidity('有効な期限を指定してください。'); dueInput.reportValidity(); return; }
  const wasEditing = editingId;
  const success = commit(latest => {
    if (editingId) {
      if (!latest.some(item => item.id === editingId)) { taskStatus.textContent = 'このタスクは別のタブで削除されました。編集をやめてから追加してください。'; return null; }
      return latest.map(item => item.id === editingId ? { ...item, title, due } : item);
    }
    if (latest.length >= TASK_LIMIT) { taskStatus.textContent = 'タスクは500件まで保存できます。不要なタスクを削除してください。'; return null; }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return [...latest, { id, title, due, done: false, createdAt: Date.now() }];
  }, wasEditing ? 'タスクを更新しました。' : 'タスクを追加しました。');
  if (success) { stopEditing(); if (!wasEditing) { filter = due === selectedDay ? 'selected' : 'all'; render(); } titleInput.focus(); }
});
titleInput.addEventListener('input', () => titleInput.setCustomValidity(''));
dueInput.addEventListener('input', () => dueInput.setCustomValidity(''));
$('#task-edit-cancel').addEventListener('click', () => { stopEditing(); titleInput.focus(); taskStatus.textContent = ''; });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; render(); }));
$('#task-undo').addEventListener('click', () => {
  if (!deletedTask) return;
  if (commit(latest => {
    if (latest.some(item => item.id === deletedTask.id)) return latest;
    if (latest.length >= TASK_LIMIT) { taskStatus.textContent = '500件に達しているため復元できません。'; return null; }
    return [...latest, deletedTask];
  }, '削除したタスクを戻しました。')) {
    const id = deletedTask.id;
    deletedTask = null; $('#task-undo').hidden = true; filter = 'all'; render(); focusTask(id);
  }
});
window.addEventListener('storage', event => {
  if (event.key === TASK_KEY || event.key === null) { loadTasks(); render(); }
});
// Refresh dates after midnight or when returning to a backgrounded mobile tab.
window.setInterval(() => { if (today !== localDateKey()) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadTasks(); render(); } });
window.addEventListener('day-log-before-change', event => {
  if ((titleInput.value.trim() || editingId) && !window.confirm('入力中のTo-doを破棄して日付を変更しますか？')) event.preventDefault();
});
window.addEventListener('day-log-selected', event => {
  const next = event.detail.date;
  if (next !== selectedDay) { selectedDay = next; stopEditing(); }
  else if (!editingId && !titleInput.value.trim()) dueInput.value = selectedDay;
  filter = 'selected'; render();
});
loadTasks(); render(); dueInput.value = selectedDay; $('#workspace-content').hidden = false;
