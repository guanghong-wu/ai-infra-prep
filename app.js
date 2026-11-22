'use strict';

const tracks = { ai:'AI 编程与选择', algo:'ACM 算法', infra:'Infra 专项' };
const priorityOrder = { '必刷':0,'高频':1,'拓展':2 };
const trackOrder = { ai:0,algo:1,infra:2 };
const questions = window.QUESTION_BANK.slice().sort((a,b)=>priorityOrder[a.priority]-priorityOrder[b.priority] || trackOrder[a.track]-trackOrder[b.track] || a.id.localeCompare(b.id));
const byId = new Map(questions.map(q=>[q.id,q]));
const panel = document.querySelector('#panel');
const storageKey = 'huawei-infra-prep-v1';
let progress = {};
try { progress = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
let tab = 'study', track = 'all', keyword = '', type = 'all', priority = 'all', page = 0;
let active = null, revealed = false, submitted = false, selection = [];
let mock = null, timerHandle = null, savedFilter = 'all';
const pageSize = 18;
const esc = (value='') => String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const badge = (value, kind='') => '<span class="badge '+kind+'">'+esc(value)+'</span>';
const btn = (label,action,cls='secondary',extra='') => '<button type="button" class="'+cls+'" data-action="'+action+'" '+extra+'>'+esc(label)+'</button>';
const record = id => progress[id] || {};
const goPanel = () => panel.scrollIntoView({block:'start',behavior:'instant'});
function stats() {
  const marks = questions.map(q=>record(q.id));
  document.querySelector('#total').textContent = questions.length;
  document.querySelector('#known').textContent = marks.filter(m=>m.grade==='known').length;
  document.querySelector('#review').textContent = marks.filter(m=>m.grade==='review').length;
  document.querySelector('#starred').textContent = marks.filter(m=>m.star).length;
}
function update(id, patch) {
  progress[id] = {...record(id), ...patch};
  try { localStorage.setItem(storageKey,JSON.stringify(progress)); } catch {}
  stats();
}
function switchTab(next) {
  if (!['study','mock','saved','sources'].includes(next)) next='study';
  if (next!==tab) { active=null; page=0; }
  tab=next;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const on=button.dataset.tab===tab;
    button.classList.toggle('active',on);
    on ? button.setAttribute('aria-current','page') : button.removeAttribute('aria-current');
  }
  render();
}
function filtered() {
  if (tab==='saved') return questions.filter(q=>{
    const r=record(q.id);
    if (savedFilter==='review') return r.grade==='review';
    if (savedFilter==='star') return r.star;
    if (savedFilter==='known') return r.grade==='known';
    return r.star || r.grade==='review';
  });
  const tokens=keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return questions.filter(q=>{
    if (track!=='all' && q.track!==track || type!=='all' && q.type!==type || priority!=='all' && q.priority!==priority) return false;
    const search=[q.title,q.topic,q.question,q.answer,q.level].join(' ').toLowerCase();
    return tokens.every(s=>search.includes(s));
  });
}
function tags(q) {
  const r=record(q.id);
  return badge(q.type)+badge(q.topic)+badge(q.level)+(q.priority==='必刷'?badge('必刷','hot'):q.priority==='高频'?badge('高频'):'')+(r.grade==='known'?badge('已掌握','good'):r.grade==='review'?badge('待复习','retry'):'')+(r.star?badge('已收藏','hot'):'');
}
function list() {
  const data=filtered(), pages=Math.max(1,Math.ceil(data.length/pageSize));
  page=Math.min(page,pages-1);
  const start=page*pageSize;
  return '<p class="count" aria-live="polite">'+data.length+' 道题'+(data.length?' · 显示 '+(start+1)+'–'+Math.min(start+pageSize,data.length):'')+'</p>'+
    (data.length?'<div class="q-list">'+data.slice(start,start+pageSize).map(q=>'<button type="button" class="row" data-action="read" data-id="'+q.id+'"><div class="meta">'+tags(q)+'</div><h3>'+esc(q.title)+'</h3></button>').join('')+'</div>':'<div class="empty">'+(tab==='saved'?'这里还没有记录。打开一道题，收藏或标记后即可在这里查看。':'没有符合条件的题。试试缩短关键词或放宽筛选。')+'</div>')+
    (pages>1?'<div class="pager">'+btn('上一页','page-prev','secondary',page===0?'disabled':'')+'<span>'+(page+1)+' / '+pages+'</span>'+btn('下一页','page-next','secondary',page+1===pages?'disabled':'')+'</div>':'');
}
function pill(label,action,value,selected) {
  return btn(label,action,'chipbtn','data-value="'+value+'" aria-pressed="'+(selected===value)+'"');
}
function option(label,value,current) {
  return '<option value="'+value+'"'+(value===current?' selected':'')+'>'+esc(label)+'</option>';
}
function study() {
  return '<div class="toolbar"><h2 class="section-title">按题型刷</h2><p class="explainer">有「AI 开发」标签的邀约优先练 AI 编程和选择题；软件开发卷重点练 ACM。具体要求看考试通知。</p><div class="chips">'+pill('全部','track','all',track)+Object.entries(tracks).map(([value,label])=>pill(label,'track',value,track)).join('')+'</div>'+
    '<div class="filters"><input type="search" id="search" aria-label="搜索题库" placeholder="搜索 KNN、背包、KV Cache…" value="'+esc(keyword)+'"><select id="type" aria-label="题型">'+option('全部题型','all',type)+['选择','编程','问答','排障'].map(x=>option(x,x,type)).join('')+'</select><select id="priority" aria-label="优先级">'+option('全部优先级','all',priority)+['必刷','高频','拓展'].map(x=>option(x,x,priority)).join('')+'</select></div></div><div id="results">'+list()+'</div>';
}
function saved() {
  return '<div class="toolbar"><h2 class="section-title">复习清单</h2><p class="explainer">把卡住的题标成待复习，下一轮先做这些。</p><div class="chips">'+pill('待复习与收藏','saved-filter','all',savedFilter)+pill('待复习','saved-filter','review',savedFilter)+pill('收藏','saved-filter','star',savedFilter)+pill('已掌握','saved-filter','known',savedFilter)+'</div></div><div id="results">'+list()+'</div>';
}
function commonReader(q, mode) {
  const mark=record(q.id), mockQuestion=mode==='mock'&&!mock.ended;
  const chosen=mode==='mock'?(mock.answers[q.id]||[]):selection;
  const showAnswer=mode==='mock'?mock.ended:revealed;
  const choices=q.choices ? '<div class="opts" role="group" aria-label="'+(q.keys.length>1?'多选题选项':'单选题选项')+'">'+q.choices.map((c,i)=>'<label class="opt"><input type="'+(q.keys.length>1?'checkbox':'radio')+'" name="answer" value="'+i+'" '+(chosen.includes(i)?'checked ':'')+((submitted||mode==='mock'&&mock.ended)?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'. '+esc(c)+'</span></label>').join('')+'</div>' : '';
  const answers=q.keys?.map(i=>String.fromCharCode(65+i)).join('、');
  const isCorrect=Boolean(q.keys && chosen.length===q.keys.length && q.keys.every(i=>chosen.includes(i)));
  const judged=q.choices && (mode==='mock'?mock.ended:submitted);
  return '<article class="reader"><div class="meta">'+tags(q)+(q.keys?.length>1?badge('多选'):'')+'</div><h2 tabindex="-1" id="question-title">'+esc(q.title)+'</h2><p class="question-text">'+esc(q.question)+'</p>'+
    (q.example?'<h3>示例</h3><pre class="sample">'+esc(q.example)+'</pre>':'')+choices+
    (mockQuestion && !q.choices?'<p class="footnote">请另开编辑器实现，交卷后对照解析。这道编程题不参与自动计分。</p>':'')+
    (!mockQuestion&&!showAnswer?(q.choices?btn('提交选项','check','primary')+' ':'')+btn('看解析','reveal',q.choices?'secondary':'primary'):'')+
    (showAnswer&&!mockQuestion?'<section class="answer"><h3>参考解析'+(answers?' · '+answers:'')+(judged?(isCorrect?'（答对）':'（待复习）'):'')+'</h3><p class="answer-text">'+esc(q.answer)+'</p>'+(q.complexity?'<h3>复杂度</h3><p class="answer-text">'+esc(q.complexity)+'</p>':'')+(q.traps?'<h3>易错点</h3><p class="answer-text">'+esc(q.traps)+'</p>':'')+(q.code?'<details><summary>展开 Python 参考代码</summary><pre class="code"><code>'+esc(q.code)+'</code></pre></details>':'')+'</section>':'')+
    '<div id="choice-feedback" class="footnote" role="status"></div>'+
    (!mockQuestion?'<div class="actions">'+btn(mark.star?'已收藏':'收藏','star','grade','aria-pressed="'+Boolean(mark.star)+'"')+btn('标为待复习','grade-review','grade','aria-pressed="'+(mark.grade==='review')+'"')+btn('已掌握','grade-known','grade','aria-pressed="'+(mark.grade==='known')+'"')+'</div>':'')+
    '</article>';
}
function reader() {
  const q=byId.get(active), data=filtered(), pos=data.findIndex(x=>x.id===active);
  return '<div class="reader-nav">'+btn('返回列表','back','minor')+'<span class="footnote">'+(pos<0?tracks[q.track]:(pos+1)+' / '+data.length)+'</span></div>'+commonReader(q,'study')+
    '<div class="reader-nav">'+btn('上一题','prev','secondary',pos<=0?'disabled':'')+btn('下一题','next','secondary',pos<0||pos+1>=data.length?'disabled':'')+'</div>';
}
const aiMock=['mc001','mc003','mc005','mc007','mc010','mc011','mc013','mc016','mc018','mc020','mc022','mc023','mc025','mc027','mc030','mc034','mc036','mc038','mc039','mc040','aic001','aic017'];
const algoMock=['alg001','alg034','alg024'];
function mockUI() {
  if (!mock) return '<div class="mock-grid"><section class="mockbox"><div class="meta">'+badge('AI 开发','hot')+'</div><h3>AI 机考模拟</h3><p>20 道选择 + 2 道编程。限时 150 分钟。选择题自动判分，编程题交卷后对照解析。</p>'+btn('开始 AI 模拟','mock-ai','primary')+'</section><section class="mockbox"><div class="meta">'+badge('软件开发')+'</div><h3>ACM 机考模拟</h3><p>3 道编程。限时 150 分钟，练习输入输出和边界处理。</p>'+btn('开始 ACM 模拟','mock-algo','secondary')+'</section></div><p class="footnote">站内原创模拟卷。实际题数、时间与是否允许三方库请看通知。</p>';
  const q=byId.get(mock.ids[mock.index]);
  const choices=mock.ids.map(id=>byId.get(id)).filter(q=>q.choices);
  const correct=choices.filter(q=>{
    const a=mock.answers[q.id]||[];
    return a.length===q.keys.length&&q.keys.every(i=>a.includes(i));
  }).length;
  const done=choices.filter(q=>mock.answers[q.id]?.length).length;
  const points=choices.reduce((total,q)=>{
    const a=mock.answers[q.id]||[];
    return total+(a.length===q.keys.length&&q.keys.every(i=>a.includes(i))?(q.keys.length>1?12:6):0);
  },0);
  return '<div class="toolbar"><div class="reader-nav"><h2 class="section-title">'+(mock.kind==='ai'?'AI 机考模拟':'ACM 机考模拟')+'</h2>'+
    (mock.ended?btn('返回模拟入口','mock-close','minor'):'<span id="timer" role="timer" class="badge hot">'+remaining()+'</span>'+btn('交卷','mock-finish','primary'))+
    '</div><p class="scores">'+(mock.ended?(choices.length?'选择题 '+correct+' / '+choices.length+' 正确 · '+points+' / 150 分 · 可逐题看解析':'已交卷 · 可逐题看解析'):'第 '+(mock.index+1)+' / '+mock.ids.length+' 题'+(choices.length?' · 选择题已作答 '+done+' / '+choices.length:''))+'</p>'+
    (mock.ended?'':'<p class="footnote">本轮保留在当前页面。刷新页面会结束本轮模拟。</p>')+'</div>'+
    commonReader(q,'mock')+'<div class="reader-nav">'+btn('上一题','mock-prev','secondary',!mock.index?'disabled':'')+btn('下一题','mock-next','secondary',mock.index+1===mock.ids.length?'disabled':'')+'</div>';
}
function remaining() {
  const sec=Math.max(0,Math.ceil((mock.end-Date.now())/1000));
  return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
}
function endMock() {
  mock.ended=true; mock.index=0; revealed=true; submitted=false;
  for(const id of mock.ids) {
    const q=byId.get(id);
    if(!q.choices) continue;
    const a=mock.answers[id]||[];
    if(a.length!==q.keys.length||!q.keys.every(i=>a.includes(i))) update(id,{grade:'review'});
  }
}
function sources() {
  const data=window.SOURCE_BANK;
  return '<section class="source-intro"><h2 class="section-title">题库依据与考试范围</h2><p class="explainer">华为公开招聘资料确认部分研发岗位设上机考试，未公布所有 AI Infra 批次的题库。本题库是据公开回顾和官方技术资料原创的同考点练习。校招 AI 开发、校招软件开发、OD 和技术面请分开看。</p><p class="footnote">建议优先看牛客同岗位或同批次，B 站看拆题，GitHub 扩充练习。小红书列出站内检索入口。</p></section><div class="source-list">'+data.map(s=>'<a class="source-card" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+badge(s.platform,'hot')+' '+badge(s.kind)+'<strong>'+esc(s.title)+'</strong><p>'+esc(s.note)+'</p></a>').join('')+'</div>';
}
function render(focus=false) {
  panel.innerHTML=tab==='sources'?sources():tab==='mock'?mockUI():active?reader():tab==='saved'?saved():study();
  if(focus) document.querySelector('#question-title')?.focus({preventScroll:true});
}
function openQuestion(id) {
  active=id; revealed=false; submitted=false; selection=[]; render(true); goPanel();
}
function beginMock(kind) {
  mock={kind,ids:(kind==='ai'?aiMock:algoMock).filter(id=>byId.has(id)),index:0,answers:{},ended:false,end:Date.now()+150*60000};
  revealed=false; submitted=false; render(true); goPanel();
  if(timerHandle) clearInterval(timerHandle);
  timerHandle=setInterval(()=>{
    if(!mock || mock.ended) { clearInterval(timerHandle); timerHandle=null; return; }
    if(Date.now()>=mock.end){endMock(); if(tab==='mock')render(); return;}
    const timer=document.querySelector('#timer'); if(timer)timer.textContent=remaining();
  },1000);
}
for(const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click',()=>{switchTab(b.dataset.tab); goPanel();});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();active=null;switchTab('study');goPanel();});
document.querySelector('#start').addEventListener('click',()=>{active=null;track='ai';priority='必刷';keyword='';type='all';page=0;switchTab('study');goPanel();});
panel.addEventListener('input',event=>{
  if(event.target.id==='search'){keyword=event.target.value;page=0;document.querySelector('#results').innerHTML=list();}
});
panel.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='type'||el.id==='priority'){if(el.id==='type') type=el.value;else priority=el.value;page=0;document.querySelector('#results').innerHTML=list();}
  if(el.name==='answer'){
    const checked=[...panel.querySelectorAll('input[name=answer]:checked')].map(input=>Number(input.value));
    if(tab==='mock'&&!mock.ended){mock.answers[mock.ids[mock.index]]=checked;
      const choiceIds=mock.ids.filter(id=>byId.get(id).choices);
      panel.querySelector('.scores').textContent='第 '+(mock.index+1)+' / '+mock.ids.length+' 题 · 选择题已作答 '+choiceIds.filter(id=>mock.answers[id]?.length).length+' / '+choiceIds.length;
    }else selection=checked;
  }
});
panel.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');
  if(!b)return;
  const action=b.dataset.action;
  if(action==='track'||action==='saved-filter'){if(action==='track')track=b.dataset.value;else savedFilter=b.dataset.value;page=0;render();return;}
  if(action.startsWith('page-')){page+=action==='page-next'?1:-1;document.querySelector('#results').innerHTML=list();goPanel();return;}
  if(action==='read'){openQuestion(b.dataset.id);return;}
  if(action==='back'){active=null;render();goPanel();return;}
  if(action==='prev'||action==='next'){const data=filtered();const id=data[data.findIndex(q=>q.id===active)+(action==='next'?1:-1)]?.id;if(id)openQuestion(id);return;}
  if(action==='mock-ai'||action==='mock-algo'){beginMock(action.slice(5));return;}
  if(action==='mock-close'){mock=null;render();goPanel();return;}
  if(action==='mock-finish'){endMock(); render(true);goPanel();return;}
  if(action==='mock-prev'||action==='mock-next'){mock.index+=action==='mock-next'?1:-1;revealed=mock.ended;submitted=false;render(true);goPanel();return;}
  const id=tab==='mock'?mock?.ids[mock.index]:active;
  if(!id)return;
  if(action==='reveal'){revealed=true;render();return;}
  if(action==='check'){
    if(!selection.length){panel.querySelector('#choice-feedback').textContent='请先选择选项。';return;}
    const q=byId.get(id);
    submitted=true;revealed=true;
    if(selection.length!==q.keys.length||!q.keys.every(i=>selection.includes(i)))update(id,{grade:'review'});
    render();return;
  }
  if(action==='star'){update(id,{star:!record(id).star});render();return;}
  if(action.startsWith('grade-')){const grade=action.slice(6);update(id,{grade:record(id).grade===grade?null:grade});render();}
});
stats();
render();
