
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const API = String(window.REHUB_API || '').replace(/\/$/, '');
const SOURCE_MAX = 8 * 1024 * 1024;
const PREVIEW_MAX = 600 * 1024;
const seededOfficials = [
  { slot:'okb', faction:'ОКБ', title:'ОКБ г. Мирный' },
  { slot:'uvd', faction:'УВД', title:'УВД' },
  { slot:'gibdd', faction:'ГИБДД', title:'ГИБДД' },
  { slot:'army', faction:'Армия', title:'Армия' }
];
let officialCatalog = [];
let adminKey = sessionStorage.getItem('rehub_admin_key') || '';
let currentSlot = 'okb';
let creatingOfficial = false;
let currentMeta = null;
let compressedPreview = null;
let preparedOfficialConfig = null;
let moderationData = { pending:[], approved:[], rejected:[] };
let moderationTab = 'pending';
let selectedSubmission = null;

function toast(text) {
  const el = $('#hubToast'); if (!el) return;
  el.textContent = text; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}
function headers() { return { 'Authorization': `Bearer ${adminKey}`, 'Accept':'application/json' }; }
async function api(path, options={}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  let data = null; try { data = await response.json(); } catch (_) {}
  if (!response.ok) { const err = new Error(data?.error || `HTTP ${response.status}`); err.status=response.status; err.detail=data?.detail; throw err; }
  return data;
}

const reviewFileCache = new Map();
const reviewObjectUrlCache = new Map();

function reviewFilePath(type) {
  if (!selectedSubmission?.id || !selectedSubmission?.status) return '';
  const status = encodeURIComponent(selectedSubmission.status);
  return `/api/admin/submissions/${encodeURIComponent(selectedSubmission.id)}/file?status=${status}&type=${encodeURIComponent(type)}`;
}

