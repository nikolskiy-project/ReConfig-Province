/* ReConfig Province: ratings and reports on community publications. */
(()=>{'use strict';
const API=String(window.REHUB_API||'').replace(/\/$/,'');
const token=()=>sessionStorage.getItem('reconfig_session_token')||'';
let sequence=0;
async function call(path,method='GET',data){
 const headers={};if(token())headers.Authorization='Bearer '+token();
 if(data!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(API+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 const json=await response.json().catch(()=>({}));if(!response.ok)throw Error(json.error||'Сервер временно недоступен');return json;
}
function make(tag,cls,text){const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;}
function requireAccount(after){if(token())return true;
 if(window.reconfigRequireAccount)window.reconfigRequireAccount(after||(()=>{}));
 else alert('Для оценки и жалобы необходимо войти.');return false;
}
function show(card){
 let root=document.getElementById('communityFeedback');
 if(!root){root=make('section','community-feedback');root.id='communityFeedback';}
 const modal=document.getElementById('detailModal'),tags=document.getElementById('detailTags'),preview=document.getElementById('detailPreview');
 const oldGroup=modal?.querySelector('.detail-preview-engagement');
 if(oldGroup){const oldBadge=oldGroup.querySelector('#detailPreviewBadge');if(oldBadge)oldGroup.before(oldBadge);oldGroup.remove();}
 modal?.querySelector('.feedback-report-in-preview')?.remove();
 root.replaceChildren();root.hidden=!card?.dataset.communityId;
 if(root.hidden||!tags)return;
 // Tags on the left, ratings on the right: no oversized feedback card.
 let row=tags.closest('.detail-tags-engagement')||tags.parentElement.querySelector('.detail-tags-engagement');
 if(!row){row=make('div','detail-tags-engagement');tags.before(row);}row.append(tags,root);
 const id=card.dataset.communityId,run=++sequence;
 const current=window.reconfigCurrentAccount?.();
 const isOwner=Boolean(current && ((current.id && card.dataset.authorUserId===String(current.id)) || (current.username && card.dataset.authorUsername?.toLowerCase()===String(current.username).toLowerCase())));
 const ratingArea=make('div','feedback-rating-area');
 const summary=make('span','community-feedback-summary','');
 summary.title='Средняя оценка пользователей';
 const stars=make('div','community-feedback-stars');stars.setAttribute('role','group');stars.setAttribute('aria-label','Выбрать вашу оценку');stars.title='Ваша оценка — нажмите на звезду';
 ratingArea.append(summary,stars);root.append(ratingArea);
 const reportToggle=make('button','feedback-report-in-preview','');reportToggle.type='button';reportToggle.title='Пожаловаться на бинд';reportToggle.setAttribute('aria-label','Пожаловаться на бинд');
 reportToggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01"/><path d="m10 3 11 18H3L14 3z"/></svg>';
 // Report form stays below the tags; the trigger is next to 'Сообщество'.
 const message=make('p','community-feedback-message');message.setAttribute('role','status');
 let existingReport=modal?.querySelector('.community-feedback-report-host');existingReport?.remove();
 const reportHost=make('div','community-feedback-report-host');reportHost.hidden=true;
 const form=make('form','community-feedback-report');
 const title=make('h3','','Жалоба на публикацию');
 const reasons=make('div','community-feedback-reasons');const choices=[['broken','Бинд не работает'],['inappropriate','Неподходящее содержание'],['copyright','Чужая работа'],['other','Другое']];let selected='broken';
 const buttons=[];for(const [value,label]of choices){const b=make('button','',label);b.type='button';b.onclick=()=>{selected=value;buttons.forEach(x=>x.classList.toggle('selected',x===b));};if(value===selected)b.classList.add('selected');buttons.push(b);reasons.append(b);}
 const details=make('textarea','','');details.maxLength=450;details.placeholder='Комментарий (при желании)';details.setAttribute('aria-label','Комментарий к жалобе');
 const send=make('button','feedback-submit','Отправить жалобу');send.type='submit';form.append(title,reasons,details,send);reportHost.append(form,message);
 row.after(reportHost);
 const badge=preview?.querySelector('#detailPreviewBadge');
 if(badge){const group=make('div','detail-preview-engagement');badge.before(group);group.append(badge,reportToggle);}
 reportToggle.onclick=()=>{if(!requireAccount(()=>show(card)))return;reportHost.hidden=!reportHost.hidden;reportToggle.setAttribute('aria-expanded',String(!reportHost.hidden));if(!reportHost.hidden)reportHost.scrollIntoView({block:'nearest',behavior:'smooth'});};
 form.onsubmit=async e=>{e.preventDefault();if(!requireAccount(()=>show(card)))return;send.disabled=true;message.textContent='Отправляем…';try{await call('/api/reports/'+id,'POST',{reason:selected,details:details.value});reportHost.hidden=true;reportToggle.disabled=true;reportToggle.title='Жалоба отправлена';message.textContent='Жалоба передана модераторам.';}catch(err){message.textContent=err.message;reportHost.hidden=false;}finally{send.disabled=false;}};
 function paint(stats){const rating=stats.rating||{votes:0,score:0};
  const avg=Math.max(0,Math.min(5,Number(rating.score)||0));
  summary.innerHTML='<span class="feedback-visual-stars" aria-hidden="true"><span>★★★★★</span><span class="feedback-visual-fill" style="width:'+((avg/5)*100).toFixed(1)+'%">★★★★★</span></span>';
  summary.setAttribute('aria-label',rating.votes?`Рейтинг ${avg.toFixed(1)}, ${rating.votes} оценок`:'Оценок пока нет');
  summary.title=rating.votes?`${avg.toFixed(1)} · ${rating.votes} оценок`:'Нет оценок';stars.replaceChildren();
  const readOnly=isOwner || (stats.can_rate===false && Boolean(token()));
  stars.hidden=readOnly;stars.setAttribute('aria-hidden',String(readOnly));
  if(readOnly)return;
  for(let n=1;n<=5;n++){const b=make('button',n<=(stats.my_score||0)?'selected':'','★');b.dataset.value=String(n);b.type='button';b.title='Оценить: '+n+' звёзд';b.setAttribute('aria-label',b.title);b.addEventListener('pointerenter',()=>stars.classList.add('is-previewing'));b.addEventListener('pointerenter',()=>stars.querySelectorAll('button').forEach(x=>x.classList.toggle('preview-selected',Number(x.dataset.value)<=n)));
    b.onclick=async()=>{if(!requireAccount(()=>show(card)))return;if(!stats.can_rate){summary.title='Нельзя оценить собственную работу';return;}
     stars.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{const next=await call('/api/ratings/'+id,'POST',{score:n});stats={...stats,...next,my_score:n};paint(stats);const label=card.querySelector('.thumb-rating');if(label){label.textContent='★ '+Number(stats.rating.score).toFixed(1);} }catch(err){summary.title=err.message;stars.querySelectorAll('button').forEach(b=>b.disabled=false);}};stars.append(b);}
  stars.onpointerleave=()=>{stars.classList.remove('is-previewing');stars.querySelectorAll('button').forEach(x=>x.classList.remove('preview-selected'));};
 }
 paint({rating:{score:Number(card.dataset.ratingScore)||0,votes:Number(card.dataset.ratingVotes)||0},my_score:0,can_rate:!isOwner && !token()});
 call('/api/ratings/'+id).then(data=>{if(run===sequence&&root.isConnected)paint(data);}).catch(err=>{if(run===sequence)summary.title=err.message;});
}

window.reconfigShowFeedback=show;
})();
