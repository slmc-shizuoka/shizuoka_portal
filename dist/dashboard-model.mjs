export const TASK_LIMIT = 500;
export function localDateKey(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDue(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function readTasks(raw) {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > TASK_LIMIT) throw new Error('Invalid task data');
  const ids = new Set();
  for (const task of data) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
        typeof task.title !== 'string' || !task.title.trim() || task.title.length > 200 ||
        !validDue(task.due) || typeof task.done !== 'boolean' ||
        !Number.isFinite(task.createdAt)) throw new Error('Invalid task');
    ids.add(task.id);
  }
  return data;
}
export function taskCounts(tasks, today) {
  return {
    open: tasks.filter(t => !t.done).length,
    today: tasks.filter(t => !t.done && t.due === today).length,
    overdue: tasks.filter(t => !t.done && t.due && t.due < today).length,
    done: tasks.filter(t => t.done).length
  };
}
export function visibleTasks(tasks, filter, today) {
  return tasks.filter(t => filter === 'all' || (filter === 'open' && !t.done) ||
    (filter === 'done' && t.done) || (filter === 'today' && !t.done && t.due === today))
    .sort((a, b) => Number(a.done) - Number(b.done) ||
      (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99') || a.createdAt - b.createdAt);
}