async function fetchAdminFile(type, timeoutMs = 12000) {
  const path = reviewFilePath(type);
  if (!path) throw new Error('Публикация не выбрана.');

  const cacheKey = `${selectedSubmission.status}:${selectedSubmission.id}:${type}`;
  if (reviewFileCache.has(cacheKey)) return reviewFileCache.get(cacheKey);

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API}${path}`, {
        method: 'GET',
        headers: headers(),
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          message = body?.detail || body?.error || message;
        } catch (_) {}
        throw new Error(message);
      }
      return await response.blob();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Превышено время ожидания ответа. Попробуй ещё раз.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })();

  reviewFileCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    reviewFileCache.delete(cacheKey);
    throw error;
  }
}

async function getReviewObjectUrl(type) {
  const cacheKey = `${selectedSubmission.status}:${selectedSubmission.id}:${type}`;
  if (reviewObjectUrlCache.has(cacheKey)) return reviewObjectUrlCache.get(cacheKey);
  const blob = await fetchAdminFile(type);
  const url = URL.createObjectURL(blob);
  reviewObjectUrlCache.set(cacheKey, url);
  return url;
}

function asciiLower(byte) {
  return byte >= 65 && byte <= 90 ? byte + 32 : byte;
}

function findAscii(bytes, needle, from = 0) {
  const pattern = [...needle].map(ch => ch.charCodeAt(0));
  outer: for (let i = Math.max(0, from); i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (asciiLower(bytes[i + j]) !== asciiLower(pattern[j])) continue outer;
    }
    return i;
  }
  return -1;
}

function countBindEntries(bytes) {
  let count = 0, at = 0;
  while ((at = findAscii(bytes, '<bind', at)) !== -1) {
    const next = bytes[at + 5];
    if (next !== 115 && next !== 83) count++;
    at += 5;
  }
  return count;
}

async function extractBindsFile(file) {
  if (!file?.name?.toLowerCase().endsWith('.xml')) throw new Error('Нужен XML-конфиг.');
  if (file.size > 1024 * 1024) throw new Error('XML не должен быть больше 1 МБ.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = findAscii(bytes, '<binds');
  if (start < 0) throw new Error('В XML не найден блок <binds>…</binds>.');
  const openEnd = bytes.indexOf(62, start);
  if (openEnd < 0) throw new Error('Блок <binds> повреждён.');
  const close = findAscii(bytes, '</binds>', openEnd + 1);
  if (close < 0) throw new Error('В XML не найден закрывающий </binds>.');
  const block = bytes.slice(start, close + 8);
  const bindCount = countBindEntries(block);
  if (!bindCount) throw new Error('В блоке <binds> нет ни одного bind.');
  return {
    file: new File([block], file.name, { type:'application/xml' }),
    bindCount,
    exportedBytes: block.length
  };
}

const PROGRAM_SELECT_MS = 330;
const programSelectTimers = new WeakMap();
function setProgramSelectOpen(wrap, open){if(!wrap)return;const old=programSelectTimers.get(wrap);if(old)clearTimeout(old);wrap.classList.add('animating');wrap.classList.toggle('open',open);const timer=setTimeout(()=>{wrap.classList.remove('animating');programSelectTimers.delete(wrap);},PROGRAM_SELECT_MS);programSelectTimers.set(wrap,timer);}
function closeProgramSelects(except=null){$$('.program-select.open').forEach(w=>{if(w!==except)setProgramSelectOpen(w,false);});}
function refreshProgramSelect(select){if(!select)return;let wrap=select.nextElementSibling;if(!wrap||!wrap.classList.contains('program-select')){wrap=document.createElement('div');wrap.className='program-select';wrap.innerHTML='<button type="button" class="program-select-trigger interactive"><span class="program-select-value"></span><span class="program-select-arrow" aria-hidden="true"></span></button><div class="program-select-dropdown"><div class="program-select-options"></div></div>';select.classList.add('animated-native-select');select.insertAdjacentElement('afterend',wrap);wrap.querySelector('.program-select-trigger').addEventListener('click',e=>{e.stopPropagation();const will=!wrap.classList.contains('open');closeProgramSelects(wrap);setProgramSelectOpen(wrap,will);});}const value=wrap.querySelector('.program-select-value'),options=wrap.querySelector('.program-select-options');options.innerHTML='';[...select.options].forEach((option,index)=>{const item=document.createElement('div');item.className='program-select-option';if(option.disabled)item.classList.add('disabled');if(option.value===select.value)item.classList.add('selected');item.textContent=option.textContent;item.style.setProperty('--option-index',index);item.addEventListener('click',e=>{e.stopPropagation();if(option.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refreshProgramSelect(select);setProgramSelectOpen(wrap,false);});options.appendChild(item);});const selected=select.options[select.selectedIndex]||select.options[0];value.textContent=selected?selected.textContent:'Выберите значение';bindAdminCursorHover();}
function initProgramSelects(root=document){$$('select[data-program-select]',root).forEach(refreshProgramSelect);}
document.addEventListener('click',()=>closeProgramSelects());

let adminHoverBound = new WeakSet();

function bindAdminCursorHover() {
  $$('.interactive, a, button, input, textarea, select, label').forEach(el => {
    if (adminHoverBound.has(el)) return;
    adminHoverBound.add(el);
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

function initCursor() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  const glow = $('#cursorGlow');
  if (!dot || !ring || !glow) return;

  let mouseX = innerWidth / 2;
  let mouseY = innerHeight / 2;
  let dotX = mouseX;
  let dotY = mouseY;
  let ringX = mouseX;
  let ringY = mouseY;
  let glowX = mouseX;
  let glowY = mouseY;

  addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive: true });

  addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-active', 'cursor-hover');
  });

  addEventListener('mouseenter', () => {
    document.body.classList.add('cursor-active');
  });

  const frame = () => {
    dotX += (mouseX - dotX) * .46;
    dotY += (mouseY - dotY) * .46;
    ringX += (mouseX - ringX) * .135;
    ringY += (mouseY - ringY) * .135;
    glowX += (mouseX - glowX) * .045;
    glowY += (mouseY - glowY) * .045;

    dot.style.transform = `translate3d(${dotX}px,${dotY}px,0)`;
    ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
    glow.style.transform = `translate3d(${glowX}px,${glowY}px,0)`;

    requestAnimationFrame(frame);
  };

  frame();
  bindAdminCursorHover();
}

function initCustomScrollbar() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  document.querySelector('.site-scrollbar')?.remove();

  const scroller = document.scrollingElement || document.documentElement;
  const track = document.createElement('div');
  track.className = 'site-scrollbar';
  track.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'site-scrollbar-thumb';
  track.appendChild(thumb);
  document.body.appendChild(track);

  let dragging = false;
  let pointerId = null;
  let grabOffset = 0;
  let raf = 0;

  const getMetrics = () => {
    const viewport = Math.max(1, window.innerHeight);
    const total = Math.max(scroller.scrollHeight, document.body.scrollHeight, viewport);
    const trackHeight = Math.max(1, track.clientHeight);
    const thumbHeight = Math.max(48, Math.min(trackHeight, trackHeight * (viewport / total)));
    const maxScroll = Math.max(0, total - viewport);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    return { thumbHeight, maxScroll, maxThumbTop };
  };

  const syncNow = () => {
    raf = 0;
    const { thumbHeight, maxScroll, maxThumbTop } = getMetrics();
    const current = scroller.scrollTop || window.scrollY || 0;
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, current / maxScroll)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0,${maxThumbTop * ratio}px,0)`;
    track.classList.toggle('hidden', maxScroll <= 1);
  };

  const sync = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncNow);
  };
  window.syncAdminScrollbar = sync;

  const setScrollFromPointer = clientY => {
    const rect = track.getBoundingClientRect();
    const { maxScroll, maxThumbTop } = getMetrics();
    if (maxScroll <= 0 || maxThumbTop <= 0) return;
    const thumbTop = Math.max(0, Math.min(maxThumbTop, clientY - rect.top - grabOffset));
    scroller.scrollTop = (thumbTop / maxThumbTop) * maxScroll;
    sync();
  };

  thumb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    window.cancelPageInertia?.();
    dragging = true;
    pointerId = e.pointerId;
    grabOffset = e.clientY - thumb.getBoundingClientRect().top;
    thumb.classList.add('dragging');
    try { track.setPointerCapture(pointerId); } catch (_) {}
  });

  track.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target === thumb) return;
    e.preventDefault();
    e.stopPropagation();
    window.cancelPageInertia?.();
    const { thumbHeight } = getMetrics();
    grabOffset = thumbHeight / 2;
    dragging = true;
    pointerId = e.pointerId;
    thumb.classList.add('dragging');
    try { track.setPointerCapture(pointerId); } catch (_) {}
    setScrollFromPointer(e.clientY);
  });

  track.addEventListener('pointermove', e => {
    if (!dragging || (pointerId !== null && e.pointerId !== pointerId)) return;
    e.preventDefault();
    setScrollFromPointer(e.clientY);
  }, { passive: false });

  const finish = e => {
    if (!dragging) return;
    if (pointerId !== null && e?.pointerId != null && e.pointerId !== pointerId) return;
    dragging = false;
    thumb.classList.remove('dragging');
    try { if (pointerId !== null) track.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    sync();
  };

  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', finish);
  window.addEventListener('blur', finish);
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(sync);
    ro.observe(scroller);
    ro.observe(document.body);
  }

  const mo = new MutationObserver(sync);
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class', 'style']
  });

  requestAnimationFrame(sync);
}


