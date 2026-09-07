export const METRICS = [{ key:'pro', label:'総Pro', unit:'円' }, ...['VC','EX','AO','BOX'].map(key=>({key,label:key,unit:'件'}))];
export const STATUSES = { normal:'通常', prospect:'受注見込み', won:'受注済み', cancelled:'キャンセル' };
export const emptyMetrics = () => Object.fromEntries(METRICS.map(m=>[m.key,0]));
export const emptyState = () => ({results:{}, goals:{week:{},month:{}}, appointments:[]});
export function validDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return !isNaN(date) && date.toISOString().slice(0,10)===value;
}
export function shiftDate(key, days) { const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10); }
export function periods(key) {
  const day=new Date(key+'T12:00:00Z').getUTCDay();
  const start=shiftDate(key,-((day+6)%7));
  const month=key.slice(0,7), first=month+'-01';
  const next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  return {week:{key:start,start,end:shiftDate(start,6)},month:{key:month,start:first,end:shiftDate(next.toISOString().slice(0,10),-1)}};
}
export function validMetrics(value) {return value && METRICS.every(({key})=>Number.isSafeInteger(value[key]) && value[key]>=0 && value[key]<=999999999);}
export function parseState(raw) {
  if (raw===null) return emptyState();
  const s=JSON.parse(raw);
  if (!s||!s.results||!s.goals?.week||!s.goals?.month||!Array.isArray(s.appointments)) throw Error('Invalid saved data');
  for (const [key,value] of Object.entries(s.results)) if(!validDate(key)||!validMetrics(value))throw Error('Invalid results');
  for (const type of ['week','month']) for (const [key,value] of Object.entries(s.goals[type])) {
    if(!validDate(type==='week'?key:key+'-01') || (type==='week'&&periods(key).week.key!==key) || !validMetrics(value))throw Error('Invalid goals');
  }
  const ids=new Set();
  for(const a of s.appointments) {
    if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||!validDate(a.date)||typeof a.title!=='string'||!a.title.trim()||a.title.length>120||!['VC','EX','AO','BOX','other'].includes(a.type)||!Object.hasOwn(STATUSES,a.status)||typeof a.time!=='string'||(a.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)))throw Error('Invalid appointment');
    ids.add(a.id);
  }
  return s;
}
export function summarize(s,period) {
  const totals=emptyMetrics();
  for(const [date,values] of Object.entries(s.results)) if(date>=period.start&&date<=period.end) for(const m of METRICS)totals[m.key]+=values[m.key];
  const appointments=s.appointments.filter(a=>a.date>=period.start&&a.date<=period.end&&a.status!=='cancelled');
  return {totals,total:appointments.length,prospect:appointments.filter(a=>a.status==='prospect').length,won:appointments.filter(a=>a.status==='won').length};
}
export function progress(actual,target) {return target>0?Math.round(actual/target*1000)/10:null;}
