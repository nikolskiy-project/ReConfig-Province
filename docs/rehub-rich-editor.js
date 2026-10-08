/* ReHub v32: in-place, accessible Markdown WYSIWYG editor.
   This script only edits client-side presentation. The existing textarea remains the canonical
   Markdown value submitted to ReHub API. No HTML is sent to the server. */
(function () {
  'use strict';
  const trimNewlines = s => s.replace(/^\n+|\n+$/g,'');
  const isBlock = tag => /^(P|DIV|H1|H2|H3|H4|UL|OL|BLOCKQUOTE|PRE|HR)$/.test(tag);

  // Convert only the supported visual markup back to Markdown. All pasted HTML is blocked.
  function inline(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/[\u00a0\u200b]/g, ch => ch==='\u00a0'?' ':'');
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
    editor.className='rehub-rich-editor interactive';editor.contentEditable='true';editor.spellcheck=true;
    editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Описание публикации');
    editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-required','true');
    editor.dataset.placeholder='Описание: переносы строк, жирный текст, списки и ссылки';
    textarea.classList.add('rehub-rich-source');textarea.required=false;textarea.tabIndex=-1;
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
    // A floating link editor is rendered above the text itself, not in a separate toolbar.
    // The selection range is saved before focusing the inputs; link creation is committed
    // only on Save, so cancelling cannot leave a placeholder URL in the Markdown.
    const linkPopup=document.createElement('div');
    linkPopup.className='rehub-link-popup';
    linkPopup.hidden=true;
    linkPopup.setAttribute('role','dialog');
    linkPopup.setAttribute('aria-label','Редактировать ссылку');
    linkPopup.innerHTML=`
      <div class="rehub-link-popup-title">Ссылка</div>
      <label class="rehub-link-popup-label">Текст <input data-link-text type="text" maxlength="500" autocomplete="off" placeholder="Название ссылки"></label>
      <label class="rehub-link-popup-label">Адрес <input data-link-url type="url" spellcheck="false" autocomplete="off" placeholder="https://example.com"></label>
      <div class="rehub-link-popup-error" data-link-error role="status" hidden></div>
      <div class="rehub-link-popup-actions">
        <button type="button" data-link-remove class="rehub-link-remove" hidden>Убрать ссылку</button>
        <span class="rehub-link-popup-spacer"></span>
        <button type="button" data-link-cancel>Отмена</button>
        <button type="button" data-link-save class="rehub-link-save">Сохранить</button>
      </div>`;
    document.body.append(linkPopup);
    const textInput=linkPopup.querySelector('[data-link-text]');
    const urlInput=linkPopup.querySelector('[data-link-url]');
    const removeButton=linkPopup.querySelector('[data-link-remove]');
    const error=linkPopup.querySelector('[data-link-error]');
    let editingLink=null,linkRange=null,anchorRect=null;
    const positionLinkPopup=()=>{
      if(linkPopup.hidden)return;
      const rect=editingLink?.isConnected?editingLink.getBoundingClientRect():
        linkRange?.getBoundingClientRect()||anchorRect;
      if(!rect)return;
      const w=linkPopup.offsetWidth,h=linkPopup.offsetHeight;
      const center=rect.left+rect.width/2;
      const left=Math.max(8,Math.min(window.innerWidth-w-8,center-w/2));
      const below=rect.top-h-11<8;
      const top=below?Math.min(window.innerHeight-h-8,rect.bottom+11):rect.top-h-11;
      linkPopup.classList.toggle('below',below);
      linkPopup.style.left=`${left}px`;
      linkPopup.style.top=`${Math.max(8,top)}px`;
      linkPopup.style.setProperty('--link-arrow-x',`${Math.max(14,Math.min(w-14,center-left))}px`);
    };
    const closeLinkPopup=({restore=false}={})=>{
      if(linkPopup.hidden)return;
      const oldLink=editingLink,oldRange=linkRange;
      linkPopup.hidden=true;linkPopup.classList.remove('below');
      editingLink=null;linkRange=null;anchorRect=null;
      error.hidden=true;error.textContent='';
      if(restore){
        editor.focus({preventScroll:true});
        if(oldLink?.isConnected)caretAfter(oldLink);
        else if(oldRange){
          try{const s=getSelection();s.removeAllRanges();s.addRange(oldRange);}catch(_){}
        }
        active();
      }
    };
    const openLinkPopup=(link=null,range=null)=>{
      if(!link && !range)return;
      editingLink=link;
      linkRange=range?.cloneRange()||null;
      anchorRect=linkRange?.getBoundingClientRect()||null;
      textInput.value=link?link.textContent:range.toString()||'';
      urlInput.value=link?link.getAttribute('href')||'':'';
      removeButton.hidden=!link;
      error.hidden=true;error.textContent='';
      linkPopup.hidden=false;
      positionLinkPopup();
      (link?urlInput:(textInput.value?urlInput:textInput)).focus({preventScroll:true});
    };
    const validUrl=raw=>{
      const value=raw.trim();
      if(!value)return null;
      const candidate=/^[a-z][a-z0-9+.-]*:/i.test(value)?value:`https://${value}`;
      try{const parsed=new URL(candidate);return /^(https?:)$/.test(parsed.protocol)&&parsed.hostname?parsed.href:null;}
      catch(_){return null;}
    };
    const saveLink=()=>{
      const label=textInput.value.trim(),url=validUrl(urlInput.value);
      if(!label||!url){
        error.textContent=!label?'Укажите текст ссылки.':'Укажите корректный адрес http(s).';
        error.hidden=false;positionLinkPopup();
        (!label?textInput:urlInput).focus();return;
      }
      if(editingLink?.isConnected){
        // Preserve existing bold/italic inside a link if only its URL changed.
        if(editingLink.textContent!==label)editingLink.textContent=label;
        editingLink.setAttribute('href',url);
        const link=editingLink;
        closeLinkPopup();editor.focus({preventScroll:true});caretAfter(link);
      }else if(linkRange){
        // Restore the original range after the popup took keyboard focus.
        const range=linkRange.cloneRange();
        closeLinkPopup();editor.focus({preventScroll:true});
        const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
        const mark=document.createElement('a');mark.href=url;
        const originalText=range.toString();
        const content=range.extractContents();
        if(label===originalText && content.hasChildNodes())mark.append(content);
        else mark.textContent=label;
        range.insertNode(mark);caretAfter(mark);
      }else {closeLinkPopup();return;}
      sync();active();syncTrack();
    };
    const removeLink=()=>{
      const link=editingLink;
      if(!link?.isConnected)return;
      const nodes=Array.from(link.childNodes),last=nodes[nodes.length-1];
      link.replaceWith(...nodes);
      closeLinkPopup();editor.focus({preventScroll:true});
      if(last?.isConnected)caretAfter(last);
      sync();active();syncTrack();
    };
    linkPopup.querySelector('[data-link-save]').addEventListener('click',saveLink);
    linkPopup.querySelector('[data-link-cancel]').addEventListener('click',()=>closeLinkPopup({restore:true}));
    removeButton.addEventListener('click',removeLink);
    linkPopup.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeLinkPopup({restore:true});}
      else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveLink();}
    });
    // Outside clicks only dismiss the popup; they never remove the edited link.
    document.addEventListener('pointerdown',e=>{
      if(linkPopup.hidden || linkPopup.contains(e.target))return;
      if(editor.contains(e.target)&&e.target.closest?.('a[href]'))return;
      closeLinkPopup();
    },true);
    editor.addEventListener('scroll',positionLinkPopup,{passive:true});
    window.addEventListener('scroll',positionLinkPopup,{passive:true});
    window.addEventListener('resize',positionLinkPopup,{passive:true});
    field.closest('.hub-upload-scroll,.admin-editor,.hub-modal')?.addEventListener('scroll',positionLinkPopup,{passive:true});
    const command=(cmd,value=null)=>document.execCommand(cmd,false,value);
    // In-place caret boundary for inline formatting: the next character is plain
    // text, never inserted inside the recently formatted fragment.
    const caretAfter=node=>{
      const r=document.createRange(),sel=getSelection();
      const following=node.nextSibling?.nodeType===Node.TEXT_NODE?node.nextSibling:document.createTextNode('');
      if(!following.isConnected)node.after(following);
      if(!following.data.startsWith('\u200b'))following.insertData(0,'\u200b');
      r.setStart(following,1);
      r.collapse(true);sel.removeAllRanges();sel.addRange(r);
    };
    const markSelected=(tag,fallback,attrs={})=>{
      const current=selection();if(!current)return;
      const range=current.range;
      const mark=document.createElement(tag);
      for(const [key,value] of Object.entries(attrs))mark.setAttribute(key,value);
      if(range.collapsed){mark.textContent=fallback;range.insertNode(mark);}
      else {
        const fragment=range.extractContents();mark.append(fragment);range.insertNode(mark);
      }
      caretAfter(mark);
    };
    const unmarkSelected=(mark,range)=>{
      // Split the style into leading styled / selected unstyled / trailing styled.
      // This also allows toggling part of a word without unformatting its neighbours.
      const before=document.createRange();before.selectNodeContents(mark);
      const after=document.createRange();after.selectNodeContents(mark);
      try {before.setEnd(range.startContainer,range.startOffset);after.setStart(range.endContainer,range.endOffset);} catch(_) {return false;}
      const a=before.cloneContents(),mid=range.cloneContents(),z=after.cloneContents();
      const parts=[],lead=mark.cloneNode(false),tail=mark.cloneNode(false);
      if(before.toString()){lead.append(a);parts.push(lead);}
      let trailingNode=null;
      while(mid.firstChild){trailingNode=mid.firstChild;parts.push(mid.removeChild(mid.firstChild));}
      if(after.toString()){tail.append(z);parts.push(tail);}
      if(!parts.length)return false;
      mark.replaceWith(...parts);
      if(trailingNode)caretAfter(trailingNode);
      else if(lead.isConnected)caretAfter(lead);
      return true;
    };
    const inlineToggle=(action,tag,fallback,attrs={})=>{
      const current=selection();if(!current)return;
      const selTag={bold:'b,strong',italic:'i,em',code:'code',link:'a[href]'}[action];
      const mark=ancestor(current.range.startContainer,selTag);
      if(mark && !current.range.collapsed){
        let within=current.range;
        if(!mark.contains(within.endContainer)){
          // Selecting to the right edge of a styled span may include the invisible
          // caret boundary immediately after it. Exclude that boundary.
          const bounded=document.createRange();bounded.selectNodeContents(mark);
          try {bounded.setStart(within.startContainer,within.startOffset);}catch(_){}
          if(within.toString().replace(/\u200b/g,'')===bounded.toString().replace(/\u200b/g,''))within=bounded;
        }
        if(mark.contains(within.endContainer) && unmarkSelected(mark,within))return;
      }
      markSelected(tag,fallback,attrs);
    };
    const finishNativeInline=action=>{
      const current=selection();if(!current)return;
      const sel=getSelection(),range=current.range.cloneRange();range.collapse(false);
      const tag=action==='italic'?'i,em':'b,strong';
      const mark=ancestor(range.endContainer,tag);
      if(mark){
        // A styled selection ends inside its mark. Leave it before typing more.
        const rest=document.createRange();rest.selectNodeContents(mark);
        try{rest.setStart(range.endContainer,range.endOffset);}catch(_){}
        if(!rest.toString()){caretAfter(mark);return;}
      }
      // Turning a style off leaves plain text; keep its exact end, not the
      // end of any adjacent styled sibling.
      range.collapse(true);sel.removeAllRanges();sel.addRange(range);
    };
    const apply=action=>{
      editor.focus({preventScroll:true});
      const current=selection();if(!current)return;
      const start=current.range.startContainer;
      if(action==='bold'||action==='italic'){
        if(current.range.collapsed){
          inlineToggle(action,action==='bold'?'strong':'em',action==='bold'?'жирный текст':'курсив');
        }else{
          command(action==='bold'?'bold':'italic');
          finishNativeInline(action);
        }
      }else if(action==='heading'){
        command('formatBlock',ancestor(start,'h2')?'p':'h2');
      }else if(action==='list'){
        command('insertUnorderedList');
      }else if(action==='quote'){
        command('formatBlock',ancestor(start,'blockquote')?'p':'blockquote');
      }else if(action==='code'){
        inlineToggle('code','code','код');
      }else if(action==='link'){
        const link=ancestor(current.range.startContainer,'a[href]');
        if(link && !current.range.collapsed && link.contains(current.range.endContainer)){
          // Keep the existing selected-text toggle: a second click unlinks it.
          inlineToggle('link','a','название ссылки',{href:'https://example.com'});
        }else{
          openLinkPopup(link,link?null:current.range);
        }
      }
      sync();active();syncTrack();
    };
    // Prevent click on a tool from moving the cursor out of the selected text.
    toolbar.addEventListener('mousedown',e=>{if(e.target.closest('button[data-md]'))e.preventDefault();});
    toolbar.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest('button[data-md]'))e.preventDefault();});
    toolbar.addEventListener('click',e=>{const b=e.target.closest('button[data-md]');if(b){e.preventDefault();e.stopPropagation();apply(b.dataset.md);}});
    editor.addEventListener('input',()=>{
      // The invisible boundary is only needed until the first plain-text keystroke.
      // Remove it immediately so it never gets submitted, copied from the editor,
      // or interferes with further caret movement.
      const sel=getSelection(),node=sel?.anchorNode;
      if(sel?.isCollapsed && node?.nodeType===Node.TEXT_NODE && node.data.includes('\u200b')){
        const offset=node.data.slice(0,sel.anchorOffset).replace(/\u200b/g,'').length;
        node.data=node.data.replace(/\u200b/g,'');
        const r=document.createRange();r.setStart(node,Math.min(offset,node.length));r.collapse(true);
        sel.removeAllRanges();sel.addRange(r);
      }
      sync();active();
    });
    editor.addEventListener('paste',e=>{
      e.preventDefault();const data=e.clipboardData?.getData('text/plain')||'';
      command('insertText',data);
    });
    editor.addEventListener('click',e=>{
      const link=e.target.closest('a[href]');
      if(link && editor.contains(link)){
        e.preventDefault();
        openLinkPopup(link);
      }
    });
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
    form?.addEventListener('reset',()=>{closeLinkPopup();setTimeout(show,0);});
    show();
    return {editor,refresh:show,sync,apply};
  }
  window.attachReHubRichEditor=attach;
})();