let adminRevealObserver;
const adminRevealBound = new WeakSet();
function observeAdminReveals(root=document) {
  const items=$$('.reveal',root).filter(el=>!adminRevealBound.has(el));
  items.forEach((el,index)=>{adminRevealBound.add(el);el.style.setProperty('--reveal-delay',`${Math.min(index*42,190)}ms`);});
  if(!items.length)return;
  if(!('IntersectionObserver' in window)){items.forEach(el=>el.classList.add('visible'));return;}
  if(!adminRevealObserver){adminRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add('visible');adminRevealObserver.unobserve(entry.target);}),{threshold:.08,rootMargin:'0px 0px -5% 0px'});}
  items.forEach(el=>adminRevealObserver.observe(el));
}

function initAdminHeader() {
  const topbar = $('.admin-topbar');
  const sync = () => topbar?.classList.toggle('scrolled', scrollY > 18);
  sync();
  addEventListener('scroll', sync, { passive:true });
}

function initAdminDragScroll() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;
  let dragging=false,moved=false,startY=0,startScroll=0,lastY=0,lastTime=0,lastMoveTime=0,velocity=0,inertiaFrame=0,suppressClick=false;
  const root=document.documentElement;
  const interactiveSelector='a,button,input,textarea,select,[contenteditable="true"],pre,code,.site-scrollbar-thumb,.admin-review-modal,.admin-community-card,.admin-slot,.upload-drop';
  const maxScroll=()=>Math.max(0,root.scrollHeight-innerHeight);
  const setState=enabled=>{root.classList.toggle('page-kinetic',enabled);document.body.classList.toggle('page-kinetic',enabled);};
  const cancel=()=>{if(inertiaFrame)cancelAnimationFrame(inertiaFrame);inertiaFrame=0;velocity=0;if(!dragging)setState(false);};
  window.cancelPageInertia=cancel;
  const begin=()=>{if(inertiaFrame)cancelAnimationFrame(inertiaFrame);const idle=performance.now()-lastMoveTime;if(idle>85)velocity*=Math.max(0,1-(idle-85)/150);velocity=Math.max(-2.7,Math.min(2.7,velocity*1.22));if(Math.abs(velocity)<.055){setState(false);return;}setState(true);let prev=performance.now();const tick=now=>{const dt=Math.min(32,Math.max(1,now-prev));prev=now;const limit=maxScroll(),before=scrollY,next=Math.max(0,Math.min(limit,before+velocity*dt));scrollTo(0,next);velocity*=Math.pow(.946,dt/16.667);if(next<=0||next>=limit)velocity*=.34;if(Math.abs(velocity)>.014)inertiaFrame=requestAnimationFrame(tick);else{inertiaFrame=0;velocity=0;setState(false);}};inertiaFrame=requestAnimationFrame(tick);};
  document.addEventListener('mousedown',e=>{if(e.button!==0||e.target.closest(interactiveSelector)||document.body.classList.contains('admin-review-open'))return;cancel();dragging=true;moved=false;suppressClick=false;startY=lastY=e.clientY;startScroll=scrollY;lastTime=lastMoveTime=performance.now();velocity=0;root.classList.add('page-dragging');document.body.classList.add('page-dragging');setState(true);});
  addEventListener('mousemove',e=>{if(!dragging)return;const now=performance.now(),dy=e.clientY-startY;if(Math.abs(dy)>3)moved=true;scrollTo(0,Math.max(0,Math.min(maxScroll(),startScroll-dy)));const dt=Math.max(1,now-lastTime),instant=(lastY-e.clientY)/dt;velocity=velocity*.58+instant*.42;lastY=e.clientY;lastTime=now;lastMoveTime=now;e.preventDefault();},{passive:false});
  const finish=()=>{if(!dragging)return;dragging=false;root.classList.remove('page-dragging');document.body.classList.remove('page-dragging');if(moved){suppressClick=true;begin();setTimeout(()=>suppressClick=false,110);}else setState(false);};
  addEventListener('mouseup',finish);addEventListener('blur',finish);
  document.addEventListener('click',e=>{if(!suppressClick)return;e.preventDefault();e.stopPropagation();suppressClick=false;},true);
  const ownScroller=(target,dy)=>{let node=target instanceof Element?target:null;while(node&&node!==document.body&&node!==root){const st=getComputedStyle(node),scrollable=(st.overflowY==='auto'||st.overflowY==='scroll')&&node.scrollHeight>node.clientHeight+1;if(scrollable){const up=node.scrollTop>0,down=node.scrollTop+node.clientHeight<node.scrollHeight-1;if((dy<0&&up)||(dy>0&&down))return true;}node=node.parentElement;}return false;};
  const norm=e=>{let d=e.deltaY;if(e.deltaMode===1)d*=16;else if(e.deltaMode===2)d*=innerHeight;return Math.max(-190,Math.min(190,d));};
  const wheelStart=()=>{if(inertiaFrame)return;setState(true);let prev=performance.now();const tick=now=>{const dt=Math.min(32,Math.max(1,now-prev));prev=now;const limit=maxScroll(),before=scrollY,next=Math.max(0,Math.min(limit,before+velocity*dt));scrollTo(0,next);velocity*=Math.pow(.885,dt/16.667);if(next<=0||next>=limit)velocity*=.28;if(Math.abs(velocity)>.012)inertiaFrame=requestAnimationFrame(tick);else{inertiaFrame=0;velocity=0;setState(false);}};inertiaFrame=requestAnimationFrame(tick);};
  addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey||dragging||document.body.classList.contains('admin-review-open'))return;if(Math.abs(e.deltaY)<Math.abs(e.deltaX)||ownScroller(e.target,e.deltaY))return;e.preventDefault();velocity+=norm(e)*.0078;velocity=Math.max(-3.4,Math.min(3.4,velocity));wheelStart();},{passive:false});
  addEventListener('keydown',cancel);
}

