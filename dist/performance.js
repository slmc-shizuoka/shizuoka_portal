import {METRICS,STATUSES,emptyMetrics,parseState,periods,shiftDate,summarize,progress,validMetrics} from './performance-model.mjs';
import {localDateKey} from './dashboard-model.mjs';
const KEY='shizuoka-portal.performance.v1';
const $=s=>document.querySelector(s);
const status=$('#performance-status');
let selected=localDateKey(), state, editing=null, deleted=null, resultsDirty=false, appointmentDirty=false;
const fmt=n=>n.toLocaleString('ja-JP');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function read(){try{state=parseState(localStorage.getItem(KEY));}catch{state=parseState(null);status.textContent='保存データを読み込めませんでした。既存データは変更していません。';}}
function save(change,message){
  try{
    const latest=parseState(localStorage.getItem(KEY));
    if(change(latest)===false)return false;
    parseState(JSON.stringify(latest));
    localStorage.setItem(KEY,JSON.stringify(latest));state=latest;render();status.textContent=message;return true;
  }catch{status.textContent='保存できませんでした。入力内容は残っています。ブラウザの保存設定や空き容量を確認してください。';return false;}
}
function metricFields(container,prefix,values){
  container.replaceChildren();
  for(const m of METRICS){const label=el('label','',`${m.label}（${m.unit}）`);const input=el('input');input.id=`${prefix}-${m.key}`;input.type='number';input.min='0';input.max='999999999';input.step='1';input.inputMode='numeric';input.value=values?.[m.key]??'';label.append(input);container.append(label);}
}
function getMetrics(prefix){return Object.fromEntries(METRICS.map(m=>[m.key,Number($(`#${prefix}-${m.key}`).value)]));}
function resetAppointment(){editing=null;appointmentDirty=false;$('#appointment-form').reset();$('#appointment-submit').textContent='予約を追加';$('#appointment-cancel').hidden=true;$('#appointment-title').setCustomValidity('');}
function selectDate(key){
  if(key===selected)return true;
  if((resultsDirty||appointmentDirty)&&!window.confirm('保存していない入力があります。破棄して日付を変更しますか？'))return false;
  const changeEvent=new CustomEvent('day-log-before-change',{detail:{date:key},cancelable:true});
  if(!window.dispatchEvent(changeEvent))return false;
  selected=key;resultsDirty=false;resetAppointment();fillResults();render();window.dispatchEvent(new CustomEvent('day-log-selected',{detail:{date:key}}));return true;
}
function fillResults(){metricFields($('#results-inputs'),'result',state.results[selected]);}
function renderProgress(){
  const container=$('#period-progress');container.replaceChildren();
  for(const [type,label] of [['week','Weekly'],['month','Monthly']]){
    const range=periods(selected)[type],summary=summarize(state,range),goals=state.goals[type][range.key]||emptyMetrics();
    const section=el('section','progress-period');const heading=el('div','period-heading');heading.append(el('h4','',label),el('span','',`${range.start} — ${range.end}`));section.append(heading);
    const rates=METRICS.map(m=>progress(summary.totals[m.key],goals[m.key]));
    const maximum=Math.max(100,...rates.filter(r=>r!==null).map(r=>Math.ceil(r/25)*25));
    const chart=el('div','performance-bar-chart');
    chart.append(el('p','chart-legend','オレンジ：達成率 ／ 白線：目標100%'));
    const axis=el('div','chart-axis');axis.append(el('span','','0%'),el('span','',`${fmt(maximum)}%`));chart.append(axis);
    METRICS.forEach((m,index)=>{
      const rate=rates[index],row=el('div','chart-row'),line=el('div','chart-label');
      line.append(el('strong','',m.label),el('span','',`${fmt(summary.totals[m.key])} / ${goals[m.key]>0?fmt(goals[m.key]):'—'} ${m.unit}`));row.append(line);
      const track=el('div','chart-track');track.setAttribute('role','img');track.setAttribute('aria-label',`${m.label}：${rate===null?'目標未設定':`達成率 ${rate}%`}`);
      if(rate!==null){const bar=el('span','chart-bar');bar.style.width=`${rate/maximum*100}%`;const target=el('span','chart-target');target.style.left=`${100/maximum*100}%`;track.append(bar,target);}
      row.append(track,el('span','chart-rate',rate===null?'目標未設定':`${fmt(rate)}%`));chart.append(row);
    });
    section.append(chart);
    const pipeline=el('div','pipeline-counts');for(const [title,value]of[['予約',summary.total],['受注見込み',summary.prospect],['受注済み',summary.won]]){const item=el('div');item.append(el('span','',title),el('strong','',`${value}件`));pipeline.append(item);}section.append(pipeline);container.append(section);
  }
}
function renderCalendar(){
  const range=periods(selected).month;$('#calendar-month').textContent=selected.slice(0,7).replace('-',' / ');
  $('#calendar-prev').disabled=range.key==='1900-01';$('#calendar-next').disabled=range.key==='2199-12';
  const start=periods(range.start).week.start,end=periods(range.end).week.end;const body=$('#calendar-days');body.replaceChildren();
  let row;
  for(let date=start;date<=end;date=shiftDate(date,1)){
    if(!row||row.children.length===7){row=el('tr');body.append(row);}
    const cell=el('td'),button=el('button','calendar-day');button.type='button';button.dataset.date=date;
    if(date.slice(0,7)!==range.key)button.classList.add('outside-month');
    if(date===localDateKey())button.classList.add('is-today');
    button.setAttribute('aria-pressed',String(date===selected));
    const appointments=state.appointments.filter(a=>a.date===date&&a.status!=='cancelled'),prospects=appointments.filter(a=>a.status==='prospect').length;
    const hasResult=Object.hasOwn(state.results,date);const number=el('span','calendar-number',String(Number(date.slice(-2))));button.append(number);
    if(appointments.length)button.append(el('span','calendar-ap',`${appointments.length} AP`));
    if(prospects)button.append(el('span','calendar-prospect',`${prospects} 見込`));
    if(hasResult){const mark=el('span','calendar-result','●');mark.setAttribute('aria-hidden','true');button.append(mark);}
    button.setAttribute('aria-label',`${date}、予約 ${appointments.length}件、受注見込み ${prospects}件${hasResult?'、実績入力済み':''}`);
    button.addEventListener('click',()=>{if(selectDate(date)){window.dispatchEvent(new CustomEvent('day-log-selected',{detail:{date:selected}}));$('#day-log-dialog').showModal();}});cell.append(button);row.append(cell);
  }
}
function renderAppointments(){
  const list=$('#appointment-list');list.replaceChildren();
  const items=state.appointments.filter(a=>a.date===selected).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  $('#day-appointment-count').textContent=`${items.filter(a=>a.status!=='cancelled').length} AP`;
  if(!items.length)list.append(el('li','appointment-empty','この日の予約はありません。'));
  for(const a of items){
    const item=el('li','appointment-item'),top=el('div','appointment-item-heading');top.append(el('span','',`${a.time||'時刻未定'} / ${a.type==='other'?'その他':a.type}`),el('span',`appointment-badge status-${a.status}`,STATUSES[a.status]));item.append(top,el('p','appointment-name',a.title));
    const actions=el('div','appointment-actions');
    const edit=el('button','','編集');edit.type='button';edit.setAttribute('aria-label',`${a.title}を編集`);edit.addEventListener('click',()=>{
      if(appointmentDirty&&!window.confirm('入力中の予約内容を破棄して編集しますか？'))return;
      editing=a.id;appointmentDirty=false;$('#appointment-title').value=a.title;$('#appointment-title').setCustomValidity('');$('#appointment-time').value=a.time;$('#appointment-type').value=a.type;$('#appointment-status').value=a.status;$('#appointment-submit').textContent='予約を更新';$('#appointment-cancel').hidden=false;$('#appointment-title').focus();
    });
    const remove=el('button','','削除');remove.type='button';remove.setAttribute('aria-label',`${a.title}を削除`);remove.addEventListener('click',()=>{
      let removed;
      if(save(latest=>{removed=latest.appointments.find(x=>x.id===a.id);latest.appointments=latest.appointments.filter(x=>x.id!==a.id);},'予約を削除しました。')){deleted=removed;$('#appointment-undo').hidden=!deleted;if(editing===a.id)resetAppointment();if(deleted)$('#appointment-undo').focus();}
    });actions.append(edit,remove);item.append(actions);list.append(item);
  }
}
function render(){renderProgress();renderCalendar();renderAppointments();$('#selected-day-title').textContent=selected.replaceAll('-','.');}
$('#results-form').addEventListener('input',()=>{resultsDirty=true;});
$('#results-form').addEventListener('submit',event=>{
  event.preventDefault();const values=getMetrics('result');if(!validMetrics(values)){status.textContent='実績は0以上の整数で入力してください。';return;}
  if(save(latest=>{latest.results[selected]=values;},`${selected} の実績を保存しました。`))resultsDirty=false;
});
$('#appointment-form').addEventListener('input',()=>{appointmentDirty=true;$('#appointment-title').setCustomValidity('');});
$('#appointment-form').addEventListener('change',()=>{appointmentDirty=true;});
$('#appointment-form').addEventListener('submit',event=>{
  event.preventDefault();const title=$('#appointment-title').value.trim();if(!title){$('#appointment-title').setCustomValidity('予約内容を入力してください。');$('#appointment-title').reportValidity();return;}
  const a={id:editing||(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`),date:selected,title,time:$('#appointment-time').value,type:$('#appointment-type').value,status:$('#appointment-status').value};
  if(save(latest=>{if(editing){const index=latest.appointments.findIndex(x=>x.id===editing);if(index<0){status.textContent='この予約は別のタブで削除されています。編集をやめてから追加してください。';return false;}latest.appointments[index]=a;}else latest.appointments.push(a);},editing?'予約を更新しました。':'予約を追加しました。')){resetAppointment();$('#appointment-title').focus();}
});
$('#appointment-cancel').addEventListener('click',resetAppointment);
$('#appointment-undo').addEventListener('click',()=>{if(deleted&&save(latest=>{if(!latest.appointments.some(a=>a.id===deleted.id))latest.appointments.push(deleted);},'予約を復元しました。')){deleted=null;$('#appointment-undo').hidden=true;}});
function moveMonth(delta){const date=new Date(selected.slice(0,7)+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);selectDate(date.toISOString().slice(0,10));}
$('#calendar-prev').addEventListener('click',()=>moveMonth(-1));$('#calendar-next').addEventListener('click',()=>moveMonth(1));$('#calendar-today').addEventListener('click',()=>selectDate(localDateKey()));
const goalsDialog=$('#goals-dialog');
$('#goals-open').addEventListener('click',()=>{
  const parent=$('#goals-inputs');parent.replaceChildren();$('#goals-status').textContent='';
  for(const [type,label]of[['week','Weekly Target'],['month','Monthly Target']]){const range=periods(selected)[type],group=el('fieldset','goal-group');group.append(el('legend','',`${label} / ${range.start} — ${range.end}`));const inputs=el('div','metric-inputs');metricFields(inputs,`goal-${type}`,state.goals[type][range.key]);group.append(inputs);parent.append(group);}goalsDialog.showModal();
});
for(const id of ['goals-close','goals-cancel'])$('#'+id).addEventListener('click',()=>goalsDialog.close());
$('#goals-form').addEventListener('submit',event=>{event.preventDefault();const week=getMetrics('goal-week'),month=getMetrics('goal-month');if(!validMetrics(week)||!validMetrics(month)){$('#goals-status').textContent='目標は0以上の整数で入力してください。';return;}
  const ranges=periods(selected);if(save(latest=>{latest.goals.week[ranges.week.key]=week;latest.goals.month[ranges.month.key]=month;},'週間・月間目標を保存しました。'))goalsDialog.close();else $('#goals-status').textContent=status.textContent;
});
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){read();render();if(!resultsDirty)fillResults();}});
window.addEventListener('beforeunload',event=>{if(resultsDirty||appointmentDirty){event.preventDefault();event.returnValue='';}});
const dayDialog=$('#day-log-dialog');
$('#day-log-close').addEventListener('click',()=>dayDialog.close());
dayDialog.addEventListener('close',()=>$('#calendar-days').querySelector(`[data-date="${selected}"]`)?.focus());
read();fillResults();render();$('#performance').hidden=false;
