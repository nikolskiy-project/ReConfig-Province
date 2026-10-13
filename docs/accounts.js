/* ReConfig Province account UI. Token intentionally stored in sessionStorage only. */
(()=>{
  'use strict';
  const api=String(window.REHUB_API||'').replace(/\/$/,'');
  const $=id=>document.getElementById(id);
  const key='reconfig_session_token';
  let token=sessionStorage.getItem(key)||'';
  let account=null;
  let onSignedIn=null;
  let mode='login';
  let hideTimer=null;
  const overlay=$('accountOverlay'), form=$('accountForm'), openButton=$('openAccount');
  if(!overlay||!form)return;
  function error(text=''){$('accountError').textContent=text;$('accountError').hidden=!text;}
  function setMode(next){mode=next;form.reset();error();$('accountDialogTitle').textContent=mode==='register'?'Создать профиль':'Вход в мастерскую';
    document.querySelectorAll('[data-account-mode]').forEach(b=>b.classList.toggle('active',b.dataset.accountMode===mode));
    document.querySelector('.account-tabs')?.classList.toggle('second-active',mode==='register');
    form.classList.remove('account-mode-anim');void form.offsetWidth;form.classList.add('account-mode-anim');
    const confirm=document.querySelector('.account-confirm');confirm.hidden=mode!=='register';confirm.querySelector('input').required=mode==='register';
    form.elements.password.autocomplete=mode==='register'?'new-password':'current-password';
    form.querySelector('.account-submit').textContent=mode==='register'?'Зарегистрироваться':'Войти';}
  function show(){clearTimeout(hideTimer);overlay.classList.remove('is-closing');overlay.hidden=false;overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
  function hide(){overlay.classList.add('is-closing');overlay.setAttribute('aria-hidden','true');document.body.style.overflow='';error();clearTimeout(hideTimer);hideTimer=setTimeout(()=>{overlay.hidden=true;overlay.classList.remove('is-closing');},205);}
  function render(){if(openButton){const label=$('accountButtonLabel');if(label)label.textContent=account?account.username:'Войти';openButton.setAttribute('aria-label',account?('Профиль '+account.username):'Войти в аккаунт');}const author=document.querySelector('#uploadForm input[name="author"]');
    if(author){author.value=account?.username||'';author.readOnly=true;author.title='Автор устанавливается по аккаунту';}}
  async function call(path,body){const res=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));if(!res.ok){const message=data.error === 'Internal error' ? 'Ошибка API. Проверьте подключение D1 и обновление Worker.' : (data.error||'Ошибка сервера');throw new Error(data.request_id ? message+' Код: '+data.request_id : message);}return data;}
  function update(data){token=data.token;account=data.user;sessionStorage.setItem(key,token);sessionStorage.setItem('reconfig_self_user',account.username);render();hide();
    onSignedIn=null;}
  window.reconfigCurrentAccount=()=>account;
  window.reconfigSetCurrentAccount=next=>{account=next;if(!next){token='';sessionStorage.removeItem('reconfig_session_token');sessionStorage.removeItem('reconfig_self_user');}render();};
  window.reconfigAccountToken=()=>token;
  window.reconfigRequireAccount=callback=>{if(account){callback();return}onSignedIn=callback;setMode('login');show();};
  openButton?.addEventListener('click',()=>{if(account){if(window.reconfigOpenProfile)window.reconfigOpenProfile(account.username);else location.href='rehub.html?profile='+encodeURIComponent(account.username);return;}setMode('login');show();});
  $('accountClose')?.addEventListener('click',()=>{onSignedIn=null;hide();});
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)hide();});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden){hide();e.stopPropagation();}});
  document.querySelectorAll('[data-account-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.accountMode)));
  form.addEventListener('submit',async e=>{
    e.preventDefault();error();const username=String(form.elements.username.value||'').trim();const password=String(form.elements.password.value||'');
    if(mode==='register'&&password!==form.elements.confirm.value){error('Пароли не совпадают.');return;}
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{const data=await call('/api/auth/'+mode,{username,password});const next=onSignedIn;update(data);next?.();}
    catch(err){error(err.message);}finally{submit.disabled=false;}
  });
  const restore=async()=>{
    if(!token){render();return;}
    try{const r=await fetch(api+'/api/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error();
      account=(await r.json()).user;sessionStorage.setItem('reconfig_self_user',account.username);render();}
    catch{token='';account=null;sessionStorage.removeItem(key);render();}
  };
  void restore().then(()=>{if(location.search.includes('auth=1')&&!account){setMode('login');show();}});
})();