function canvasBlob(canvas,q){return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('Не удалось сжать изображение')),'image/webp',q));}
async function compressPreview(file) {
  if(!file) return null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Превью должно быть JPG, PNG или WebP.');
  if(file.size>SOURCE_MAX) throw new Error('Исходное изображение не должно быть больше 8 МБ.');
  const bmp=await createImageBitmap(file); const scale=Math.min(1,1280/bmp.width,720/bmp.height); let w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false}); let blob=null;
  for(let pass=0;pass<4;pass++){canvas.width=w;canvas.height=h;ctx.fillStyle='#101017';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);for(const q of [.86,.78,.70,.62,.54]){blob=await canvasBlob(canvas,q);if(blob.size<=PREVIEW_MAX)break;}if(blob&&blob.size<=PREVIEW_MAX)break;w=Math.max(640,Math.round(w*.86));h=Math.max(360,Math.round(h*.86));}
  bmp.close?.(); if(!blob||blob.size>PREVIEW_MAX) throw new Error('Не удалось ужать превью до 600 КБ.');
  return new File([blob],'preview.webp',{type:'image/webp'});
}
function resetFiles() {
  $('#adminConfigFile').value=''; $('#adminPreviewFile').value=''; compressedPreview=null; preparedOfficialConfig=null;
  $('#adminConfigTitle').textContent=currentMeta?'Оставить текущий XML':'Выбрать XML-конфиг';
  $('#adminConfigMeta').textContent=currentMeta?'Выбери файл только если нужно заменить XML':'Для первой публикации обязателен · экспортируется только <binds>';
  const img=$('#adminPreviewImage'),drop=$('#adminPreviewDrop');
  if(currentMeta?.preview_url){img.hidden=false;img.src=currentMeta.preview_url;drop.classList.add('has-preview');$('#adminPreviewTitle').textContent='Текущее превью';$('#adminPreviewMeta').textContent='Новый файл заменит его';}
  else {img.hidden=true;img.removeAttribute('src');drop.classList.remove('has-preview');$('#adminPreviewTitle').textContent='Добавить превью';$('#adminPreviewMeta').textContent='JPG / PNG / WebP · авто ≤ 600 КБ';}
}
function seededFor(slot){return seededOfficials.find(item=>item.slot===slot)||null;}
function slugifyFaction(value){
  const map={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  let out='';for(const ch of String(value||'').toLocaleLowerCase('ru-RU'))out+=map[ch]??ch;
  out=out.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42);
  return out||`faction-${Date.now().toString(36)}`;
}
function rebuildOfficialSelect(items){
  officialCatalog=Array.isArray(items)?items:[];
  const select=$('#officialFactionSelect');if(!select)return;
  const bySlot=new Map();seededOfficials.forEach(item=>bySlot.set(item.slot,{...item,published:false}));officialCatalog.forEach(item=>bySlot.set(item.slot,{slot:item.slot,faction:item.category||item.title||item.slot,title:item.title||item.category||item.slot,published:true}));
  select.innerHTML='';[...bySlot.values()].forEach(item=>{const option=document.createElement('option');option.value=item.slot;option.textContent=`${item.faction}${item.published?' · опубликован':' · не опубликован'}`;select.appendChild(option);});
  if(currentSlot&&[...select.options].some(o=>o.value===currentSlot))select.value=currentSlot;else if(select.options.length){currentSlot=select.options[0].value;select.value=currentSlot;}
  refreshProgramSelect(select);
}
function fillForm(meta, seed=seededFor(currentSlot)) {
  currentMeta=meta||null;creatingOfficial=false;
  const faction=meta?.category||seed?.faction||'';
  const title=meta?.title||seed?.title||faction||'';
  $('#officialFaction').value=faction;$('#officialTitle').value=title;$('#officialAuthor').value=meta?.author||'ReConfig Province';$('#officialDescription').value=meta?.description||'';
  $('#adminEditorTitle').textContent=title||'Официальный конфиг';$('#editorState').textContent=meta?`Опубликован · обновлён ${new Date(meta.updated_at||meta.created_at).toLocaleString('ru-RU')}`:'Новая публикация';
  $('#officialSubmit').textContent=meta?'Обновить официальный конфиг':'Опубликовать официальный';$('#adminNoticeText').textContent=meta?'Поля без нового XML или превью сохранят текущие файлы. Фракцию и название можно изменить.':'Официальная публикация сразу появится в закреплённой секции без модерации.';resetFiles();
}
function beginNewOfficial(){
  creatingOfficial=true;currentSlot='';currentMeta=null;$('#officialFaction').value='';$('#officialTitle').value='';$('#officialAuthor').value='ReConfig Province';$('#officialDescription').value='';$('#adminEditorTitle').textContent='Новая фракция';$('#editorState').textContent='Новая официальная публикация';$('#officialSubmit').textContent='Опубликовать официальный';$('#adminNoticeText').textContent='Укажи фракцию — ReHub создаст для неё отдельную закреплённую карточку.';resetFiles();$('#officialFaction').focus();
}
async function loadSlot(slot) {
  if(!slot)return;currentSlot=slot;creatingOfficial=false;$('#officialFactionSelect').value=slot;refreshProgramSelect($('#officialFactionSelect'));
  try { fillForm(await api(`/api/admin/official/${slot}`),seededFor(slot)); }
  catch(e){ if(e.status===404)fillForm(null,seededFor(slot)); else {toast(e.message);if(e.status===401)logout();} }
}
async function refreshStates() {
  try {const items=await api('/api/admin/official');rebuildOfficialSelect(items);return items;}
  catch(e){if(e.status===401)logout();else toast(e.message);return[];}
}
function showWorkspace() {
  $('#adminLogin').hidden=true;$('#adminWorkspace').hidden=false;
  initProgramSelects($('#adminWorkspace'));
  refreshStates().then(()=>{if(currentSlot)loadSlot(currentSlot);});
  loadCommunityModeration();bindAdminCursorHover();
  requestAnimationFrame(()=>{observeAdminReveals($('#adminWorkspace'));window.syncAdminScrollbar?.();});
}
function logout(){adminKey='';sessionStorage.removeItem('rehub_admin_key');$('#adminWorkspace').hidden=true;$('#adminLogin').hidden=false;$('#adminKeyInput').value='';bindAdminCursorHover();requestAnimationFrame(()=>window.syncAdminScrollbar?.());}
async function login(key){adminKey=key.trim();if(!adminKey)return;try{await api('/api/admin/official');sessionStorage.setItem('rehub_admin_key',adminKey);$('#loginError').textContent='';showWorkspace();}catch(e){adminKey='';$('#loginError').textContent=e.status===401?'Неверный ADMIN_KEY.':e.message;}}
function bindFiles(){
  $('#adminConfigFile').addEventListener('change',async()=>{
    const f=$('#adminConfigFile').files[0];if(!f)return;
    $('#adminConfigTitle').textContent='Извлекаю блок биндов…';
    $('#adminConfigMeta').textContent='На GitHub попадёт только <binds>…</binds>';
    try{
      const extracted=await extractBindsFile(f);
      preparedOfficialConfig=extracted.file;
      $('#adminConfigTitle').textContent=f.name;
      $('#adminConfigMeta').textContent=`${extracted.bindCount} биндов · экспорт ${Math.max(1,Math.round(extracted.exportedBytes/1024))} КБ · только <binds>`;
    }catch(e){
      preparedOfficialConfig=null;$('#adminConfigFile').value='';
      $('#adminConfigTitle').textContent=currentMeta?'Оставить текущий XML':'Выбрать XML-конфиг';
      $('#adminConfigMeta').textContent=currentMeta?'Выбери файл только если нужно заменить XML':'Для первой публикации обязателен · экспортируется только <binds>';
      toast(e.message||'Не удалось прочитать XML.');
    }
  });
  $('#adminPreviewFile').addEventListener('change',async()=>{const f=$('#adminPreviewFile').files[0];if(!f)return;try{compressedPreview=await compressPreview(f);const url=URL.createObjectURL(compressedPreview),img=$('#adminPreviewImage');img.hidden=false;img.src=url;$('#adminPreviewDrop').classList.add('has-preview');$('#adminPreviewTitle').textContent='Новое превью готово';$('#adminPreviewMeta').textContent=`${Math.round(compressedPreview.size/1024)} КБ · WebP`; }catch(e){$('#adminPreviewFile').value='';compressedPreview=null;toast(e.message);}});
}
async function submit(e){
  e.preventDefault(); if(!API){toast('Не указан REHUB_API.');return;}
  const faction=$('#officialFaction').value.trim();if(!faction){toast('Укажи фракцию.');return;}
  const xml=preparedOfficialConfig;if(!currentMeta&&!xml){toast('Для первой публикации выбери XML.');return;}
  let targetSlot=currentSlot;if(!targetSlot){targetSlot=slugifyFaction(faction);const used=new Set([...seededOfficials,...officialCatalog].map(x=>x.slot));let base=targetSlot,n=2;while(used.has(targetSlot))targetSlot=`${base}-${n++}`;}
  const fd=new FormData();fd.set('faction',faction);fd.set('title',$('#officialTitle').value);fd.set('author',$('#officialAuthor').value);fd.set('description',$('#officialDescription').value);if(xml)fd.set('config',xml,xml.name);if(compressedPreview)fd.set('preview',compressedPreview,'preview.webp');
  const form=$('#officialForm'),btn=$('#officialSubmit'),old=btn.textContent;form.classList.add('submitting');btn.disabled=true;btn.textContent=currentMeta?'Обновляю…':'Публикую…';
  try{const result=await api(`/api/admin/official/${targetSlot}`,{method:'POST',body:fd});currentSlot=result.item.slot;creatingOfficial=false;fillForm(result.item);await refreshStates();$('#officialFactionSelect').value=currentSlot;refreshProgramSelect($('#officialFactionSelect'));toast(result.mode==='updated'?'Официальный конфиг обновлён.':'Официальный конфиг опубликован.');}
  catch(e){toast(e.detail||e.message);}
  finally{form.classList.remove('submitting');btn.disabled=false;btn.textContent=currentMeta?'Обновить официальный конфиг':'Опубликовать официальный';}
}


