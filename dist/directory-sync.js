(() => {
  'use strict';
  const STORAGE_KEY = 'shizuoka-portal-directory-sheet';
  const nav = document.querySelector('.directory-nav nav');
  const categories = document.querySelector('.categories');
  const summary = document.querySelector('.section-heading--directory>p');
  const dialog = document.querySelector('#directory-sync-dialog');
  const form = document.querySelector('#directory-sync-form');
  const input = document.querySelector('#directory-sheet-url');
  const status = document.querySelector('#directory-sync-status');
  const defaultNav = nav.cloneNode(true);
  const defaultCategories = categories.cloneNode(true);

  function savedSource() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  }

  function saveSource(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* Built-in links remain available. */ }
  }

  function csvEndpoint(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('HTTPSのURLを入力してください。');
    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match || url.pathname.includes('/d/e/')) return url.href;
    const hashGid = url.hash.match(/gid=(\d+)/)?.[1];
    const gid = url.searchParams.get('gid') || hashGid;
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (char !== '\r') cell += char;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(values => values.some(value => value.trim() !== ''));
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function records(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, ''));
    if (rows.length < 2) throw new Error('ヘッダーと1件以上のリンクが必要です。');
    const headers = rows[0].map(value => value.trim().toLowerCase());
    for (const required of ['category', 'title', 'url']) {
      if (!headers.includes(required)) throw new Error(`列「${required}」がありません。`);
    }
    const data = rows.slice(1).map((values, rowIndex) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
    const enabled = data.filter(item => !['false', '0', 'no', 'off', '非表示'].includes(item.enabled.toLowerCase()));
    if (enabled.length > 100) throw new Error('リンクは100件まで登録できます。');
    return enabled.map((item, index) => {
      let url;
      try { url = new URL(item.url); } catch { throw new Error(`${rowIndexLabel(index)}のURLが正しくありません。`); }
      if (url.protocol !== 'https:') throw new Error(`${rowIndexLabel(index)}はHTTPS URLにしてください。`);
      const category = item.category.slice(0, 60);
      const title = item.title.slice(0, 160);
      if (!category || !title) throw new Error(`${rowIndexLabel(index)}のcategoryまたはtitleが空です。`);
      return {
        category,
        categoryLabel:(item.category_label || category).slice(0, 80),
        categoryOrder:number(item.category_order, index),
        title,
        url:url.href,
        linkOrder:number(item.link_order, index),
      };
    });
  }

  function rowIndexLabel(index) { return `${index + 2}行目`; }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function updateSummary(linkCount, categoryCount) {
    const total = node('span', 'directory__total', String(linkCount));
    const divider = node('span', 'directory__divider', '/');
    summary.replaceChildren(total, document.createTextNode(' LINKS '), divider, document.createTextNode(` ${categoryCount} CATEGORIES`));
  }

  function render(data) {
    const groups = new Map();
    data.forEach(item => {
      if (!groups.has(item.category)) groups.set(item.category, { name:item.category, label:item.categoryLabel, order:item.categoryOrder, links:[] });
      const group = groups.get(item.category);
      group.order = Math.min(group.order, item.categoryOrder);
      group.links.push(item);
    });
    const ordered = [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja'));
    nav.replaceChildren();
    categories.replaceChildren();
    ordered.forEach((group, index) => {
      const id = `sheet-category-${index}`;
      const navLink = node('a', 'directory-nav__link', group.name);
      navLink.href = `#${id}`;
      nav.append(navLink);

      const section = node('section', `category category--${index}`);
      section.id = id;
      section.setAttribute('aria-labelledby', `${id}-title`);
      const header = node('header', 'category__header');
      const titleWrap = node('div');
      titleWrap.append(node('p', 'category__eyebrow', group.label), node('h3', '', group.name));
      titleWrap.querySelector('h3').id = `${id}-title`;
      header.append(node('span', 'category__number', String(index + 1).padStart(2, '0')), titleWrap, node('span', 'category__count', String(group.links.length).padStart(2, '0')));
      const links = node('div', 'category__links');
      group.links.sort((a, b) => a.linkOrder - b.linkOrder || a.title.localeCompare(b.title, 'ja')).forEach(item => {
        const anchor = node('a', 'link');
        anchor.href = item.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.append(node('span', '', item.title), node('span', 'link__arrow', '↗'), node('span', 'sr-only', '（新しいタブで開く）'));
        anchor.querySelector('.link__arrow').setAttribute('aria-hidden', 'true');
        links.append(anchor);
      });
      section.append(header, links);
      categories.append(section);
    });
    updateSummary(data.length, ordered.length);
  }

  function restoreDefaults() {
    nav.replaceChildren(...[...defaultNav.childNodes].map(item => item.cloneNode(true)));
    categories.replaceChildren(...[...defaultCategories.childNodes].map(item => item.cloneNode(true)));
    updateSummary(categories.querySelectorAll('.link').length, categories.querySelectorAll('.category').length);
  }

  async function sync(value, persist = false) {
    status.textContent = 'Syncing…';
    const endpoint = csvEndpoint(value);
    const response = await fetch(endpoint, { cache:'no-store' });
    if (!response.ok) throw new Error(`Sheetを取得できませんでした（${response.status}）。`);
    const text = await response.text();
    if (text.length > 300000 || /^\s*</.test(text)) throw new Error('公開CSVを取得できませんでした。共有設定を確認してください。');
    const data = records(text);
    render(data);
    if (persist) saveSource(value);
    status.textContent = `${data.length} links synced`;
    return data.length;
  }

  function csvCell(value) {
    const text = String(value).replaceAll('"', '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  }

  function downloadTemplate() {
    const output = [['category','category_label','title','url','category_order','link_order','enabled']];
    [...categories.querySelectorAll('.category')].forEach((section, categoryIndex) => {
      const category = section.querySelector('h3')?.textContent.trim() || '';
      const label = section.querySelector('.category__eyebrow')?.textContent.trim() || category;
      [...section.querySelectorAll('.link')].forEach((link, linkIndex) => {
        output.push([category,label,link.querySelector('span')?.textContent.trim() || '',link.href,categoryIndex + 1,linkIndex + 1,'TRUE']);
      });
    });
    const csv = '\uFEFF' + output.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'shizuoka-portal-links.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelector('#directory-sync-open').addEventListener('click', () => {
    input.value = savedSource();
    status.textContent = input.value ? 'Sheet connected' : 'Not connected';
    document.querySelector('#header-menu').open = false;
    dialog.showModal();
  });
  document.querySelector('#directory-sync-close').addEventListener('click', () => dialog.close());
  document.querySelector('#directory-sync-cancel').addEventListener('click', () => dialog.close());
  document.querySelector('#directory-template-download').addEventListener('click', downloadTemplate);
  document.querySelector('#directory-sync-reset').addEventListener('click', () => {
    saveSource('');
    input.value = '';
    restoreDefaults();
    status.textContent = '固定リンクに戻しました。';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) { status.textContent = 'Google Sheets URLを入力してください。'; input.focus(); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try { await sync(value, true); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '同期できませんでした。'; }
    finally { submit.disabled = false; }
  });

  const source = savedSource();
  if (source) sync(source).catch(() => { status.textContent = 'Sheetを同期できないため、固定リンクを表示しています。'; });
})();
