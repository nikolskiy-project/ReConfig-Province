/* ReConfig Province shared cursor — author directory. */
(()=>{'use strict';
if(!matchMedia('(pointer:fine)').matches||innerWidth<900||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const dot=document.getElementById('cursorDot'),ring=document.getElementById('cursorRing'),glow=document.getElementById('cursorGlow');if(!dot||!ring||!glow)return;
let mx=innerWidth/2,my=innerHeight/2,dx=mx,dy=my,rx=mx,ry=my,gx=mx,gy=my,visible=false;
document.addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;visible=true;document.body.classList.add('cursor-active');},{passive:true});
document.addEventListener('pointerleave',()=>{visible=false;document.body.classList.remove('cursor-active');});
document.addEventListener('pointerover',e=>{document.body.classList.toggle('cursor-hover',!!e.target.closest('a,button,.authors-card,[role="button"]'));});
document.addEventListener('pointerout',e=>{if(!e.relatedTarget)document.body.classList.remove('cursor-hover');});
function frame(){if(document.hidden){requestAnimationFrame(frame);return;}dx+=(mx-dx)*.46;dy+=(my-dy)*.46;rx+=(mx-rx)*.135;ry+=(my-ry)*.135;gx+=(mx-gx)*.045;gy+=(my-gy)*.045;dot.style.transform=`translate3d(${dx}px,${dy}px,0)`;ring.style.transform=`translate3d(${rx}px,${ry}px,0)`;glow.style.transform=`translate3d(${gx}px,${gy}px,0)`;requestAnimationFrame(frame);}frame();
})();