function formatAdminDate(value){
  if(!value) return 'дата неизвестна';
  try{return new Date(value).toLocaleString('ru-RU');}catch(_){return String(value);}
}
function statusLabel(status){return status==='approved'?'Одобрено':status==='rejected'?'Отклонено':'На модерации';}
function moderationItems(){return moderationData[moderationTab]||[];}
async function loadCommunityModeration(){
  try{
    const data=await api('/api/admin/community');
    moderationData={pending:data?.pending||[],approved:data?.approved||[],rejected:data?.rejected||[]};
    $('#countPending').textContent=moderationData.pending.length;
    $('#countApproved').textContent=moderationData.approved.length;
    $('#countRejected').textContent=moderationData.rejected.length;
    renderCommunityModeration();
  }catch(e){if(e.status===401)logout();else toast(e.detail||e.message);}
}
function renderCommunityModeration(){
  const grid=$('#communityAdminGrid'), empty=$('#communityAdminEmpty'); if(!grid||!empty)return;
  grid.innerHTML=''; const items=moderationItems(); empty.hidden=items.length>0;
  items.forEach((item,index)=>{
    const card=document.createElement('button'); card.type='button'; card.className='admin-community-card interactive reveal';
    const thumb=document.createElement('div'); thumb.className='admin-community-thumb';
    if(item.preview_url){const img=document.createElement('img');img.src=item.preview_url;img.alt='';img.loading='lazy';thumb.appendChild(img);}else{const f=document.createElement('div');f.className='admin-community-thumb-empty';f.textContent='Без превью';thumb.appendChild(f);}
    const status=document.createElement('span');status.className=`admin-community-status ${moderationTab}`;status.textContent=statusLabel(moderationTab);thumb.appendChild(status);
    const copy=document.createElement('div');copy.className='admin-community-copy';
    const h=document.createElement('h3');h.textContent=item.title||'Без названия';
    const p=document.createElement('p');p.textContent=`${item.author||'Автор неизвестен'} · ${item.category||'Другое'}`;
    const s=document.createElement('small');s.textContent=formatAdminDate(item.approved_at||item.rejected_at||item.created_at);
    copy.append(h,p,s);card.append(thumb,copy);card.addEventListener('click',()=>openReview(item,moderationTab));grid.appendChild(card);
  });
  bindAdminCursorHover();
  observeAdminReveals(grid);
  requestAnimationFrame(()=>window.syncAdminScrollbar?.());
  setTimeout(()=>window.syncAdminScrollbar?.(),80);
}
function setModerationTab(status){
  moderationTab=status;let idx=0;$$('.admin-tab').forEach((b,i)=>{const active=b.dataset.status===status;b.classList.toggle('active',active);if(active)idx=i;});$('#moderationSegments')?.setAttribute('data-index',String(idx));renderCommunityModeration();
}

