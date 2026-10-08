/* ReHub v29: in-place, accessible Markdown WYSIWYG editor.
   This script only edits client-side presentation. The existing textarea remains the canonical
   Markdown value submitted to ReHub API. No HTML is sent to the server. */
(function () {
  'use strict';
  const htmlEscape = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const trimNewlines = s => s.replace(/^\n+|\n+$/g,'');
  const isBlock = tag => /^(P|DIV|H1|H2|H3|H4|UL|OL|BLOCKQUOTE|PRE|HR)$/.test(tag);

  // Convert only the supported visual markup back to Markdown. All pasted HTML is blocked.
  function inline(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\u00a0/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag=node.tagName;
    if (tag==='BR') return '\n';
    const inner=Array.from(node.childNodes, inline).join('');
    if (tag==='B'||tag==='STRONG') return inner ? `**${inner}**` : '';
    if (tag==='I'||tag==='EM') return inner ? `*${inner}*` : '';
    if (tag==='S'||tag==='STRIKE'||tag==='DEL') return inner ? `~~${inner}~~` : '';
    if (tag==='CODE') return inner ? `\`${inner.replace(/\n/g,' ')}\`` : '';
    if (tag==='A') {
      const href=node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) return `[${inner}](${href.replace(/[()\s]/g,encodeURIComponent)})`;
      return inner;
    }
    return inner;
  }
  function block(node) {
    if(node.nodeType===Node.TEXT_NODE) return inline(node);
    if(node.nodeType!==Node.ELEMENT_NODE) return '';
    const tag=node.tagName;
    if(tag==='BR')return '\n';
    if(/^H[1-4]$/.test(tag))return `${'#'.repeat(Number(tag[1]))} ${inline(node).trim()}\n\n`;
    if(tag==='HR')return '---\n\n';
    if(tag==='UL'||tag==='OL')return [...node.children].filter(el=>el.tagName==='LI').map((li,i)=>`${tag==='UL'?'-':(i+1)+'.'} ${inline(li).trim()}`).join('\n')+'\n\n';
    if(tag==='BLOCKQUOTE')return inline(node).split('\n').map(v=>'> '+v).join('\n')+'\n\n';
    if(tag==='PRE')return '```\n'+node.textContent+'\n```\n\n';
    if(tag==='P'||tag==='DIV') {
      const children=[...node.childNodes];
      // Browser-created divs may contain block elements after pressing Enter.
      if(children.some(x=>x.nodeType===1 && isBlock(x.tagName) && x.tagName!=='BR'))return children.map(block).join('');
      return inline(node).replace(/\n$/,'')+'\n\n';
    }
    return inline(node);
  }
  function toMarkdown(root) {
    return trimNewlines(Array.from(root.childNodes,block).join('').replace(/\n{3,}/g,'\n\n')).replace(/\r/g,'');
  }

  function makeTrack(editor,field) {
    const track=document.createElement('div');track.className='rehub-text-track rehub-rich-scroll-track';track.hidden=true;
    const thumb=document.createElement('div');thumb.className='rehub-text-thumb';track.append(thumb);field.append(track);
    let dragging=false, grab=0, pointer=null;
    const metrics=()=>{
      const total=Math.max(0,editor.scrollHeight-editor.clientHeight);
      const th=Math.min(track.clientHeight,Math.max(25,track.clientHeight*editor.clientHeight/Math.max(editor.scrollHeight,1)));
      return {total,th,travel:Math.max(0,track.clientHeight-th)};
    };
    const sync=()=>{
      track.hidden=editor.scrollHeight<=editor.clientHeight+2 || !editor.getClientRects().length;
      if(track.hidden)return;
      track.style.top=`${editor.offsetTop+7}px`;
      track.style.height=`${Math.max(20,editor.clientHeight-14)}px`;
      const {total,th,travel}=metrics();thumb.style.height=`${th}px`;
      thumb.style.transform=`translate3d(0,${total?editor.scrollTop/total*travel:0}px,0)`;
    };
    const move=y=>{
      const {total,travel}=metrics();if(!travel)return;
      const t=Math.max(0,Math.min(travel,y-track.getBoundingClientRect().top-grab));
      editor.scrollTop=t/travel*total;sync();
    };
    track.addEventListener('wheel',e=>{
      // The overlay scrollbar is a sibling of the editor, so route its wheel here too.
      e.preventDefault();e.stopPropagation();window.cancelPageInertia?.();
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?editor.clientHeight:1);
      editor.scrollTop+=delta;sync();
    },{passive:false});
    track.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;e.preventDefault();e.stopPropagation();dragging=true;pointer=e.pointerId;
      grab=e.target===thumb?e.clientY-thumb.getBoundingClientRect().top:metrics().th/2;
      track.classList.add('dragging');track.setPointerCapture(pointer);
      if(e.target!==thumb)move(e.clientY);
    });
    track.addEventListener('pointermove',e=>{if(dragging&&e.pointerId===pointer){e.preventDefault();move(e.clientY);}}, {passive:false});
    const stop=e=>{if(!dragging||e.pointerId!==pointer)return;dragging=false;track.classList.remove('dragging');if(track.hasPointerCapture(pointer))track.releasePointerCapture(pointer);pointer=null;};
    track.addEventListener('pointerup',stop);track.addEventListener('pointercancel',stop);
    editor.addEventListener('scroll',sync,{passive:true});editor.addEventListener('input',sync);
    if(window.ResizeObserver)new ResizeObserver(sync).observe(editor);
    requestAnimationFrame(sync);
    return sync;
  }

  function attach(textarea,toolbar,renderMarkdown,notify) {
    if(!textarea||!toolbar||textarea.dataset.richReady==='1')return null;
    textarea.dataset.richReady='1';textarea.dataset.roundScroll='1'; // no obsolete textarea track
    const field=textarea.closest('.rehub-markdown-field');
    const editor=document.createElement('div');
    editor.className='rehub-rich-editor';editor.contentEditable='true';editor.spellcheck=true;
    editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Описание публикации');
    editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-required','true');
    editor.dataset.placeholder='Описание: переносы строк, жирный текст, списки и ссылки';
    textarea.classList.add('rehub-rich-source');textarea.required=false;
    textarea.insertAdjacentElement('afterend',editor);
    const form=textarea.closest('form');
    const show=()=>{editor.innerHTML=textarea.value?renderMarkdown(textarea.value):'';requestAnimationFrame(syncTrack);};
    const sync=()=>{const value=toMarkdown(editor);textarea.value=value;textarea.dispatchEvent(new Event('input',{bubbles:true}));};
    const syncTrack=makeTrack(editor,field);
    const selection=()=>{
      const sel=window.getSelection();if(!sel?.rangeCount)return null;
      const range=sel.getRangeAt(0);
      if(!editor.contains(range.commonAncestorContainer))return null;
      return {sel,range};
    };
    const ancestor=(node,tag)=>{
      const el=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
      const candidate=el?.closest(tag);
      return candidate&&editor.contains(candidate)?candidate:null;
    };
    const active=()=>{
      const current=selection();
      const node=current?.range.startContainer;
      const has=selector=>node&&!!ancestor(node,selector);
      const states={bold:has('b,strong'),italic:has('i,em'),heading:has('h1,h2,h3,h4'),list:has('ul,ol'),quote:has('blockquote'),code:has('code'),link:has('a[href]')};
      for(const button of toolbar.querySelectorAll('button[data-md]')){
        const pressed=!!states[button.dataset.md];button.classList.toggle('md-active',pressed);button.setAttribute('aria-pressed',String(pressed));
      }
    };
    const selectNodeText=node=>{
      const sel=getSelection(),range=document.createRange();range.selectNodeContents(node);sel.removeAllRanges();sel.addRange(range);
    };
    const replaceWithText=node=>{
      const text=document.createTextNode(node.textContent);node.replaceWith(text);selectNodeText(text);
    };
    const command=(cmd,value=null)=>document.execCommand(cmd,false,value);
    const insertMarked=(tag,fallback,attrs='')=>{
      const current=selection();if(!current)return;
      const content=current.range.toString()||fallback;
      const markup=`<${tag}${attrs}>${htmlEscape(content)}</${tag}>`;
      command('insertHTML',markup);
      // The inserted element is immediately adjacent to the caret.
      const sel=getSelection();let node=sel.anchorNode;
      const found=ancestor(node,tag);
      if(found)selectNodeText(found);
      else {
        const all=editor.querySelectorAll(tag);if(all.length)selectNodeText(all[all.length-1]);
      }
    };
    const apply=action=>{
      editor.focus({preventScroll:true});
      const current=selection();if(!current)return;
      const start=current.range.startContainer;
      if(action==='bold'||action==='italic'){
        if(current.range.collapsed){insertMarked(action==='bold'?'strong':'em',action==='bold'?'жирный текст':'курсив');}
        else command(action==='bold'?'bold':'italic');
      }else if(action==='heading'){
        command('formatBlock',ancestor(start,'h2')?'p':'h2');
      }else if(action==='list'){
        command('insertUnorderedList');
      }else if(action==='quote'){
        command('formatBlock',ancestor(start,'blockquote')?'p':'blockquote');
      }else if(action==='code'){
        const code=ancestor(start,'code');if(code)replaceWithText(code);
        else insertMarked('code','код');
      }else if(action==='link'){
        const link=ancestor(start,'a[href]');if(link) { replaceWithText(link); }
        else if(current.range.collapsed)insertMarked('a','название ссылки',' href="https://example.com"');
        else command('createLink','https://example.com');
      }
      sync();active();syncTrack();
    };
    // Prevent click on a tool from moving the cursor out of the selected text.
    toolbar.addEventListener('mousedown',e=>{if(e.target.closest('button[data-md]'))e.preventDefault();});
    toolbar.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest('button[data-md]'))e.preventDefault();});
    toolbar.addEventListener('click',e=>{const b=e.target.closest('button[data-md]');if(b){e.preventDefault();e.stopPropagation();apply(b.dataset.md);}});
    editor.addEventListener('input',()=>{sync();active();});
    editor.addEventListener('paste',e=>{
      e.preventDefault();const data=e.clipboardData?.getData('text/plain')||'';
      command('insertText',data);
    });
    editor.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});
    editor.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&['b','i'].includes(e.key.toLowerCase())){
        e.preventDefault();apply(e.key.toLowerCase()==='b'?'bold':'italic');
      }
    });
    document.addEventListener('selectionchange',active);
    editor.addEventListener('keyup',active);editor.addEventListener('mouseup',active);
    editor.addEventListener('focus',active);editor.addEventListener('blur',active);
    // Mouse wheel stays with this scroll area; do not chain to the background page.
    editor.addEventListener('wheel',e=>{window.cancelPageInertia?.();e.stopPropagation();},{passive:true});
    form?.addEventListener('submit',e=>{
      sync();
      if(!editor.textContent.trim()){
        e.preventDefault();e.stopImmediatePropagation();editor.focus();notify?.('Заполни описание.');return;
      }
      if(textarea.value.length>Number(textarea.maxLength||5000)){
        e.preventDefault();e.stopImmediatePropagation();editor.focus();notify?.('Описание длиннее 5000 символов.');
      }
    },true);
    form?.addEventListener('reset',()=>setTimeout(show,0));
    show();
    return {editor,refresh:show,sync,apply};
  }
  window.attachReHubRichEditor=attach;
})();
