
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const API = String(window.REHUB_API || '').replace(/\/$/, '');
const SOURCE_MAX = 8 * 1024 * 1024;
const PREVIEW_MAX = 600 * 1024;
const defaults = {
  okb: { title:'ОКБ г. Мирный' },
  uvd: { title:'УВД' },
  gibdd: { title:'ГИБДД' },
  army: { title:'Армия' }
};
let adminKey = sessionStorage.getItem('rehub_admin_key') || '';
let currentSlot = 'okb';
let currentMeta = null;
let compressedPreview = null;
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

  const existing = document.querySelector('.site-scrollbar');
  if (existing) existing.remove();

  const track = document.createElement('div');
  track.className = 'site-scrollbar';
  track.setAttribute('aria-hidden', 'true');

  const thumb = document.createElement('div');
  thumb.className = 'site-scrollbar-thumb';
  track.appendChild(thumb);
  document.body.appendChild(track);

  let dragging = false;
  let grabOffset = 0;
  let raf = 0;

  const metrics = () => {
    const viewport = innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, viewport);
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(52, Math.min(trackHeight, trackHeight * (viewport / total)));
    const maxScroll = Math.max(0, total - viewport);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    return { thumbHeight, maxScroll, maxThumbTop };
  };

  const syncNow = () => {
    raf = 0;
    const { thumbHeight, maxScroll, maxThumbTop } = metrics();
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0,${maxThumbTop * ratio}px,0)`;
    track.classList.toggle('hidden', maxScroll <= 0);
  };

  const sync = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncNow);
  };

  window.syncAdminScrollbar = sync;

  const move = clientY => {
    const rect = track.getBoundingClientRect();
    const { maxScroll, maxThumbTop } = metrics();
    if (!maxScroll || !maxThumbTop) return;
    const top = Math.max(0, Math.min(maxThumbTop, clientY - rect.top - grabOffset));
    scrollTo(0, (top / maxThumbTop) * maxScroll);
  };

  thumb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    grabOffset = e.clientY - thumb.getBoundingClientRect().top;
    dragging = true;
    thumb.classList.add('dragging');
    thumb.setPointerCapture?.(e.pointerId);
  });

  addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    move(e.clientY);
  }, { passive: false });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };

  addEventListener('pointerup', finish);
  addEventListener('pointercancel', finish);
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });

  // Админка меняет высоту после входа, загрузки очереди и переключения вкладок.
  // Следим за этим автоматически, чтобы ползунок не оставался скрытым/старого размера.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(sync);
    ro.observe(document.documentElement);
    ro.observe(document.body);
  }

  const mo = new MutationObserver(sync);
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class', 'style']
  });

  sync();
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
  $('#adminConfigFile').value=''; $('#adminPreviewFile').value=''; compressedPreview=null;
  $('#adminConfigTitle').textContent=currentMeta?'Оставить текущий XML':'Выбрать XML-конфиг';
  $('#adminConfigMeta').textContent=currentMeta?'Выбери файл только если нужно заменить XML':'Для первой публикации обязателен · до 1 МБ';
  const img=$('#adminPreviewImage'),drop=$('#adminPreviewDrop');
  if(currentMeta?.preview_url){img.hidden=false;img.src=currentMeta.preview_url;drop.classList.add('has-preview');$('#adminPreviewTitle').textContent='Текущее превью';$('#adminPreviewMeta').textContent='Новый файл заменит его';}
  else {img.hidden=true;img.removeAttribute('src');drop.classList.remove('has-preview');$('#adminPreviewTitle').textContent='Добавить превью';$('#adminPreviewMeta').textContent='JPG / PNG / WebP · авто ≤ 600 КБ';}
}
function fillForm(meta) {
  currentMeta=meta||null;
  $('#officialTitle').value=meta?.title||defaults[currentSlot].title;
  $('#officialAuthor').value=meta?.author||'ReConfig Province';
  $('#officialDescription').value=meta?.description||'';
  $('#adminEditorTitle').textContent=meta?.title||defaults[currentSlot].title;
  $('#editorState').textContent=meta?`Опубликован · обновлён ${new Date(meta.updated_at||meta.created_at).toLocaleString('ru-RU')}`:'Новая публикация';
  $('#officialSubmit').textContent=meta?'Обновить официальный конфиг':'Опубликовать официальный';
  $('#adminNoticeText').textContent=meta?'Поля без нового XML или превью сохранят текущие файлы. Обновление сразу появится в закреплённой карточке.':'Официальная публикация сразу появится в закреплённой карточке без модерации.';
  resetFiles();
}
async function loadSlot(slot) {
  currentSlot=slot; $$('.admin-slot').forEach(b=>b.classList.toggle('active',b.dataset.slot===slot));
  try { fillForm(await api(`/api/admin/official/${slot}`)); }
  catch(e){ if(e.status===404) fillForm(null); else { toast(e.message); if(e.status===401) logout(); } }
}
async function refreshStates() {
  try {
    const items=await api('/api/admin/official');
    const published=new Set((items||[]).map(x=>x.slot));
    for(const slot of Object.keys(defaults)){const el=$(`#slotState-${slot}`);el.textContent=published.has(slot)?'Опубликован':'Не опубликован';el.classList.toggle('ready',published.has(slot));}
  } catch(e){ if(e.status===401) logout(); else toast(e.message); }
}
function showWorkspace() { $('#adminLogin').hidden=true; $('#adminWorkspace').hidden=false; refreshStates(); loadSlot(currentSlot); loadCommunityModeration(); bindAdminCursorHover(); requestAnimationFrame(()=>window.syncAdminScrollbar?.()); }
function logout(){adminKey='';sessionStorage.removeItem('rehub_admin_key');$('#adminWorkspace').hidden=true;$('#adminLogin').hidden=false;$('#adminKeyInput').value='';bindAdminCursorHover();requestAnimationFrame(()=>window.syncAdminScrollbar?.());}
async function login(key){adminKey=key.trim();if(!adminKey)return;try{await api('/api/admin/official');sessionStorage.setItem('rehub_admin_key',adminKey);$('#loginError').textContent='';showWorkspace();}catch(e){adminKey='';$('#loginError').textContent=e.status===401?'Неверный ADMIN_KEY.':e.message;}}
function bindFiles(){
  $('#adminConfigFile').addEventListener('change',()=>{const f=$('#adminConfigFile').files[0];if(!f)return;$('#adminConfigTitle').textContent=f.name;$('#adminConfigMeta').textContent=`${Math.max(1,Math.round(f.size/1024))} КБ · XML`;});
  $('#adminPreviewFile').addEventListener('change',async()=>{const f=$('#adminPreviewFile').files[0];if(!f)return;try{compressedPreview=await compressPreview(f);const url=URL.createObjectURL(compressedPreview),img=$('#adminPreviewImage');img.hidden=false;img.src=url;$('#adminPreviewDrop').classList.add('has-preview');$('#adminPreviewTitle').textContent='Новое превью готово';$('#adminPreviewMeta').textContent=`${Math.round(compressedPreview.size/1024)} КБ · WebP`; }catch(e){$('#adminPreviewFile').value='';compressedPreview=null;toast(e.message);}});
}
async function submit(e){
  e.preventDefault(); if(!API){toast('Не указан REHUB_API.');return;}
  const xml=$('#adminConfigFile').files[0]; if(!currentMeta&&!xml){toast('Для первой публикации выбери XML.');return;}
  const fd=new FormData();fd.set('title',$('#officialTitle').value);fd.set('author',$('#officialAuthor').value);fd.set('description',$('#officialDescription').value);if(xml)fd.set('config',xml,xml.name);if(compressedPreview)fd.set('preview',compressedPreview,'preview.webp');
  const form=$('#officialForm'),btn=$('#officialSubmit'),old=btn.textContent;form.classList.add('submitting');btn.disabled=true;btn.textContent=currentMeta?'Обновляю…':'Публикую…';
  try{const result=await api(`/api/admin/official/${currentSlot}`,{method:'POST',body:fd});fillForm(result.item);await refreshStates();toast(result.mode==='updated'?'Официальный конфиг обновлён.':'Официальный конфиг опубликован.');}
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
  items.forEach(item=>{
    const card=document.createElement('button'); card.type='button'; card.className='admin-community-card interactive';
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
  window.syncAdminScrollbar?.();
}
function setModerationTab(status){
  moderationTab=status; $$('.admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.status===status)); renderCommunityModeration();
}

const reviewXmlCache = new Map();
let reviewMediaMode = 'cover';

function updateReviewViewButtons(mode) {
  $$('.admin-review-view').forEach(btn => btn.classList.toggle('active', btn.dataset.reviewView === mode));
}

async function loadReviewCode() {
  if (!selectedSubmission?.download_url) return;
  const url = selectedSubmission.download_url;
  const code = $('#reviewCode');
  const codeText = $('#reviewCodeText');
  const loading = $('#reviewCodeLoading');
  if (!code || !codeText || !loading) return;

  code.hidden = true;
  loading.hidden = false;
  try {
    let text = reviewXmlCache.get(url);
    if (text == null) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
      reviewXmlCache.set(url, text);
    }
    codeText.textContent = text || 'XML-файл пуст.';
    code.hidden = false;
  } catch (error) {
    codeText.textContent = `Не удалось загрузить XML для просмотра.\n${error?.message || error}`;
    code.hidden = false;
  } finally {
    loading.hidden = true;
    requestAnimationFrame(() => window.syncAdminScrollbar?.());
  }
}

function setReviewMediaMode(mode) {
  const preview = $('#reviewPreview');
  if (!preview) return;
  if (mode === 'full' && !selectedSubmission?.preview_url) mode = 'cover';
  if (mode === 'code' && !selectedSubmission?.download_url) mode = 'cover';

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
  preview.querySelectorAll(':scope > img, :scope > .admin-review-preview-empty').forEach(node=>node.remove());
  if(item.preview_url){const img=document.createElement('img');img.src=item.preview_url;img.alt=`Превью: ${item.title||'публикация'}`;preview.prepend(img);}else{const f=document.createElement('div');f.className='admin-review-preview-empty';f.textContent='Без превью';preview.prepend(f);}
  const code=$('#reviewCode');if(code)code.hidden=true;
  const loading=$('#reviewCodeLoading');if(loading)loading.hidden=true;
  const codeText=$('#reviewCodeText');if(codeText)codeText.textContent='';
  $('#reviewFullButton').disabled=!item.preview_url;
  $('#reviewCodeButton').disabled=!item.download_url;
  reviewMediaMode='cover';updateReviewViewButtons('cover');
  const xml=$('#reviewXmlLink');xml.href=item.download_url||'#';xml.hidden=!item.download_url;
  const pLink=$('#reviewPreviewLink');pLink.href=item.preview_url||'#';pLink.hidden=!item.preview_url;
  const reason=$('#reviewReason');reason.hidden=status!=='rejected';$('#reviewReasonText').textContent=item.rejection_reason||'Причина не указана.';
  $('#reviewActions').hidden=status!=='pending';$('#rejectBox').hidden=true;$('#rejectReasonInput').value='';
  $('#reviewOverlay').hidden=false;document.body.classList.add('admin-review-open');bindAdminCursorHover();requestAnimationFrame(()=>window.syncAdminScrollbar?.());
}
function closeReview(){
  $('#reviewOverlay').hidden=true;document.body.classList.remove('admin-review-open');selectedSubmission=null;$('#rejectBox').hidden=true;reviewMediaMode='cover';requestAnimationFrame(()=>window.syncAdminScrollbar?.());
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
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reviewOverlay').hidden)closeReview();});
}

function init(){initCursor();initCustomScrollbar();$('#loginForm').addEventListener('submit',e=>{e.preventDefault();login($('#adminKeyInput').value);});$('#logoutBtn').addEventListener('click',logout);$$('.admin-slot').forEach(b=>b.addEventListener('click',()=>loadSlot(b.dataset.slot)));$('#reloadOfficial').addEventListener('click',()=>loadSlot(currentSlot));$('#officialForm').addEventListener('submit',submit);bindFiles();bindModeration();if(adminKey)login(adminKey);}
addEventListener('DOMContentLoaded',init);