const reviewXmlCache = new Map();
let reviewMediaMode = 'cover';

function updateReviewViewButtons(mode) {
  let idx=0;$$('.admin-review-view').forEach((btn,i)=>{const active=btn.dataset.reviewView===mode;btn.classList.toggle('active',active);if(active)idx=i;});$('#reviewViewbar')?.setAttribute('data-index',String(idx));
}

async function loadReviewCode() {
  if (!selectedSubmission?.id) return;
  const code = $('#reviewCode');
  const codeText = $('#reviewCodeText');
  const loading = $('#reviewCodeLoading');
  if (!code || !codeText || !loading) return;

  code.hidden = true;
  loading.hidden = false;
  loading.textContent = 'Загружаю XML…';

  try {
    const blob = await fetchAdminFile('config');
    const text = await blob.text();
    codeText.textContent = text || 'XML-файл пуст.';
    code.hidden = false;
  } catch (error) {
    codeText.textContent = `Не удалось загрузить XML.\n${error?.message || error}`;
    code.hidden = false;
  } finally {
    loading.hidden = true;
    requestAnimationFrame(() => window.syncAdminScrollbar?.());
  }
}

async function loadReviewPreview() {
  const preview = $('#reviewPreview');
  const loading = $('#reviewPreviewLoading');
  if (!preview || !loading || !selectedSubmission) return;

  preview.querySelectorAll(':scope > img').forEach(node => node.remove());
  const empty = preview.querySelector(':scope > .admin-review-preview-empty');

  if (!selectedSubmission.preview_url) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = 'Без превью';
    }
    loading.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  loading.classList.remove('error');
  loading.textContent = 'Загружаю превью…';
  loading.hidden = false;

  try {
    const objectUrl = await getReviewObjectUrl('preview');
    // Карточка могла быть закрыта/переключена во время загрузки.
    if (!selectedSubmission) return;

    const img = document.createElement('img');
    img.alt = `Превью: ${selectedSubmission.title || 'публикация'}`;
    img.decoding = 'async';

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Превышено время загрузки изображения.')), 8000);
      img.onload = () => { clearTimeout(timer); resolve(); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Браузер не смог открыть изображение.')); };
      img.src = objectUrl;
    });

    preview.prepend(img);
    loading.hidden = true;
  } catch (error) {
    loading.classList.add('error');
    loading.textContent = `Не удалось загрузить превью.\n${error?.message || error}`;
    loading.hidden = false;
  } finally {
    requestAnimationFrame(() => window.syncAdminScrollbar?.());
  }
}

function setReviewMediaMode(mode) {
  const preview = $('#reviewPreview');
  if (!preview) return;
  if (mode === 'full' && !selectedSubmission?.preview_url) mode = 'cover';
  if (mode === 'code' && !selectedSubmission?.id) mode = 'cover';

  reviewMediaMode = mode;
  preview.classList.toggle('mode-full', mode === 'full');
  preview.classList.toggle('mode-code', mode === 'code');
  updateReviewViewButtons(mode);

  const code = $('#reviewCode');
  const loading = $('#reviewCodeLoading');
  if (mode !== 'code') {
    if (code) code.hidden = true;
    if (loading) loading.hidden = true;
  } else {
    loadReviewCode();
  }
  requestAnimationFrame(() => window.syncAdminScrollbar?.());
}

