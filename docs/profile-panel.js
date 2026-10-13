/* ReConfig Province · Profile overlay shared by the workshop and authors directory. */
(()=>{
'use strict';
const API=String(window.REHUB_API||'').replace(/\/$/,'');
const validName=/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/;
let root=null,lastFocus=null,shown='',pending=null,closeTimer=null;
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
 root.innerHTML=`<div class="profile-backdrop"></div><section class="profile-panel" role="dialog" aria-modal="true" aria-label="Профиль автора" tabindex="-1"><button class="profile-exit" type="button" aria-label="Закрыть профиль">×</button><div class="profile-scroll"><div class="profile-loading">Загружаем профиль автора…</div></div></section>`;
 document.body.append(root);
 root.querySelector('.profile-backdrop').addEventListener('click',close);
 root.querySelector('.profile-exit').addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden&&document.getElementById('accountOverlay')?.hidden!==false){close();e.stopPropagation();}});
 return root;
}
function close(){if(!root||root.hidden)return;root.classList.add('is-closing');root.setAttribute('aria-hidden','true');document.body.classList.remove('profile-open');clearTimeout(closeTimer);closeTimer=setTimeout(()=>{root.hidden=true;root.classList.remove('is-closing');root.querySelector('.profile-scroll').replaceChildren();lastFocus?.focus?.();},240);}
function stat(value,label,extra=''){const c=el('div','profile-stat');c.append(el('strong','',String(value)),el('span','',label));if(extra)c.append(el('small','',extra));return c;}
const fmtNumber=value=>Number(value||0).toLocaleString('ru-RU');
function getToken(){return sessionStorage.getItem('reconfig_session_token')||'';}
async function request(path,options={}){const r=await fetch(API+path,{cache:'no-store',...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Не удалось получить данные профиля');return data;}
function safeContactUrl(raw,kind){
 const value=safeUrl(raw);if(!value)return null;
 try{const u=new URL(value),host=u.hostname.toLowerCase();const hosts={telegram:['t.me','telegram.me'],discord:['discord.gg','discord.com'],vk:['vk.com','m.vk.com','vk.ru'],forum:['forum.gtaprovince.ru']};
 if(!hosts[kind]?.includes(host))return null;
 if(kind==='forum'&&!u.pathname.startsWith('/forum/'))return null;
 return value;}catch{return null;}
}
function profileField(title,name,value,placeholder='',max=250){
 const lab=el('label','profile-field');lab.append(el('span','profile-field-label',title));
 const input=el(name==='bio'?'textarea':'input','profile-input');input.name=name;
 input.maxLength=max;input.placeholder=placeholder;input.value=value||'';
 if(input.tagName==='TEXTAREA')input.rows=3;else input.autocomplete='off';
 lab.append(input);return lab;
}
function editor(data){const form=el('form','profile-edit');
 form.append(el('h3','','Настройки профиля'),el('p','profile-help','Укажи свои ссылки и оформление. Контакты отображаются в профиле только при заполнении.'));
 const fields=[
 ['О себе','bio','Расскажи о себе и своих биндах',300],
 ['Аватарка (ссылка на изображение)','avatar_url','https://site.example/avatar.webp',320],
 ['Шапка (ссылка на изображение)','banner_url','https://site.example/banner.webp',320],
 ['Telegram','telegram','https://t.me/username',320],
 ['Discord','discord','https://discord.gg/invite',320],
 ['ВКонтакте','vk','https://vk.com/username',320],
 ['Форум Province','forum','https://forum.gtaprovince.ru/forum/...',320]
 ];
 for(const [label,name,placeholder,max] of fields)form.append(profileField(label,name,data[name],placeholder,max));
 const lab=el('label','profile-field');lab.append(el('span','profile-field-label','Цвет шапки без изображения'));
 const select=el('select','profile-input');select.name='banner_theme';for(const [value,label] of [['violet','Фиолетовый'],['blue','Синий'],['rose','Розовый'],['emerald','Изумрудный']]){const opt=el('option','',label);opt.value=value;select.append(opt);}select.value=data.banner_theme||'violet';lab.append(select);form.append(lab);
 const message=el('p','profile-form-message');message.setAttribute('role','status');form.append(message);
 const actions=el('div','profile-edit-actions');const save=el('button','profile-action primary','Сохранить изменения');save.type='submit';const cancel=el('button','profile-action','Отмена');cancel.type='button';cancel.addEventListener('click',()=>form.dispatchEvent(new CustomEvent('profile-editor-close',{bubbles:true})));actions.append(save,cancel);form.append(actions);
 form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;message.textContent='Сохраняем…';const body={};for(const field of fields)body[field[1]]=form.elements[field[1]].value.trim();body.banner_theme=select.value;
 try{const result=await request('/api/auth/profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify(body)});if(window.reconfigSetCurrentAccount)window.reconfigSetCurrentAccount(result.user);await refresh(shown);}
 catch(err){message.textContent=err.message;}finally{save.disabled=false;}});
 return form;
}
function contactButtons(author){const list=el('div','profile-contacts');const items=[['telegram','Telegram'],['discord','Discord'],['vk','ВКонтакте'],['forum','Форум Province']];for(const [key,label] of items){const url=safeContactUrl(author[key],key);if(url){const button=link(url,label,'profile-contact');button.title='Открыть '+label;list.append(button);}}return list;}
function workCard(item,owner){const card=el('article','profile-work');const preview=el('div','profile-work-preview');
 if(item.preview_url&&safeUrl(item.preview_url)){const img=document.createElement('img');img.src=item.preview_url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';preview.append(img);}else preview.append(el('span','','RC'));
 const info=el('div','profile-work-main');info.append(el('strong','',item.title||'Без названия'),el('small','',`${item.category||'Другое'} · ${fmtNumber(item.downloads)} скачиваний`));
 const rating=item.rating||{votes:0,score:0};const rline=el('div','profile-work-rating');rline.append(el('span','profile-work-score',rating.votes?`★ ${Number(rating.score).toFixed(1)} (${rating.votes})`:'☆ Пока нет оценок'));
 const ownerIsCurrent=window.reconfigCurrentAccount?.()?.username?.toLowerCase()===owner.toLowerCase() || (getToken() && sessionStorage.getItem('reconfig_self_user')?.toLowerCase()===owner.toLowerCase());
 const controls=el('div','profile-stars');controls.setAttribute('role','group');controls.setAttribute('aria-label','Оценить работу');for(let n=1;n<=5;n++){const b=el('button','profile-star','★');b.type='button';b.title=`Поставить ${n} из 5`;b.setAttribute('aria-label',b.title);b.onclick=async()=>{if(!getToken()){
   if(window.reconfigRequireAccount){window.reconfigRequireAccount(()=>{void refresh(owner);});return;}
   location.href='rehub.html?auth=1&profile='+encodeURIComponent(owner);return;
 }
 controls.querySelectorAll('button').forEach(x=>x.disabled=true);
 try{await request('/api/ratings/'+encodeURIComponent(item.id),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:JSON.stringify({score:n})});await refresh(owner);}
 catch(err){const fail=el('small','profile-rating-error',err.message);controls.replaceWith(fail);} };controls.append(b);}
 if(!ownerIsCurrent)rline.append(controls);info.append(rline);
 const open=el('a','profile-open-work','Открыть бинд ↗');open.href='rehub.html#config=community:'+encodeURIComponent(item.id);
 card.append(preview,info,open);return card;}
async function refresh(name){const scroll=root.querySelector('.profile-scroll');const oldTop=scroll.scrollTop;scroll.replaceChildren(el('p','profile-loading','Загружаем профиль…'));
 try{const data=await request('/api/authors/'+encodeURIComponent(name));if(shown!==name)return;
 const user=data.author;scroll.replaceChildren();const banner=el('div','profile-banner theme-'+(user.banner_theme||'violet'));
 const coverUrl=safeUrl(user.banner_url);if(coverUrl){const pic=el('img','profile-banner-image');pic.src=coverUrl;pic.alt='';pic.loading='lazy';pic.referrerPolicy='no-referrer';pic.onerror=()=>pic.remove();banner.append(pic);}
 banner.append(el('span','profile-banner-watermark','ReConfig Province'));scroll.append(banner);
 const content=el('div','profile-content');const head=el('div','profile-head');const avatarNode=avatar(user.username,user.avatar_url);const ident=el('div','profile-identity');ident.append(el('span','profile-eyebrow','АВТОР МАСТЕРСКОЙ'));
 const uname=el('div','profile-username');uname.append(el('h2','',user.username));if(user.verified){const verified=el('span','profile-verified','✓');verified.title='Проверенный автор';verified.setAttribute('aria-label','Проверенный автор');uname.append(verified);}ident.append(uname,el('p','profile-subtitle',user.verified?'Проверенный автор ReConfig Province':'Автор сообщества ReConfig Province'));
 head.append(avatarNode,ident);const share=el('button','profile-action profile-share','Скопировать ссылку');share.type='button';share.onclick=()=>{const url=new URL('rehub.html',location.href);url.searchParams.set('profile',user.username);const value=url.href;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>share.textContent='Ссылка скопирована').catch(()=>{share.textContent=value;});else{const temp=document.createElement('textarea');temp.value=value;temp.style.cssText='position:fixed;opacity:0;left:-9999px';document.body.append(temp);temp.select();const copied=document.execCommand('copy');temp.remove();share.textContent=copied?'Ссылка скопирована':value;}};head.append(share);content.append(head);
 if(user.bio)content.append(el('p','profile-bio',user.bio));const contacts=contactButtons(user);if(contacts.childElementCount){content.append(el('h3','profile-small-heading','Контакты'),contacts);}
 const rating=data.rating||{score:null,votes:0};const stats=el('div','profile-stat-grid');stats.append(stat(fmtNumber(data.publications),'Работ'),stat(fmtNumber(data.downloads),'Скачиваний'),stat(rating.votes?`${Number(rating.score).toFixed(1)} / 5`:'—','Оценка автора'),stat(fmtNumber(rating.votes),'Оценок'));
 content.append(stats);
 const own=window.reconfigCurrentAccount?.()?.id===user.id || (getToken()&&window.location.pathname.endsWith('authors.html')&&sessionStorage.getItem('reconfig_self_user')===user.username);
 if(own){const toggle=el('button','profile-action profile-edit-toggle','Редактировать профиль');toggle.type='button';toggle.setAttribute('aria-expanded','false');
 const shell=el('div','profile-edit-shell');const wrap=el('div','profile-edit-reveal');const form=editor(user);form.inert=true;
 wrap.append(form);shell.append(wrap);
 const changeOpen=next=>{shell.classList.toggle('is-open',next);toggle.classList.toggle('is-active',next);toggle.setAttribute('aria-expanded',String(next));toggle.textContent=next?'Свернуть настройки':'Редактировать профиль';form.inert=!next;
 if(next){requestAnimationFrame(()=>{const scroller=root?.querySelector('.profile-scroll');if(!scroller)return;const y=shell.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-65;scroller.scrollTo({top:Math.max(0,y),behavior:'smooth'});});}};
 toggle.addEventListener('click',()=>changeOpen(!shell.classList.contains('is-open')));
 shell.addEventListener('profile-editor-close',()=>changeOpen(false));content.append(toggle,shell);}
 const section=el('section','profile-library');const top=el('div','profile-library-title');top.append(el('h3','','Библиотека работ'),el('span','',`${data.items.length} ${data.items.length%10===1 && data.items.length%100!==11?'публикация':data.items.length%10>=2 && data.items.length%10<=4 && (data.items.length%100<12||data.items.length%100>14)?'публикации':'публикаций'}`));section.append(top);
 if(!data.items.length)section.append(el('p','profile-empty','Здесь пока нет опубликованных биндов.'));
 else{const grid=el('div','profile-work-grid');data.items.forEach(item=>grid.append(workCard(item,user.username)));section.append(grid);}content.append(section);scroll.append(content);
 scroll.scrollTop=oldTop;
 }catch(err){scroll.replaceChildren(el('p','profile-loading',err.message));}}
function show(name){name=String(name||'').trim();if(!validName.test(name))return;
 init();lastFocus=document.activeElement;shown=name;clearTimeout(closeTimer);root.hidden=false;root.classList.remove('is-closing');root.setAttribute('aria-hidden','false');document.body.classList.add('profile-open');root.querySelector('.profile-scroll').scrollTop=0;root.querySelector('.profile-panel').focus({preventScroll:true});void refresh(name);
}
window.reconfigOpenProfile=show;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();const selected=new URLSearchParams(location.search).get('profile');if(selected)show(selected);});
else{init();const selected=new URLSearchParams(location.search).get('profile');if(selected)show(selected);}
})();
