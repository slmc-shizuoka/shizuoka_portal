/* Per-browser preferences; user values are only inserted as text. */
(() => {
  'use strict';
  const key = 'shizuoka-portal.recommendations.v2';
  const legacyKey = 'shizuoka-portal.recommendations.v1';
  const container = document.querySelector('.features');
  const defaults = [];
  const dialog = document.querySelector('#recommendations-editor');
  const list = document.querySelector('#editor-items');
  const status = document.querySelector('#editor-status');
  const add = document.querySelector('#editor-add');
  let current = defaults.map(item => ({ ...item }));
  let draft = [];
  function valid(item) {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 80 ||
        typeof item.url !== 'string' || item.url.length > 2048 ||
        typeof item.description !== 'string' || item.description.length > 160) return false;
    try { const url = new URL(item.url); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function renderCards() {
    container.replaceChildren();
    container.classList.add('features--custom');
    if (!current.length) {
      container.append(node('p', 'shortcuts-empty', 'ショートカットはまだありません。「おすすめを編集」から追加できます。'));
      return;
    }
    current.forEach((item, index) => {
      const a = node('a', 'feature');
      a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const top = node('div', 'feature__top');
      top.append(node('span', '', `${String(index + 1).padStart(2, '0')} / MY LINK`), node('span', 'feature__badge', 'PINNED'));
      const body = node('div', 'feature__body');
      body.append(node('h3', '', item.title), node('p', '', item.description));
      const arrow = node('span', 'feature__arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
      a.append(top, body, arrow, node('span', 'sr-only', '（新しいタブで開く）'));
      container.append(a);
    });
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length <= 12 && saved.every(valid)) current = saved;
    } else {
      const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      const defaultUrls = new Set([
        'https://emergency-card.serizawamo.workers.dev/',
        'https://transportation-expenses.serizawamo.workers.dev/',
        'https://docs.google.com/forms/d/e/1FAIpQLSe8eYu8jZJs3goSR2nxmx5PVyHkF7RmsjUIn9jLpug17cIcIg/viewform'
      ]);
      const isOldDefault = Array.isArray(legacy) && legacy.length === 3 && legacy.every(item => defaultUrls.has(item?.url));
      if (Array.isArray(legacy) && legacy.length <= 12 && legacy.every(valid) && !isOldDefault) current = legacy;
      localStorage.setItem(key, JSON.stringify(current));
    }
    renderCards();
  } catch { /* Default links remain usable if storage is unavailable. */ }
  function renderEditor(focusIndex, focusAction = 'title') {
    list.replaceChildren();
    draft.forEach((item, index) => {
      const row = node('fieldset', 'editor-item');
      row.append(node('legend', '', `リンク ${index + 1}`));
      [['title', '名前', 80], ['url', 'URL（https:// または http://）', 2048], ['description', '説明（任意）', 160]].forEach(([field, labelText, max]) => {
        const label = node('label', '', labelText);
        const input = node('input');
        input.type = field === 'url' ? 'url' : 'text'; input.value = item[field];
        input.maxLength = max; input.required = field !== 'description';
        input.dataset.field = field;
        if (field === 'url') { input.placeholder = 'https://example.com'; input.autocapitalize = 'off'; input.spellcheck = false; }
        input.addEventListener('input', () => { item[field] = input.value; input.setCustomValidity(''); });
        label.append(input); row.append(label);
      });
      const controls = node('div', 'editor-item-controls');
      [['up', '↑ 上へ'], ['down', '↓ 下へ'], ['delete', '削除']].forEach(([action, text]) => {
        const button = node('button', '', text); button.type = 'button'; button.dataset.action = action;
        button.disabled = action === 'up' ? index === 0 : action === 'down' ? index === draft.length - 1 : false;
        button.setAttribute('aria-label', `リンク ${index + 1}：${text}`);
        button.addEventListener('click', () => {
          status.textContent = '';
          if (action === 'delete') { draft.splice(index, 1); renderEditor(Math.min(index, draft.length - 1)); }
          else {
            const target = index + (action === 'up' ? -1 : 1);
            [draft[index], draft[target]] = [draft[target], draft[index]];
            renderEditor(target);
          }
        });
        controls.append(button);
      });
      row.append(controls); list.append(row);
    });
    add.disabled = draft.length >= 12;
    if (focusIndex !== undefined) list.children[focusIndex]?.querySelector(`[data-field="${focusAction}"]`)?.focus();
  }
  const open = document.querySelector('#customize-open');
  if (typeof dialog.showModal !== 'function') return;
  open.hidden = false;
  open.addEventListener('click', () => {
    draft = current.map(item => ({ ...item })); status.textContent = ''; renderEditor(); dialog.showModal();
  });
  ['editor-close', 'editor-cancel'].forEach(id => document.getElementById(id).addEventListener('click', () => dialog.close()));
  add.addEventListener('click', () => {
    if (draft.length >= 12) return;
    draft.push({ title: '', url: '', description: '' }); renderEditor(draft.length - 1);
  });
  document.querySelector('#editor-reset').addEventListener('click', () => {
    draft = defaults.map(item => ({ ...item })); renderEditor(); status.textContent = 'ショートカットをすべて削除しました。「保存する」で確定します。';
  });
  document.querySelector('#recommendations-form').addEventListener('submit', event => {
    event.preventDefault();
    const next = draft.map(item => ({ title: item.title.trim(), url: item.url.trim(), description: item.description.trim() }));
    const bad = next.findIndex(item => !valid(item));
    if (bad !== -1) {
      status.textContent = `リンク ${bad + 1} の名前とURLを確認してください。URLは https:// または http:// で指定します。`;
      list.children[bad].querySelector('[data-field="url"]').focus(); return;
    }
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { status.textContent = '保存できませんでした。ブラウザの保存設定や空き容量を確認してください。入力内容はこの画面に残っています。'; return; }
    current = next; renderCards(); dialog.close();
    document.querySelector('#recommendations-status').textContent = 'おすすめを保存しました。';
  });
})();