function openReview(item,status){
  selectedSubmission={...item,status};
  $('#reviewTitle').textContent=item.title||'Публикация';
  $('#reviewStatusBadge').textContent=statusLabel(status);$('#reviewStatusBadge').dataset.status=status;
  $('#reviewCategoryBadge').textContent=item.category||'Другое';
  $('#reviewMeta').textContent=`${item.author||'Автор неизвестен'} · ${formatAdminDate(item.approved_at||item.rejected_at||item.created_at)}`;
  $('#reviewDescription').textContent=item.description||'Описание отсутствует.';
  const preview=$('#reviewPreview');
  preview.classList.remove('mode-full','mode-code');
  preview.querySelectorAll(':scope > img').forEach(node=>node.remove());
  const previewEmpty=preview.querySelector(':scope > .admin-review-preview-empty');
  if(previewEmpty){previewEmpty.hidden=!!item.preview_url;previewEmpty.textContent=item.preview_url?'':'Без превью';}
  const previewLoading=$('#reviewPreviewLoading');if(previewLoading){previewLoading.hidden=true;previewLoading.classList.remove('error');}
  const code=$('#reviewCode');if(code)code.hidden=true;
  const loading=$('#reviewCodeLoading');if(loading)loading.hidden=true;
  const codeText=$('#reviewCodeText');if(codeText)codeText.textContent='';
  $('#reviewFullButton').disabled=!item.preview_url;
  $('#reviewCodeButton').disabled=!item.id;
  reviewMediaMode='cover';updateReviewViewButtons('cover');
  const xml=$('#reviewXmlLink');xml.href='#';xml.hidden=!item.id;
  const pLink=$('#reviewPreviewLink');pLink.href='#';pLink.hidden=!item.preview_url;
  const reason=$('#reviewReason');reason.hidden=status!=='rejected';$('#reviewReasonText').textContent=item.rejection_reason||'Причина не указана.';
  $('#reviewActions').hidden=status!=='pending';$('#rejectBox').hidden=true;$('#rejectReasonInput').value='';
  const canDelete = status==='approved' || status==='rejected';
  $('#approvedDeleteArea').hidden=!canDelete;
  $('#reviewDelete').textContent = status==='rejected' ? 'Удалить отклонённую публикацию' : 'Удалить публикацию';
  const deleteText = $('#deleteConfirmText');
  if (deleteText) {
    deleteText.innerHTML = status==='rejected'
      ? '<strong>Удалить отклонённую публикацию?</strong><br>Она исчезнет из истории модерации, а XML, превью и метаданные будут полностью удалены из GitHub.'
      : '<strong>Удалить публикацию?</strong><br>Она исчезнет из мастерской, а XML, превью и метаданные будут полностью удалены из GitHub.';
  }
  $('#deleteConfirmBox').hidden=true;
  const reviewScroll=$('#reviewScroll');if(reviewScroll)reviewScroll.scrollTop=0;
  $('#reviewOverlay').hidden=false;document.body.classList.add('admin-review-open');bindAdminCursorHover();requestAnimationFrame(()=>window.syncAdminScrollbar?.());
  loadReviewPreview();
  requestAnimationFrame(() => window.syncAdminReviewScrollbar?.());
}
function closeReview(){
  $('#reviewOverlay').hidden=true;document.body.classList.remove('admin-review-open');selectedSubmission=null;$('#rejectBox').hidden=true;$('#deleteConfirmBox').hidden=true;reviewMediaMode='cover';requestAnimationFrame(()=>window.syncAdminScrollbar?.());
}
async function approveSelected(){
  if(!selectedSubmission||selectedSubmission.status!=='pending')return;
  const btn=$('#reviewApprove'),old=btn.textContent;btn.disabled=true;btn.textContent='Одобряю…';
  try{await api(`/api/admin/submissions/${selectedSubmission.id}/approve`,{method:'POST'});toast('Публикация одобрена и отмечена как проверенная.');closeReview();await loadCommunityModeration();}
  catch(e){toast(e.detail||e.message);}finally{btn.disabled=false;btn.textContent=old;}
}
function beginReject(){if(!selectedSubmission)return;$('#rejectBox').hidden=false;$('#rejectReasonInput').focus();}
async function rejectSelected(){
  if(!selectedSubmission||selectedSubmission.status!=='pending')return;
  const reason=$('#rejectReasonInput').value.trim();if(reason.length<3){toast('Укажи причину отклонения.');return;}
  const btn=$('#rejectConfirm'),old=btn.textContent;btn.disabled=true;btn.textContent='Отклоняю…';
  try{await api(`/api/admin/submissions/${selectedSubmission.id}/reject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});toast('Публикация отклонена. Причина сохранена.');closeReview();await loadCommunityModeration();}
  catch(e){toast(e.detail||e.message);}finally{btn.disabled=false;btn.textContent=old;}
}

function beginDeleteApproved(){
  if(!selectedSubmission || !['approved','rejected'].includes(selectedSubmission.status)) return;
  $('#deleteConfirmBox').hidden=false;
  bindAdminCursorHover();
}

async function deleteApprovedSelected(){
  if(!selectedSubmission || !['approved','rejected'].includes(selectedSubmission.status)) return;
  const btn=$('#deleteConfirm'), old=btn.textContent;
  const status=selectedSubmission.status;
  btn.disabled=true;
  btn.textContent='Удаляю…';
  try{
    await api(`/api/admin/submissions/${selectedSubmission.id}?status=${encodeURIComponent(status)}`, { method:'DELETE' });
    toast(status==='rejected'
      ? 'Отклонённая публикация полностью удалена.'
      : 'Одобренная публикация удалена из мастерской.');
    closeReview();
    await loadCommunityModeration();
  }catch(e){
    toast(e.detail||e.message);
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
}


async function downloadReviewConfig(event){
  event?.preventDefault();
  if(!selectedSubmission?.id) return;
  const link=$('#reviewXmlLink');
  const old=link.textContent;
  link.textContent='Загружаю…';
  try{
    const blob=await fetchAdminFile('config');
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${selectedSubmission.title || selectedSubmission.id}.xml`.replace(/[\\/:*?"<>|]+/g,'_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(e){
    toast(e.message||String(e));
  }finally{
    link.textContent=old;
  }
}

async function openReviewPreviewOriginal(event){
  event?.preventDefault();
  if(!selectedSubmission?.preview_url) return;
  try{
    const url=await getReviewObjectUrl('preview');
    window.open(url,'_blank','noopener');
  }catch(e){
    toast(e.message||String(e));
  }
}

function initReviewInnerScrollbar() {
  const panel = $('#reviewScroll');
  const modal = panel?.closest('.admin-review-modal');
  if (!panel || !modal || modal.querySelector('.admin-review-inner-track')) return;

  const track = document.createElement('div');
  track.className = 'admin-review-inner-track';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'admin-review-inner-thumb';
  track.appendChild(thumb);
  modal.appendChild(track);

  let frame = 0;
  let activePointer = null;
  let pointerOffset = 0;
  const metrics = () => {
    const length = Math.max(1, track.clientHeight);
    const viewport = Math.max(1, panel.clientHeight);
    const content = Math.max(viewport, panel.scrollHeight);
    const thumbSize = Math.min(length, Math.max(42, length * viewport / content));
    const travel = Math.max(0, length - thumbSize);
    const maxScroll = Math.max(0, content - viewport);
    return { thumbSize, travel, maxScroll };
  };
  const syncNow = () => {
    frame = 0;
    if ($('#reviewOverlay')?.hidden) { track.hidden = true; return; }
    const { thumbSize, travel, maxScroll } = metrics();
    track.hidden = maxScroll < 2;
    thumb.style.height = `${thumbSize}px`;
    const fraction = maxScroll ? Math.min(1, Math.max(0, panel.scrollTop / maxScroll)) : 0;
    thumb.style.transform = `translate3d(0,${(travel * fraction).toFixed(2)}px,0)`;
  };
  const sync = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncNow);
  };
  window.syncAdminReviewScrollbar = sync;

  const setFromPointer = y => {
    const rect = track.getBoundingClientRect();
    const { travel, maxScroll } = metrics();
    if (!maxScroll || !travel) return;
    const top = Math.max(0, Math.min(travel, y - rect.top - pointerOffset));
    panel.scrollTop = maxScroll * (top / travel);
    sync();
  };
  track.addEventListener('pointerdown', e => {
    if (e.button !== 0 || track.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    const bounds = thumb.getBoundingClientRect();
    const grabbedThumb = e.clientY >= bounds.top && e.clientY <= bounds.bottom;
    pointerOffset = grabbedThumb ? e.clientY - bounds.top : bounds.height / 2;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    setFromPointer(e.clientY);
  });
  track.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointer) return;
    e.preventDefault();
    setFromPointer(e.clientY);
  });
  const finish = e => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    track.classList.remove('dragging');
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', finish);
  track.addEventListener('lostpointercapture', () => {
    activePointer = null;
    track.classList.remove('dragging');
  });
  panel.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(sync);
    resize.observe(panel);
    resize.observe(modal);
  }
  const mutation = new MutationObserver(sync);
  mutation.observe(panel, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'src', 'style'] });
  sync();
}

