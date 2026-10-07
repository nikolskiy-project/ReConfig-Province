const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let revealObserver;
function observeReveals() {
  const revealItems = $$('.reveal');
  revealItems.forEach((el, index) => {
    if (!el.classList.contains('delay-1') && !el.classList.contains('delay-2')) {
      el.style.setProperty('--reveal-delay', `${Math.min(index * 35, 180)}ms`);
    }
  });
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach(el => el.classList.add('visible'));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold:.09, rootMargin:'0px 0px -6% 0px' });
  revealItems.forEach(el => revealObserver.observe(el));
}

function initHeader() {
  const topbar = $('#topbar');
  const sync = () => topbar?.classList.toggle('scrolled', scrollY > 18);
  sync();
  addEventListener('scroll', sync, { passive:true });
}

let hoverBound = new WeakSet();
function bindCursorHover() {
  $$('.interactive, a, button, .interactive-card, label.upload-drop').forEach(el => {
    if (hoverBound.has(el)) return;
    hoverBound.add(el);
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

function initCursor() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = $('#cursorDot');
  const ring = $('#cursorRing');
  const glow = $('#cursorGlow');
  if (!dot || !ring || !glow) return;

  let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  let dotX = mouseX, dotY = mouseY, ringX = mouseX, ringY = mouseY, glowX = mouseX, glowY = mouseY;
  addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive:true });
  addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));

  const frame = () => {
    dotX += (mouseX - dotX) * .46; dotY += (mouseY - dotY) * .46;
    ringX += (mouseX - ringX) * .135; ringY += (mouseY - ringY) * .135;
    glowX += (mouseX - glowX) * .045; glowY += (mouseY - glowY) * .045;
    dot.style.transform = `translate3d(${dotX}px,${dotY}px,0)`;
    ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
    glow.style.transform = `translate3d(${glowX}px,${glowY}px,0)`;
    requestAnimationFrame(frame);
  };
  frame();
  bindCursorHover();
}

function initCustomScrollbar() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;
  const track = document.createElement('div');
  track.className = 'site-scrollbar';
  track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div');
  thumb.className = 'site-scrollbar-thumb';
  track.appendChild(thumb);
  document.body.appendChild(track);

  let dragging = false, grabOffset = 0;
  const metrics = () => {
    const viewport = innerHeight;
    const total = Math.max(document.documentElement.scrollHeight, viewport);
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(52, Math.min(trackHeight, trackHeight * (viewport / total)));
    const maxScroll = Math.max(0, total - viewport);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    return { thumbHeight, maxScroll, maxThumbTop };
  };
  const sync = () => {
    const { thumbHeight, maxScroll, maxThumbTop } = metrics();
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0,${maxThumbTop * ratio}px,0)`;
    track.classList.toggle('hidden', maxScroll <= 0);
  };
  const move = clientY => {
    const rect = track.getBoundingClientRect();
    const { maxScroll, maxThumbTop } = metrics();
    if (!maxScroll || !maxThumbTop) return;
    const top = Math.max(0, Math.min(maxThumbTop, clientY - rect.top - grabOffset));
    scrollTo(0, (top / maxThumbTop) * maxScroll);
  };
  thumb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    grabOffset = e.clientY - thumb.getBoundingClientRect().top;
    dragging = true;
    thumb.classList.add('dragging');
    thumb.setPointerCapture?.(e.pointerId);
  });
  addEventListener('pointermove', e => { if (dragging) move(e.clientY); }, { passive:true });
  const finish = e => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };
  addEventListener('pointerup', finish);
  addEventListener('pointercancel', finish);
  addEventListener('scroll', sync, { passive:true });
  addEventListener('resize', sync, { passive:true });
  sync();
}

function showToast(text) {
  const toast = $('#hubToast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function setModal(modal, open) {
  if (!modal) return;
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('modal-open', $$('.hub-modal-backdrop.open').length > 0);
}

function initModals() {
  const upload = $('#uploadModal');
  const detail = $('#detailModal');
  ['#openUploadTop','#openUploadHero','#openUploadCommunity','#openUploadEmpty'].forEach(sel => {
    $(sel)?.addEventListener('click', () => setModal(upload, true));
  });
  $('#closeUpload')?.addEventListener('click', () => setModal(upload, false));
  $('#cancelUpload')?.addEventListener('click', () => setModal(upload, false));
  $('#closeDetail')?.addEventListener('click', () => setModal(detail, false));
  $$('[data-detail="okb"]').forEach(btn => btn.addEventListener('click', () => setModal(detail, true)));

  [upload, detail].forEach(modal => modal?.addEventListener('mousedown', e => {
    if (e.target === modal) setModal(modal, false);
  }));
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setModal(upload, false);
    setModal(detail, false);
  });
}

function initUpload() {
  const drop = $('#uploadDrop');
  const fileInput = $('#configFile');
  const fileTitle = $('#uploadFileTitle');
  const fileMeta = $('#uploadFileMeta');
  const form = $('#uploadForm');
  if (!drop || !fileInput || !form) return;

  const applyFile = file => {
    if (!file) return;
    if (!/\.xml$/i.test(file.name)) {
      showToast('ReHub принимает XML-конфиги.');
      fileInput.value = '';
      return;
    }
    fileTitle.textContent = file.name;
    fileMeta.textContent = `${Math.max(1, Math.round(file.size / 1024))} КБ · XML-конфиг готов к публикации`;
  };
  fileInput.addEventListener('change', () => applyFile(fileInput.files?.[0]));
  ['dragenter','dragover'].forEach(type => drop.addEventListener(type, e => {
    e.preventDefault(); drop.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(type => drop.addEventListener(type, e => {
    e.preventDefault(); drop.classList.remove('dragover');
  }));
  drop.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
    } catch (_) {}
    applyFile(file);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!fileInput.files?.length) {
      showToast('Сначала выбери XML-конфиг.');
      return;
    }
    showToast('Карточка подготовлена. Для общей публикации осталось подключить API ReHub.');
  });
}

function initFilters() {
  const search = $('#hubSearch');
  const filters = $$('.hub-filter');
  const officialCards = $$('.official-card');
  let active = 'all';
  const sync = () => {
    const query = (search?.value || '').trim().toLowerCase();
    officialCards.forEach(card => {
      const category = card.dataset.category || '';
      const haystack = `${card.dataset.search || ''} ${card.textContent || ''}`.toLowerCase();
      const filterOk = active === 'all' || category.includes(active);
      const searchOk = !query || haystack.includes(query);
      card.hidden = !(filterOk && searchOk);
    });
    const community = $('#communityEmpty');
    if (community) community.style.display = active === 'official' ? 'none' : 'flex';
  };
  filters.forEach(btn => btn.addEventListener('click', () => {
    active = btn.dataset.filter || 'all';
    filters.forEach(item => item.classList.toggle('active', item === btn));
    sync();
    if (active === 'official') $('#official')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));
  search?.addEventListener('input', sync);
}

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initCustomScrollbar();
initModals();
initUpload();
initFilters();
bindCursorHover();
