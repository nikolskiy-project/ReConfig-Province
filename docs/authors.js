/* ReConfig Province · authors directory opens the shared overlay, not another profile page. */
(()=>{'use strict';
const API=String(window.REHUB_API||'').replace(/\/$/,'');const $=id=>document.getElementById(id);
const grid=$('authorsGrid'),search=$('authorsSearch');let items=[];
function element(tag,cls='',text=''){const x=document.createElement(tag);x.className=cls;x.textContent=text;return x;}
function card(user){
 const a=element('a','authors-card');a.href='rehub.html?profile='+encodeURIComponent(user.username);
 a.addEventListener('click',e=>{e.preventDefault();window.reconfigOpenProfile?.(user.username);});
 const row=element('div','authors-profile-line');const avatar=element('div','authors-avatar',user.username[0].toUpperCase());
 const imageUrl=user.avatar_url;
 if(typeof imageUrl==='string'&&imageUrl.startsWith('https://')){const img=document.createElement('img');img.src=imageUrl;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();img.onload=()=>avatar.classList.add('has-image');avatar.append(img);}
 const heading=element('div','authors-card-heading');const name=element('div','authors-card-name');name.append(element('strong','',user.username));if(user.verified)name.append(element('span','account-author-verified','✓'));heading.append(name,element('p','authors-card-bio',user.bio||'Автор игровых биндов'));
 row.append(avatar,heading);a.append(row);
 const info=element('div','authors-card-stats');
 for(const [value,label] of [[user.publications||0,'работ'],[Number(user.downloads||0).toLocaleString('ru-RU'),'скачиваний'],[Number(user.rating?.votes)>0?'★ '+Number(user.rating.score).toFixed(1):'☆ —','рейтинг']]){
 const part=element('span','authors-card-stat');part.append(element('b','',String(value)),document.createTextNode(' '+label));info.append(part);}
 a.append(info);return a;}
function render(){const value=search.value.trim().toLowerCase();const filtered=items.filter(u=>(u.username+' '+(u.bio||'')).toLowerCase().includes(value));grid.replaceChildren(...filtered.map(card));if(!filtered.length)grid.append(element('p','authors-loading','Авторы не найдены.'));}
async function load(){try{const res=await fetch(API+'/api/authors',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error||'Не удалось загрузить авторов');items=data.authors||[];render();}catch(err){grid.replaceChildren(element('p','authors-loading',err.message));}}
search.addEventListener('input',render);void load();
// Keep the creator directory in sync after moderation, without refreshing the page.
let authorsRefreshBusy=false;
async function updateAuthorsSilently(){
 if(authorsRefreshBusy||document.visibilityState==='hidden')return;
 authorsRefreshBusy=true;
 try{
  const res=await fetch(API+'/api/authors',{cache:'no-store'});
  if(!res.ok)return;
  const next=(await res.json()).authors||[];
  const signature=values=>JSON.stringify(values.map(u=>[u.id,u.username,u.publications,u.downloads,u.rating?.score,u.rating?.votes,u.verified,u.avatar_url,u.bio]));
  if(signature(next)!==signature(items)){items=next;render();}
 }catch{}finally{authorsRefreshBusy=false;}
}
setInterval(updateAuthorsSilently,35000);
window.addEventListener('reconfig:community-changed',()=>void updateAuthorsSilently());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void updateAuthorsSilently();});
$('authorsAccountLink')?.addEventListener('click',e=>{const name=sessionStorage.getItem('reconfig_self_user');if(name){e.preventDefault();window.reconfigOpenProfile?.(name);}});
const token=sessionStorage.getItem('reconfig_session_token');if(token){fetch(API+'/api/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{sessionStorage.setItem('reconfig_self_user',data.user.username);$('authorsAccountLabel').textContent=data.user.username;}).catch(()=>{});}
$('authorsLogout')?.addEventListener('click',async()=>{if(token)try{await fetch(API+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+token}})}catch{}sessionStorage.removeItem('reconfig_session_token');sessionStorage.removeItem('reconfig_self_user');location.href='authors.html';});
const legacy=new URLSearchParams(location.search).get('user');if(legacy){const open=()=>window.reconfigOpenProfile?.(legacy);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open);else open();}
})();
