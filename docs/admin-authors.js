(()=>{'use strict';
const root=document.getElementById('adminAuthorGrid');const refresh=document.getElementById('reloadAuthors');
if(!root||!refresh)return;
const api=String(window.REHUB_API||'').replace(/\/$/,'');
function itemText(el,s){el.textContent=s;return el;}
async function call(path,options={}){const key=sessionStorage.getItem('rehub_admin_key');if(!key)throw Error('Сначала войди в админку.');
const r=await fetch(api+path,{...options,headers:{Authorization:'Bearer '+key,...options.headers}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Ошибка API');return data;}
async function load(){root.classList.add('admin-authors-list');root.textContent='Загружаю авторов…';try{const d=await call('/api/admin/authors');
 root.replaceChildren();if(!d.authors?.length){root.textContent='Зарегистрированных авторов пока нет.';return;}
 for(const author of d.authors){const card=document.createElement('div');card.className='admin-author-item';
 const name=itemText(document.createElement('strong'),author.username);const meta=itemText(document.createElement('small'),author.verified?'✓ Проверенный автор':'Обычный автор');
 const btn=document.createElement('button');btn.type='button';btn.className='btn btn-secondary interactive';btn.textContent=author.verified?'Снять галочку':'Выдать галочку';
 btn.addEventListener('click',async()=>{btn.disabled=true;try{await call('/api/admin/authors/'+encodeURIComponent(author.username)+'/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verified:!author.verified})});await load();}
 catch(err){alert(err.message);btn.disabled=false;}});
 card.append(name,meta,btn);root.append(card);}}
 catch(e){root.textContent=e.message;}}
refresh.addEventListener('click',load);
// The legacy admin login controls a hidden workspace; populate only after login.
const workspace=document.getElementById('adminWorkspace');
const observer=new MutationObserver(()=>{if(workspace&&!workspace.hidden)void load();});
if(workspace){observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});if(!workspace.hidden)void load();}
})();
