/* ReConfig Province · community reports moderation. */
(()=>{'use strict';
const workspace=document.getElementById('adminWorkspace');if(!workspace)return;
const section=document.createElement('section');section.className='hub-modal admin-community-section reveal';section.id='reportsModeration';
section.innerHTML=`<div class="admin-community-heading"><div><span class="kicker">Сообщество</span><h2>Жалобы на публикации</h2><p>Проверяй обращения пользователей и отмечай результат модерации. Жалоба сама по себе не удаляет публикацию.</p></div><button class="btn btn-secondary interactive" type="button" id="reloadReports">Обновить</button></div><div class="admin-reports-list" id="reportsGrid">Жалобы загрузятся после входа.</div>`;
const community=workspace.querySelector('#communityModeration');if(community)workspace.insertBefore(section,community);else workspace.append(section);
const grid=section.querySelector('#reportsGrid');const reload=section.querySelector('#reloadReports');
const api=String(window.REHUB_API||'').replace(/\/$/,'');
const names={broken:'Не работает / повреждённый XML',inappropriate:'Неподходящее содержание',copyright:'Возможное нарушение авторства',other:'Другое'};
function text(tag,className,value){const node=document.createElement(tag);node.className=className||'';node.textContent=String(value??'');return node;}
async function call(path,options={}){const key=sessionStorage.getItem('rehub_admin_key');if(!key)throw Error('Сначала войди в админку.');
 const r=await fetch(api+path,{cache:'no-store',...options,headers:{Authorization:'Bearer '+key,...options.headers}});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Ошибка API');return data;}
let pending=null;
async function refresh(){if(workspace.hidden)return;if(pending)return pending;
 grid.textContent='Загружаем жалобы…';pending=(async()=>{try{const data=await call('/api/admin/reports');grid.replaceChildren();
  if(!data.reports?.length){grid.textContent='Жалоб пока нет.';return;}
  for(const report of data.reports){const item=text('article','admin-report-item','');
   item.append(text('span','admin-report-status',report.status==='pending'?'Ожидает проверки':report.status==='resolved'?'Рассмотрена':'Отклонена'),text('strong','',report.title),text('small','',`Автор: ${report.author} · Отправитель: ${report.reporter}`),text('small','',`Причина: ${names[report.reason]||'Другое'}`));
   if(report.details)item.append(text('p','',report.details));
   item.append(text('small','',`Отправлено: ${new Date(report.created_at+'Z').toLocaleString('ru-RU')}`));
   const actions=text('div','admin-report-actions','');
   const link=text('a','btn btn-secondary interactive','Открыть бинд');link.href='rehub.html#config=community:'+encodeURIComponent(report.work_id);link.target='_blank';link.rel='noopener noreferrer';actions.append(link);
   for(const [status,label]of [['resolved','Рассмотрена'],['dismissed','Отклонить'],['pending','Вернуть в новые']]){if(report.status===status)continue;
    const btn=text('button','btn btn-secondary interactive',label);btn.type='button';btn.onclick=async()=>{btn.disabled=true;try{await call('/api/admin/reports/'+report.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});await refresh();}catch(err){alert(err.message);btn.disabled=false;}};actions.append(btn);}
   item.append(actions);grid.append(item);}
 }catch(err){grid.textContent=err.message;}})().finally(()=>{pending=null;});return pending;}
reload.addEventListener('click',()=>void refresh());const observer=new MutationObserver(()=>{if(!workspace.hidden)void refresh();});observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});if(!workspace.hidden)void refresh();
})();