function bindModeration(){
  $$('.admin-review-view').forEach(b=>b.addEventListener('click',()=>setReviewMediaMode(b.dataset.reviewView)));
  $$('.admin-tab').forEach(b=>b.addEventListener('click',()=>setModerationTab(b.dataset.status)));
  $('#reloadCommunity').addEventListener('click',loadCommunityModeration);
  $('#reviewClose').addEventListener('click',closeReview);
  $('#reviewOverlay').addEventListener('click',e=>{if(e.target===$('#reviewOverlay'))closeReview();});
  $('#reviewApprove').addEventListener('click',approveSelected);
  $('#reviewReject').addEventListener('click',beginReject);
  $('#rejectCancel').addEventListener('click',()=>{$('#rejectBox').hidden=true;$('#rejectReasonInput').value='';});
  $('#rejectConfirm').addEventListener('click',rejectSelected);
  $('#reviewXmlLink').addEventListener('click',downloadReviewConfig);
  $('#reviewPreviewLink').addEventListener('click',openReviewPreviewOriginal);
  $('#reviewDelete').addEventListener('click',beginDeleteApproved);
  $('#deleteCancel').addEventListener('click',()=>{$('#deleteConfirmBox').hidden=true;});
  $('#deleteConfirm').addEventListener('click',deleteApprovedSelected);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reviewOverlay').hidden)closeReview();});
}


/* Place the animated indicator on the actual button rectangle.
   Prevents sub-pixel drift from % widths, borders and CSS transforms. */
function initMeasuredSegmentMarkers() {
  document.querySelectorAll('.program-segmented[data-index]').forEach(group => {
    const buttons = Array.from(group.querySelectorAll(':scope > .segment-btn'));
    if (!buttons.length) return;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!group.isConnected || !group.getClientRects().length) return;
        const raw = Number(group.dataset.index);
        const index = Number.isInteger(raw) && raw >= 0 && raw < buttons.length
          ? raw : Math.max(0, buttons.findIndex(button => button.classList.contains('active')));
        const selected = buttons[index];
        if (!selected || !selected.offsetWidth) return;
        // offsetLeft and offsetWidth use the same box geometry as the grid's buttons.
        group.style.setProperty('--seg-marker-left', `${selected.offsetLeft}px`);
        group.style.setProperty('--seg-marker-width', `${selected.offsetWidth}px`);
        group.classList.add('segment-marker-ready');
      });
    };
    const mutations = new MutationObserver(sync);
    mutations.observe(group, { attributes: true, attributeFilter: ['data-index'] });
    buttons.forEach(button => mutations.observe(button, { attributes: true, attributeFilter: ['class'] }));
    if ('ResizeObserver' in window) {
      const sizes = new ResizeObserver(sync);
      sizes.observe(group);
      buttons.forEach(button => sizes.observe(button));
    }
    addEventListener('resize', sync, { passive: true });
    group.addEventListener('click', sync);
    sync();
  });
}

function init(){initMeasuredSegmentMarkers();initReviewInnerScrollbar();initCursor();initAdminHeader();initAdminDragScroll();initCustomScrollbar();initProgramSelects();observeAdminReveals();$('#loginForm').addEventListener('submit',e=>{e.preventDefault();login($('#adminKeyInput').value);});$('#logoutBtn').addEventListener('click',logout);$('#officialFactionSelect').addEventListener('change',e=>loadSlot(e.target.value));$('#newOfficialFaction').addEventListener('click',beginNewOfficial);$('#reloadOfficial').addEventListener('click',()=>currentSlot?loadSlot(currentSlot):beginNewOfficial());$('#officialForm').addEventListener('submit',submit);bindFiles();bindModeration();if(adminKey)login(adminKey);}
addEventListener('DOMContentLoaded',init);
