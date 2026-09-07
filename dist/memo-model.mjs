export const MEMO_LIMIT = 300;

export function normalizeTags(value) {
  const seen = new Set();
  return String(value).split(/[\s,、]+/).map(tag => tag.replace(/^#+/, '').trim()).filter(Boolean)
    .filter(tag => {
      const key = tag.toLocaleLowerCase('ja-JP');
      if (tag.length > 24 || seen.has(key) || seen.size >= 12) return false;
      seen.add(key);
      return true;
    });
}

export function validMemo(memo) {
  return memo && typeof memo.id === 'string' && memo.id &&
    typeof memo.title === 'string' && memo.title.length <= 120 &&
    typeof memo.body === 'string' && memo.body.length <= 30000 &&
    Array.isArray(memo.tags) && memo.tags.length <= 12 && memo.tags.every(tag => typeof tag === 'string' && tag && tag.length <= 24 && !/[\s,、]/.test(tag)) &&
    typeof memo.createdAt === 'string' && Number.isFinite(Date.parse(memo.createdAt)) &&
    typeof memo.updatedAt === 'string' && Number.isFinite(Date.parse(memo.updatedAt));
}

export function parseMemos(raw) {
  if (raw === null) return [];
  const memos = JSON.parse(raw);
  if (!Array.isArray(memos) || memos.length > MEMO_LIMIT || !memos.every(validMemo)) throw new Error('Invalid memo data');
  if (new Set(memos.map(memo => memo.id)).size !== memos.length) throw new Error('Duplicate memo ID');
  return memos;
}

export function searchMemos(memos, query) {
  const terms = String(query).trim().toLocaleLowerCase('ja-JP').split(/\s+/).filter(Boolean).map(term => term.replace(/^#/, ''));
  return [...memos].filter(memo => {
    const haystack = [memo.title, memo.body, ...memo.tags].join('\n').toLocaleLowerCase('ja-JP');
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
