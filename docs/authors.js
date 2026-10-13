/* ReConfig Province · authors directory opens the shared overlay, not another profile page. */
(()=>{'use strict';
const API=String(window.REHUB_API||'').replace(/\/$/,'');const $=id=>document.getElementById(id);
const grid=$('authorsGrid'),search=$('authorsSearch');let items=[];
function element(tag,cls='',text=''){const x=document.createElement(tag);x.className=cls;x.textContent=text;return x;}
function card(user){const a=element('a','authors-card');a.href='rehub.html?profile='+encodeURIComponent(user.username);
 a.addEventListener('click',e=>{e.preventDefault();window.reconfigOpenProfile?.(user.username);});
 const row=element('div','authors-profile-line');const avatar=element('div','authors-avatar',user.username[0].toUpperCase());const imageUrl=user.avatar_url;
 if(typeof imageUrl==='string'&&imageUrl.startsWith('https://')){const img=document.createElement('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();img.onload=()=>avatar.classList.add('has-image');avatar.append(img);}
 const heading=element('div');heading.append(element('strong','',user.username));if(user.verified)heading.append(element('span','account-author-verified','✓'));
 const count=element('small','',`${user.publications||0} публикаций`);heading.append(count);row.append(avatar,heading);a.append(row,element('p','',user.bio||'Автор пользовательских конфигураций'));return a;}
function render(){const value=search.value.trim().toLowerCase();const filtered=items.filter(u=>(u.username+' '+(u.bio||'')).toLowerCase().includes(value));grid.replaceChildren(...filtered.map(card));if(!filtered.length)grid.append(element('p','authors-loading','Авторы не найдены.'));}
async function load(){try{const res=await fetch(API+'/api/authors',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Не удалось загрузить авторов');items=data.authors||[];render();}catch(err){grid.replaceChildren(element('p','authors-loading',err.message));}}
search.addEventListener('input',render);void load();
$('authorsAccountLink')?.addEventListener('click',e=>{const name=sessionStorage.getItem('reconfig_self_user');if(name){e.preventDefault();window.reconfigOpenProfile?.(name);}});
const token=sessionStorage.getItem('reconfig_session_token');if(token){fetch(API+'/api/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{sessionStorage.setItem('reconfig_self_user',data.user.username);$('authorsAccountLabel').textContent=data.user.username;}).catch(()=>{});}
$('authorsLogout')?.addEventListener('click',async()=>{if(token)try{await fetch(API+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch{}sessionStorage.removeItem('reconfig_session_token');sessionStorage.removeItem('reconfig_self_user');location.href='authors.html';});
const legacy=new URLSearchParams(location.search).get('user');if(legacy){const open=()=>window.reconfigOpenProfile?.(legacy);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open);else open();}
})();
