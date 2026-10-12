(()=>{'use strict';
const api=String(window.REHUB_API||'').replace(/\/$/,'');const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);const selected=query.get('user')||'';
const token=sessionStorage.getItem('reconfig_session_token')||'';
const grid=$('authorsGrid');let cards=[];
function text(tag,value,className=''){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function err(msg){grid.replaceChildren(text('p',msg,'authors-loading'));}
async function get(path,headers={}){const r=await fetch(api+path,{cache:'no-store',headers:{Accept:'application/json',...headers}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Не удалось получить данные');return data;}
function personCard(person){const a=document.createElement('a');a.href='authors.html?user='+encodeURIComponent(person.username);a.className='authors-card';
 const heading=document.createElement('strong');heading.textContent=person.username;
 if(person.verified){const badge=text('span',' ✓','account-author-verified');badge.title='Проверенный автор';heading.append(' ',badge);}
 a.append(heading,text('p',person.bio||'Автор пользовательских конфигураций'),text('small',`${person.publications||0} публикаций`));return a;}
function workCard(item){const a=document.createElement('a');a.className='authors-card';a.href='rehub.html#config=community:'+encodeURIComponent(item.id);
 // Use stable same-site hash already supported by ReHub card sharing.
 if(item.preview_url && /^https:\/\//.test(item.preview_url)){const img=document.createElement('img');img.className='authors-card-cover';img.src=item.preview_url;img.alt='';img.loading='lazy';a.append(img);}
 a.append(text('strong',item.title||'Без названия'),text('p',(item.description||'').slice(0,155)),text('small',`${item.downloads||0} скачиваний · ${item.category||'Другое'}`));return a;}
async function refreshMe(){if(!token)return;try{const {user}=await get('/api/auth/me',{Authorization:'Bearer '+token});
 $('authorsAccountLabel').textContent=user.username;$('authorsAccountLink').setAttribute('aria-label','Профиль '+user.username);$('authorsAccountLink').href='authors.html?user='+encodeURIComponent(user.username);
 if(selected && selected.toLowerCase()===user.username.toLowerCase()){$('authorsMyControls').hidden=false;}
}catch{sessionStorage.removeItem('reconfig_session_token');}}
$('authorsLogout').addEventListener('click',async()=>{try{await fetch(api+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch(_){}
 sessionStorage.removeItem('reconfig_session_token');location.href='authors.html';});
async function load(){try{
 if(selected){if(!/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(selected))throw Error('Некорректный логин.');
 const data=await get('/api/authors/'+encodeURIComponent(selected));const author=data.author;
 $('authorsTitle').textContent=author.username;
 $('authorsSubtitle').textContent=author.verified?'Проверенный автор ReConfig Province':'Автор сообщества ReConfig Province';
 const hero=$('authorHero');hero.replaceChildren();const wrap=document.createElement('div');wrap.className='authors-profile-line';
 const avatar=text('div',author.username[0].toUpperCase(),'authors-avatar');const details=document.createElement('div');
 details.append(text('span','Профиль автора','kicker'),text('h1',author.username),text('p',author.verified?'Проверенный автор ReConfig Province':'Автор пользовательских биндов'));
 if(author.verified)details.append(text('span','✓ Проверенный автор','authors-badge'));
 wrap.append(avatar,details);const stats=document.createElement('div');stats.className='authors-stats';
 for(const [num,label] of [[data.publications,'Публикаций'],[data.downloads,'Скачиваний']]){const e=document.createElement('div');e.className='authors-stat';e.append(text('strong',String(num)),text('span',label));stats.append(e);}hero.append(wrap,stats);
 $('authorsLibraryTitle').textContent='Библиотека автора';$('authorsSearch').placeholder='Найти бинд…';cards=data.items.map(workCard);
 $('authorsSearch').addEventListener('input',()=>filter(data.items, true));
 }else {const data=await get('/api/authors');cards=data.authors.map(personCard);
 $('authorsSearch').addEventListener('input',()=>filter(data.authors,false));}
 if(!cards.length)err('Пока нет опубликованных работ.');else grid.replaceChildren(...cards);
 }catch(e){err(e.message);}}
function filter(items, works){const query=$('authorsSearch').value.toLowerCase().trim();const selected=items.filter(x=>`${x.title||''} ${x.description||''} ${x.username||''} ${x.category||''}`.toLowerCase().includes(query));
 if(!selected.length){err('Ничего не найдено.');return;}grid.replaceChildren(...selected.map(works?workCard:personCard));}
void Promise.all([load(),refreshMe()]);
})();
