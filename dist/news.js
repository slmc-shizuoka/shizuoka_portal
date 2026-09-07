(() => {
  'use strict';
  const CACHE_KEY = 'shizuoka-portal-news-cache-v3';
  const MAX_AGE = 30 * 60 * 1000;
  const feeds = [
    { key:'ai', label:'AI', query:'AI' },
    { key:'apple', label:'Apple', query:'Apple', rss:'https://iphone-mania.jp/feed/', browse:'https://iphone-mania.jp/', source:'iPhone Mania', direct:true },
    { key:'google', label:'Google', query:'Google' },
  ].map(feed => ({
    ...feed,
    rss:feed.rss || `https://news.google.com/rss/search?q=${encodeURIComponent(feed.query)}&hl=ja&gl=JP&ceid=JP:ja`,
    browse:feed.browse || `https://news.google.com/search?q=${encodeURIComponent(feed.query)}&hl=ja&gl=JP&ceid=JP:ja`,
  }));
  const container = document.querySelector('#news-feeds');
  const status = document.querySelector('#news-status');
  const refreshButton = document.querySelector('#news-refresh');
  const filterButtons = [...document.querySelectorAll('[data-news-filter]')];
  let currentData = {};
  let activeFilter = 'all';

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch { return null; }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(date);
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY));
      return value && typeof value.savedAt === 'number' && value.data ? value : null;
    } catch { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt:Date.now(), data })); } catch { /* News remains available for this view. */ }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(data) {
    currentData = data;
    container.replaceChildren();
    const merged = feeds.flatMap(feed => (Array.isArray(data[feed.key]) ? data[feed.key] : []).map(item => ({ ...item, category:feed.key, categoryLabel:feed.label })));
    const unique = [...new Map(merged.map(item => [item.title.toLocaleLowerCase('ja'), item])).values()]
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const visible = activeFilter === 'all' ? unique : unique.filter(item => item.category === activeFilter);
    document.querySelector('#news-visible-count').textContent = String(visible.length).padStart(2, '0');
    filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.newsFilter === activeFilter)));
    if (!visible.length) {
      container.append(element('p', 'news-unavailable', 'ニュースを取得できませんでした。カテゴリの元サイトから最新情報を確認できます。'));
      return;
    }
    for (const item of visible) {
      const url = safeUrl(item.link);
      if (!url) continue;
      const link = element('a', 'news-wire-item');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const time = element('time', 'news-wire-item__time', formatDate(item.pubDate));
      time.dateTime = item.pubDate || '';
      link.append(
        time,
        element('span', `news-wire-item__category news-wire-item__category--${item.category}`, item.categoryLabel),
        element('strong', 'news-wire-item__title', item.title || 'Untitled'),
        element('span', 'news-wire-item__source', item.author || 'Google News'),
        element('span', 'news-wire-item__arrow', '↗')
      );
      container.append(link);
    }
  }

  async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { signal:controller.signal, cache:'no-store' });
    } finally { clearTimeout(timer); }
  }

  function parseXml(text, source) {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid RSS XML');
    return [...xml.querySelectorAll('item')].slice(0, 8).map(item => ({
      title:String(item.querySelector('title')?.textContent || '').trim().slice(0, 240),
      link:String(item.querySelector('link')?.textContent || '').trim(),
      pubDate:String(item.querySelector('pubDate')?.textContent || '').trim(),
      author:String(item.querySelector('author, creator')?.textContent || source).trim().slice(0, 80),
    }));
  }

  async function fetchFeed(feed) {
    if (feed.direct) {
      try {
        const direct = await fetchWithTimeout(feed.rss, 6000);
        if (direct.ok) {
          const items = parseXml(await direct.text(), feed.source || feed.label);
          if (items.length) return items;
        }
      } catch { /* Use the JSON RSS bridge when direct CORS access is unavailable. */ }
    }
    const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.rss)}`;
    const response = await fetchWithTimeout(endpoint, 9000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.status !== 'ok' || !Array.isArray(payload.items)) throw new Error('Invalid RSS response');
    return payload.items.slice(0, 8).map(item => ({
      title:String(item.title || '').trim().slice(0, 240),
      link:item.link,
      pubDate:item.pubDate,
      author:String(item.author || feed.source || '').trim().slice(0, 80),
    }));
  }

  async function refresh(force = false) {
    const cached = readCache();
    if (cached) render(cached.data);
    if (!force && cached && Date.now() - cached.savedAt < MAX_AGE) {
      status.textContent = `Updated ${new Intl.DateTimeFormat('ja-JP', { hour:'2-digit', minute:'2-digit' }).format(cached.savedAt)}`;
      return;
    }
    refreshButton.disabled = true;
    status.textContent = 'Updating RSS…';
    const results = await Promise.allSettled(feeds.map(fetchFeed));
    const data = {};
    results.forEach((result, index) => {
      data[feeds[index].key] = result.status === 'fulfilled' ? result.value : (cached?.data?.[feeds[index].key] || []);
    });
    render(data);
    if (results.some(result => result.status === 'fulfilled')) writeCache(data);
    const failed = results.filter(result => result.status === 'rejected').length;
    status.textContent = failed ? `${3 - failed} / 3 feeds updated` : 'All feeds updated';
    refreshButton.disabled = false;
  }

  refreshButton.addEventListener('click', () => refresh(true));
  filterButtons.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.newsFilter;
    render(currentData);
  }));
  refresh();
})();
