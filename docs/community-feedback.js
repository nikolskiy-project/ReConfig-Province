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
 if(!root){root=make('section','community-feedback');root.id='communityFeedback';document.querySelector('#detailModal .detail-copy .detail-actions')?.before(root);}
 if(!root)return;
 root.replaceChildren();root.hidden=!card?.dataset.communityId;if(root.hidden)return;
 const id=card.dataset.communityId,run=++sequence;
 const head=make('h3','','Оценки и обратная связь');
 const summary=make('p','community-feedback-summary','Загружаем оценки…');
 const line=make('div','community-feedback-stars');line.setAttribute('role','group');line.setAttribute('aria-label','Оценить публикацию');
 const message=make('p','community-feedback-message');message.setAttribute('role','status');
 const reportToggle=make('button','feedback-report-toggle','Пожаловаться на публикацию');reportToggle.type='button';
 const report=make('form','community-feedback-report');report.hidden=true;
 const reasons=make('div','community-feedback-reasons');const choices=[['broken','Бинд не работает'],['inappropriate','Неподходящее содержание'],['copyright','Чужая работа'],['other','Другое']];let selected='broken';
 const reasonsButtons=[];
 for(const [value,label]of choices){const btn=make('button','',label);btn.type='button';btn.onclick=()=>{selected=value;for(const b of reasonsButtons)b.classList.toggle('selected',b===btn);};if(value===selected)btn.classList.add('selected');reasons.append(btn);reasonsButtons.push(btn);}
 const details=make('textarea','','');details.maxLength=450;details.placeholder='Комментарий к жалобе (необязательно, кроме «Другое»)';details.setAttribute('aria-label','Комментарий к жалобе');
 const send=make('button','feedback-submit','Отправить жалобу');send.type='submit';report.append(reasons,details,send);
 reportToggle.onclick=()=>{if(!requireAccount(()=>show(card)))return;report.hidden=!report.hidden;reportToggle.setAttribute('aria-expanded',String(!report.hidden));};
 report.onsubmit=async event=>{event.preventDefault();if(!requireAccount(()=>show(card)))return;send.disabled=true;message.textContent='Отправляем жалобу…';try{await call('/api/reports/'+id,'POST',{reason:selected,details:details.value});report.hidden=true;reportToggle.disabled=true;reportToggle.textContent='Жалоба отправлена';message.textContent='Спасибо, жалоба передана на проверку.';}catch(error){message.textContent=error.message;}finally{send.disabled=false;}};
 root.append(head,summary,line,reportToggle,report,message);
 function paint(stats){summary.textContent=stats.rating?.votes?`★ ${Number(stats.rating.score).toFixed(1)} из 5 · ${stats.rating.votes} оценок`:'У работы пока нет оценок';line.replaceChildren();
   for(let n=1;n<=5;n++){const btn=make('button',n<=(stats.my_score||0)?'selected':'','★');btn.type='button';btn.title=`Оценить на ${n} из 5`;btn.setAttribute('aria-label',btn.title);
     btn.onclick=async()=>{if(!requireAccount(()=>show(card)))return;if(!stats.can_rate){message.textContent='Собственную работу оценивать нельзя.';return;}
       for(const child of line.children)child.disabled=true;try{const next=await call('/api/ratings/'+id,'POST',{score:n});stats={...stats,...next,my_score:n};paint(stats);message.textContent='Оценка сохранена.';}catch(err){message.textContent=err.message;for(const child of line.children)child.disabled=false;}};line.append(btn);}
 }
 call('/api/ratings/'+id).then(data=>{if(run===sequence&&root.isConnected)paint(data);}).catch(err=>{if(run===sequence)summary.textContent=err.message;});
}
window.reconfigShowFeedback=show;
})();
