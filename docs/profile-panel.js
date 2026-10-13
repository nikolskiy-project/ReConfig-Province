/* ReConfig Province · Profile overlay shared by the workshop and authors directory. */
(()=>{
'use strict';
const API=String(window.REHUB_API||'').replace(/\/$/,'');
const validName=/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/;
let root=null,lastFocus=null,shown='',pending=null,closeTimer=null,menuCloser=null;
const el=(tag,cls='',label='')=>{const node=document.createElement(tag);if(cls)node.className=cls;if(label!==undefined&&label!=='')node.textContent=label;return node;};
function link(url,label,cls='') {const a=el('a',cls,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function safeUrl(raw){try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
function avatar(username,url,cls='profile-portrait'){
 const wrap=el('span',cls);wrap.textContent=(username||'?').slice(0,1).toUpperCase();
 const imageUrl=safeUrl(url);if(imageUrl){const img=document.createElement('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();wrap.append(img);}
 return wrap;
}
function init(){if(root)return root;
 root=el('div','profile-overlay');root.hidden=true;root.setAttribute('aria-hidden','true');
 root.innerHTML=`<div class="profile-backdrop"></div><section class="profile-panel" role="dialog" aria-modal="true" aria-label="Профиль автора" tabindex="-1"><button class="profile-exit" type="button" aria-label="Закрыть профиль"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button><div class="profile-scroll"><div class="profile-loading">Загружаем профиль автора…</div></div></section>`;
 document.body.append(root);
 root.querySelector('.profile-backdrop').addEventListener('click',close);
 root.querySelector('.profile-exit').addEventListener('click',close);
 root.querySelector('.profile-scroll').addEventListener('wheel',()=>menuCloser?.(),{passive:true});
 root.querySelector('.profile-scroll').addEventListener('touchmove',()=>menuCloser?.(),{passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden&&document.getElementById('accountOverlay')?.hidden!==false){close();e.stopPropagation();}});
 return root;
}
function close(){if(menuCloser){menuCloser();menuCloser=null;}if(!root||root.hidden)return;root.classList.add('is-closing');root.setAttribute('aria-hidden','true');document.body.classList.remove('profile-open');clearTimeout(closeTimer);closeTimer=setTimeout(()=>{root.hidden=true;root.classList.remove('is-closing');root.querySelector('.profile-scroll').replaceChildren();lastFocus?.focus?.();},240);}
function stat(value,label,extra=''){const c=el('div','profile-stat');c.append(el('strong','',String(value)),el('span','',label));if(extra)c.append(el('small','',extra));return c;}
const fmtNumber=value=>Number(value||0).toLocaleString('ru-RU');
function getToken(){return sessionStorage.getItem('reconfig_session_token')||'';}
async function request(path,options={}){const r=await fetch(API+path,{cache:'no-store',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Не удалось получить данные профиля');return data;}
function safeContactUrl(raw,kind){
 const value=safeUrl(raw);if(!value)return null;
 try{const u=new URL(value),host=u.hostname.toLowerCase();const hosts={telegram:['t.me','telegram.me'],discord:['discord.gg','discord.com'],vk:['vk.com','m.vk.com','vk.ru'],forum:['forum.gtaprovince.ru']};
 if(!hosts[kind]?.includes(host))return null;
 if(kind==='forum'&&!/^\/(?:forum(?:\/|$)|profile\/[0-9]+-[a-zA-Z0-9_-]+\/?$)/.test(u.pathname))return null;
 return value;}catch{return null;}
}
function profileField(title,name,value,placeholder='',max=250){
 const lab=el('label','profile-field');lab.append(el('span','profile-field-label',title));
 const input=el(name==='bio'?'textarea':'input','profile-input');input.name=name;
 input.maxLength=max;input.placeholder=placeholder;input.value=value||'';
 if(input.tagName==='TEXTAREA')input.rows=3;else input.autocomplete='off';
 lab.append(input);return lab;
}
function themePicker(value){
 const field=el('div','profile-field profile-theme-field');
 field.append(el('span','profile-field-label','Цвет шапки без изображения'));
 const select=el('select','profile-native-select animated-native-select');
 select.name='banner_theme';
 const themes=[['violet','Фиолетовый'],['blue','Синий'],['rose','Розовый'],['emerald','Изумрудный']];
 for(const [key,name] of themes){const option=el('option','',name);option.value=key;select.append(option);}
 select.value=themes.some(theme=>theme[0]===value)?value:'violet';
 select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 field.append(select);
 // The actual workshop "program-select" component, including its shutter
 // animation, DOM structure and control classes (not a second custom picker).
 const wrap=el('div','program-select');
 wrap.innerHTML='<button type="button" class="program-select-trigger interactive" aria-expanded="false" aria-haspopup="listbox"><span class="program-select-value"></span><span class="program-select-arrow" aria-hidden="true"></span></button><div class="program-select-dropdown"><div class="program-select-options" role="listbox" aria-label="Цвет шапки"></div></div>';
 field.append(wrap);
 const button=wrap.querySelector('.program-select-trigger');
 const optionList=wrap.querySelector('.program-select-options');
 let animationTimer=null;
 const setOpen=open=>{
  clearTimeout(animationTimer);
  wrap.classList.add('animating');wrap.classList.toggle('open',open);
  button.setAttribute('aria-expanded',String(open));
  animationTimer=setTimeout(()=>{wrap.classList.remove('animating');animationTimer=null;},330);
 };
 const closeMenu=()=>{setOpen(false);if(menuCloser===closeMenu)menuCloser=null;};
 const syncOptions=()=>{
  wrap.querySelector('.program-select-value').textContent=themes.find(t=>t[0]===select.value)?.[1]||themes[0][1];
  optionList.replaceChildren();
  themes.forEach(([key,name],index)=>{
   const option=el('button','program-select-option'+(select.value===key?' selected':''),name);
   option.type='button';option.setAttribute('role','option');
   option.setAttribute('aria-selected',String(select.value===key));
   option.style.setProperty('--option-index',String(index));
   option.onclick=event=>{event.stopPropagation();select.value=key;select.dispatchEvent(new Event('change',{bubbles:true}));syncOptions();closeMenu();button.focus({preventScroll:true});};
   optionList.append(option);
  });
 };
 syncOptions();
 button.onclick=event=>{event.stopPropagation();const willOpen=!wrap.classList.contains('open');menuCloser?.();if(willOpen)menuCloser=closeMenu;setOpen(willOpen);};
 document.addEventListener('pointerdown',event=>{if(menuCloser===closeMenu&&!field.contains(event.target))closeMenu();});
 field.addEventListener('keydown',event=>{if(event.key==='Escape'&&wrap.classList.contains('open')){closeMenu();button.focus();event.stopPropagation();}});
 optionList.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
 return field;
}
function editor(data){const form=el('form','profile-edit');
 form.append(el('h3','','Настройки профиля'),el('p','profile-help','Укажи свои ссылки и оформление. Контакты отображаются в профиле только при заполнении.'));
 const fields=[
 ['О себе','bio','Расскажи о себе и своих биндах',300],
 ['Аватарка (ссылка на изображение)','avatar_url','https://site.example/avatar.webp',320],
 ['Шапка (ссылка на изображение)','banner_url','https://site.example/banner.webp',320],
 ['Telegram','telegram','https://t.me/username',320],
 ['Discord','discord','kead_ или kead#2222',32],
 ['ВКонтакте','vk','https://vk.com/username',320],
 ['Форум Province','forum','https://forum.gtaprovince.ru/profile/343829-artem_nikolskiy/',320]
 ];
 for(const [label,name,placeholder,max] of fields)form.append(profileField(label,name,data[name],placeholder,max));
 const themeField=themePicker(data.banner_theme);const select=themeField.querySelector('select');form.append(themeField);
 const message=el('p','profile-form-message');message.setAttribute('role','status');form.append(message);
 const actions=el('div','profile-edit-actions');const save=el('button','profile-action primary','Сохранить изменения');save.type='submit';const cancel=el('button','profile-action','Отмена');cancel.type='button';cancel.addEventListener('click',()=>form.dispatchEvent(new CustomEvent('profile-editor-close',{bubbles:true})));actions.append(save,cancel);form.append(actions);
 form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;message.textContent='Сохраняем…';const body={};for(const field of fields)body[field[1]]=form.elements[field[1]].value.trim();body.banner_theme=select.value;
 try{const result=await request('/api/auth/profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify(body)});if(window.reconfigSetCurrentAccount)window.reconfigSetCurrentAccount(result.user);await refresh(shown);}
 catch(err){message.textContent=err.message;}finally{save.disabled=false;}});
 return form;
}
function contactButtons(author){const list=el('div','profile-contacts');
 if(author.discord){const b=el('button','profile-contact profile-discord-copy','Discord: '+author.discord);b.type='button';b.title='Скопировать логин Discord';b.onclick=async()=>{try{await navigator.clipboard.writeText(author.discord);b.textContent='Логин скопирован';setTimeout(()=>{if(b.isConnected)b.textContent='Discord: '+author.discord;},1400);}catch{b.textContent='Discord: '+author.discord;}};list.append(b);}
 const items=[['telegram','Telegram'],['vk','ВКонтакте'],['forum','Форум Province']];for(const [key,label] of items){const url=safeContactUrl(author[key],key);if(url){const button=link(url,label,'profile-contact');button.title='Открыть '+label;list.append(button);}}return list;}
function workCard(item,owner){const card=el('article','profile-work');const preview=el('div','profile-work-preview');
 if(item.preview_url&&safeUrl(item.preview_url)){const img=document.createElement('img');img.src=item.preview_url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';preview.append(img);}else preview.append(el('span','','RC'));
 const info=el('div','profile-work-main');info.append(el('strong','',item.title||'Без названия'),el('small','',`${item.category||'Другое'} · ${fmtNumber(item.downloads)} скачиваний`));
 const rating=item.rating||{votes:0,score:0};const rline=el('div','profile-work-rating');rline.append(el('span','profile-work-score',rating.votes?`★ ${Number(rating.score).toFixed(1)} · ${rating.votes} оценок`:'☆ Пока нет оценок'));
 const ownerIsCurrent=window.reconfigCurrentAccount?.()?.username?.toLowerCase()===owner.toLowerCase() || (getToken() && sessionStorage.getItem('reconfig_self_user')?.toLowerCase()===owner.toLowerCase());
 const controls=el('div','profile-stars');controls.setAttribute('role','group');controls.setAttribute('aria-label','Оценить работу');for(let n=1;n<=5;n++){const b=el('button','profile-star','★');b.type='button';b.title=`Поставить ${n} из 5`;b.setAttribute('aria-label',b.title);b.onclick=async()=>{if(!getToken()){
   if(window.reconfigRequireAccount){window.reconfigRequireAccount(()=>{void refresh(owner);});return;}
   location.href='rehub.html?auth=1&profile='+encodeURIComponent(owner);return;
 }
 controls.querySelectorAll('button').forEach(x=>x.disabled=true);
 try{await request('/api/ratings/'+encodeURIComponent(item.id),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify({score:n})});await refresh(owner);}
 catch(err){const fail=el('small','profile-rating-error',err.message);controls.replaceWith(fail);} };controls.append(b);}
 if(!ownerIsCurrent)rline.append(controls);info.append(rline);
 card.classList.add('profile-work-clickable');card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Открыть бинд: '+(item.title||'Публикация'));
 const navigate=()=>{
   const here=Boolean(document.getElementById('hubGrid'));
   if(here&&typeof window.reconfigOpenCommunityWork==='function'){
     close();setTimeout(()=>window.reconfigOpenCommunityWork(item.id),255);
   }else{close();setTimeout(()=>{location.href='rehub.html#config=community:'+encodeURIComponent(item.id);},220);}
 };
 if(ownerIsCurrent){const del=el('button','profile-work-delete');del.type='button';del.title='Удалить эту публикацию';del.setAttribute('aria-label','Удалить '+(item.title||'публикацию'));
 del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
 del.onclick=async ev=>{ev.stopPropagation();if(!confirm('Безвозвратно удалить публикацию «'+(item.title||'Без названия')+'» из мастерской?'))return;
  del.disabled=true;try{await request('/api/auth/my-submissions/'+item.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify({status:'approved',confirm:item.id})});await refresh(owner);window.dispatchEvent(new Event('reconfig:community-changed'));}
  catch(error){alert(error.message);del.disabled=false;}};card.append(del);}
 card.addEventListener('click',event=>{if(event.target.closest('button,a'))return;navigate();});
 card.addEventListener('keydown',event=>{if(event.target!==card)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate();}});
 card.append(preview,info);return card;}
async function refresh(name){const scroll=root.querySelector('.profile-scroll');const oldTop=scroll.scrollTop;scroll.replaceChildren(el('p','profile-loading','Загружаем профиль…'));
 try{const data=await request('/api/authors/'+encodeURIComponent(name));if(shown!==name)return;
 const user=data.author;scroll.replaceChildren();const banner=el('div','profile-banner theme-'+(user.banner_theme||'violet'));
 const coverUrl=safeUrl(user.banner_url);if(coverUrl){const pic=el('img','profile-banner-image');pic.src=coverUrl;pic.alt='';pic.loading='lazy';pic.referrerPolicy='no-referrer';pic.onerror=()=>pic.remove();banner.append(pic);}
 banner.append(el('span','profile-banner-watermark','ReConfig Province'));scroll.append(banner);
 const content=el('div','profile-content');const head=el('div','profile-head');const avatarNode=avatar(user.username,user.avatar_url);const ident=el('div','profile-identity');ident.append(el('span','profile-eyebrow','АВТОР МАСТЕРСКОЙ'));
 const uname=el('div','profile-username');uname.append(el('h2','',user.username));if(user.verified){const verified=el('span','profile-verified','✓');verified.title='Проверенный автор';verified.setAttribute('aria-label','Проверенный автор');uname.append(verified);}ident.append(uname,el('p','profile-subtitle',user.verified?'Проверенный автор ReConfig Province':'Автор сообщества ReConfig Province'));
 head.append(avatarNode,ident);const share=el('button','profile-action profile-share','Скопировать ссылку');share.type='button';share.onclick=()=>{const url=new URL('rehub.html',location.href);url.searchParams.set('profile',user.username);const value=url.href;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>share.textContent='Ссылка скопирована').catch(()=>{share.textContent=value;});else{const temp=document.createElement('textarea');temp.value=value;temp.style.cssText='position:fixed;opacity:0;left:-9999px';document.body.append(temp);temp.select();const copied=document.execCommand('copy');temp.remove();share.textContent=copied?'Ссылка скопирована':value;}};const headerActions=el('div','profile-header-actions');headerActions.append(share);head.append(headerActions);content.append(head);
 if(user.bio)content.append(el('p','profile-bio',user.bio));const contacts=contactButtons(user);if(contacts.childElementCount){content.append(el('h3','profile-small-heading','Контакты'),contacts);}
 const rating=data.rating||{score:null,votes:0};const stats=el('div','profile-stat-grid');stats.append(stat(fmtNumber(data.publications),'Работ'),stat(fmtNumber(data.downloads),'Скачиваний'),stat(rating.votes?`★ ${Number(rating.score).toFixed(1)}`:'☆ —','Оценка автора'),stat(fmtNumber(rating.votes),'Оценок'));
 content.append(stats);
 const own=Boolean(getToken() && (window.reconfigCurrentAccount?.()?.id===user.id || sessionStorage.getItem('reconfig_self_user')?.toLowerCase()===user.username.toLowerCase()));
 if(own){
  const toggle=el('button','profile-action profile-edit-toggle','Редактировать');toggle.type='button';toggle.setAttribute('aria-expanded','false');
  const logout=el('button','profile-action profile-logout','Выйти');logout.type='button';
  logout.onclick=async()=>{
    const token=getToken();try{if(token)await request('/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}});}catch{}
    sessionStorage.removeItem('reconfig_session_token');sessionStorage.removeItem('reconfig_self_user');
    window.reconfigSetCurrentAccount?.(null);close();if(!window.reconfigSetCurrentAccount && location.pathname.endsWith('/authors.html'))location.reload();
  };
  headerActions.append(toggle,logout);
  const shell=el('div','profile-edit-shell');const form=editor(user);form.inert=true;shell.append(form);
  shell.style.height='0px';shell.style.opacity='0';shell.style.overflow='hidden';
  let animator=null;
  const changeOpen=next=>{
    menuCloser?.();const from=shell.getBoundingClientRect().height;animator?.cancel();
    shell.classList.toggle('is-open',next);toggle.classList.toggle('is-active',next);
    toggle.setAttribute('aria-expanded',String(next));toggle.textContent=next?'Свернуть':'Редактировать';form.inert=!next;
    // Explicit measured-height animation: no 0fr / auto snap.
    const to=next?form.scrollHeight+8:0;
    shell.style.visibility='visible';shell.style.height=from+'px';
    animator=shell.animate([{height:from+'px',opacity:next?'0':'1'},{height:to+'px',opacity:next?'1':'0'}],{
      duration:480,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    animator.onfinish=()=>{shell.style.height=next?'auto':'0px';shell.style.opacity=next?'1':'0';shell.style.visibility=next?'visible':'hidden';animator.cancel();animator=null;};
    if(next){setTimeout(()=>{const scroller=root?.querySelector('.profile-scroll');if(!scroller)return;const y=shell.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-105;scroller.scrollTo({top:Math.max(0,y),behavior:'smooth'});},155);}
  };
  toggle.addEventListener('click',()=>changeOpen(!shell.classList.contains('is-open')));
  shell.addEventListener('profile-editor-close',()=>changeOpen(false));content.append(shell);
 }
 const section=el('section','profile-library');const top=el('div','profile-library-title');top.append(el('h3','','Библиотека работ'),el('span','',`${data.items.length} ${data.items.length%10===1 && data.items.length%100!==11?'публикация':data.items.length%10>=2 && data.items.length%10<=4 && (data.items.length%100<12||data.items.length%100>14)?'публикации':'публикаций'}`));section.append(top);
 if(!data.items.length)section.append(el('p','profile-empty','Здесь пока нет опубликованных биндов.'));
 else{const grid=el('div','profile-work-grid');data.items.forEach(item=>grid.append(workCard(item,user.username)));section.append(grid);}content.append(section);
 if(own){const pendingSection=el('section','profile-pending-section');pendingSection.append(el('h3','','Мои заявки'));const pendingList=el('div','profile-pending-list');pendingList.append(el('p','profile-empty','Загружаем заявки…'));pendingSection.append(pendingList);content.append(pendingSection);
  request('/api/auth/my-submissions',{headers:{Authorization:'Bearer '+getToken()}}).then(res=>{
   if(shown!==name||!pendingList.isConnected)return;
   const items=Array.isArray(res.items)?res.items:[];pendingList.replaceChildren();
   if(!items.length){pendingSection.remove();return;}
   for(const item of items){const row=el('div','profile-pending-work');const preview=el('span','profile-pending-thumb');if(safeUrl(item.preview_url)){const img=el('img');img.src=item.preview_url;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();preview.append(img);}else preview.textContent='XML';
    const info=el('div','profile-pending-info');info.append(el('strong','',item.title||'Новая публикация'),el('small','',item.category||'Бинды'));
    const status=el('span','profile-pending-label'+(item.status==='rejected'?' is-rejected':''),item.status==='rejected'?(item.rejection_reason||'Отклонено'):'На модерации');
    if(item.status==='rejected'){status.title='Причина отклонения: '+(item.rejection_reason||'Не указана');row.classList.add('is-rejected');}
    const tools=el('div','profile-pending-tools');tools.append(status);
    const del=el('button','profile-pending-delete','');del.type='button';del.title='Удалить заявку';del.setAttribute('aria-label','Удалить заявку');
    del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/></svg>';
    del.onclick=async()=>{if(!confirm('Безвозвратно удалить '+(item.status==='rejected'?'отклонённую публикацию':'заявку')+' «'+(item.title||'Без названия')+'»?'))return;
      del.disabled=true;try{await request('/api/auth/my-submissions/'+item.id,{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify({status:item.status,confirm:item.id})});row.remove();if(!pendingList.childElementCount)pendingSection.remove();}
      catch(error){del.disabled=false;alert(error.message);}};
    tools.append(del);row.append(preview,info,tools);pendingList.append(row);}
  }).catch(()=>{if(pendingList.isConnected)pendingList.replaceChildren(el('p','profile-empty','Не удалось загрузить заявки.'));});
 }
 scroll.append(content);
 scroll.scrollTop=oldTop;
 }catch(err){scroll.replaceChildren(el('p','profile-loading',err.message));}}
function show(name){name=String(name||'').trim();if(!validName.test(name))return;
 init();lastFocus=document.activeElement;shown=name;clearTimeout(closeTimer);root.hidden=false;root.classList.remove('is-closing');root.setAttribute('aria-hidden','false');document.body.classList.add('profile-open');root.querySelector('.profile-scroll').scrollTop=0;root.querySelector('.profile-panel').focus({preventScroll:true});void refresh(name);
}
window.reconfigOpenProfile=show;
window.addEventListener('reconfig:submission-created',()=>{if(root&&!root.hidden&&shown){void refresh(shown);}});
window.addEventListener('reconfig:community-changed',()=>{if(root&&!root.hidden&&shown&&!root.querySelector('.profile-edit-shell.is-open')){void refresh(shown);}});
// New approved work should appear without closing the profile. Do not disrupt an open editor.
let profileLastList='';
setInterval(async()=>{
 if(document.visibilityState==='hidden'||!shown||!root||root.hidden||root.querySelector('.profile-edit-shell.is-open'))return;
 try{
  const response=await request('/api/authors/'+encodeURIComponent(shown));
  const signature=JSON.stringify((response.items||[]).map(item=>[item.id,item.title,item.downloads,item.rating?.votes]));
  if(profileLastList&&signature!==profileLastList){profileLastList=signature;await refresh(shown);}
  else profileLastList=signature;
 }catch{}
},45000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();const selected=new URLSearchParams(location.search).get('profile');if(selected)show(selected);});
else{init();const selected=new URLSearchParams(location.search).get('profile');if(selected)show(selected);}
})();
