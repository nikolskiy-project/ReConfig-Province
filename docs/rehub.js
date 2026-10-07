const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const iconMap = {
  medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><circle cx="12" cy="12" r="8.6"/><path d="M12 7v10M7 12h10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M12 3 19 6v5c0 4.8-2.9 8-7 10-4.1-2-7-5.2-7-10V6l7-3Z"/><path d="m9.5 12 1.7 1.7 3.7-4"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M5 17h14l-1-6-3-3H9l-3 3-1 6Z"/><path d="M7 17v2M17 17v2M8 13h8"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z"/></svg>'
};

let revealObserver;
function observeReveals() {
  const items = $$('.reveal');
  items.forEach((el, index) => {
    if (!el.classList.contains('delay-1') && !el.classList.contains('delay-2')) {
      el.style.setProperty('--reveal-delay', `${Math.min(index * 38, 190)}ms`);
    }
  });
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .09, rootMargin: '0px 0px -6% 0px' });
  items.forEach(el => revealObserver.observe(el));
}

function initHeader() {
  const topbar = $('#topbar');
  const sync = () => topbar?.classList.toggle('scrolled', scrollY > 18);
  sync();
  addEventListener('scroll', sync, { passive: true });
}

let hoverBound = new WeakSet();
function bindCursorHover() {
  $$('.interactive, a, button, .interactive-card, .hub-video-card, label.upload-drop').forEach(el => {
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
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;
  let glowX = mouseX, glowY = mouseY;

  addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive: true });
  addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));

  const frame = () => {
    dotX += (mouseX - dotX) * .46;
    dotY += (mouseY - dotY) * .46;
    ringX += (mouseX - ringX) * .135;
    ringY += (mouseY - ringY) * .135;
    glowX += (mouseX - glowX) * .045;
    glowY += (mouseY - glowY) * .045;
    dot.style.transform = `translate3d(${dotX}px,${dotY}px,0)`;
    ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
    glow.style.transform = `translate3d(${glowX}px,${glowY}px,0)`;
    requestAnimationFrame(frame);
  };
  frame();
  bindCursorHover();
}

function initCardParallax() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  $$('.hub-video-card').forEach(card => {
    const thumb = $('.config-thumb', card);
    const follow = $('.thumb-follow', card);
    if (!thumb || !follow) return;

    let tx = 0, ty = 0, rx = 0, ry = 0;
    let x = 0, y = 0, crx = 0, cry = 0;
    let followX = 0, followY = 0, targetFollowX = 0, targetFollowY = 0;
    let active = false;

    const setTarget = e => {
      const rect = thumb.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width / 2, 1)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height / 2, 1)));
      tx = nx * 3.2;
      ty = ny * 2.2;
      rx = -ny * 2.5;
      ry = nx * 3.5;
      targetFollowX = nx * 8;
      targetFollowY = ny * 5;
      thumb.style.setProperty('--shine-x', `${Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)).toFixed(1)}%`);
      thumb.style.setProperty('--shine-y', `${Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)).toFixed(1)}%`);
    };

    card.addEventListener('mouseenter', e => { active = true; setTarget(e); });
    card.addEventListener('mousemove', setTarget, { passive: true });
    card.addEventListener('mouseleave', () => {
      active = false;
      tx = ty = rx = ry = targetFollowX = targetFollowY = 0;
      thumb.style.setProperty('--shine-x', '50%');
      thumb.style.setProperty('--shine-y', '50%');
    });

    const animate = () => {
      x += (tx - x) * .11;
      y += (ty - y) * .11;
      crx += (rx - crx) * .10;
      cry += (ry - cry) * .10;
      followX += (targetFollowX - followX) * .09;
      followY += (targetFollowY - followY) * .09;
      thumb.style.transform = `perspective(1000px) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotateX(${crx.toFixed(2)}deg) rotateY(${cry.toFixed(2)}deg)`;
      follow.style.transform = `translate3d(${followX.toFixed(2)}px,${followY.toFixed(2)}px,20px)`;
      requestAnimationFrame(animate);
    };
    animate();
  });
}

function initDragScroll() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  let dragging = false;
  let moved = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let lastTime = 0;
  let lastMoveTime = 0;
  let velocity = 0;
  let inertiaFrame = 0;
  let suppressClick = false;

  const interactiveSelector = 'a, button, input, textarea, select, [contenteditable="true"], .site-scrollbar-thumb, .hub-video-card, .hub-modal';
  const root = document.documentElement;
  const maxScroll = () => Math.max(0, root.scrollHeight - innerHeight);

  const setKineticState = enabled => {
    root.classList.toggle('page-kinetic', enabled);
    document.body.classList.toggle('page-kinetic', enabled);
  };

  const cancelInertia = () => {
    if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
    velocity = 0;
    if (!dragging) setKineticState(false);
  };
  window.cancelPageInertia = cancelInertia;

  const beginInertia = () => {
    if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
    const idleFor = performance.now() - lastMoveTime;
    if (idleFor > 85) velocity *= Math.max(0, 1 - (idleFor - 85) / 150);
    velocity = Math.max(-2.7, Math.min(2.7, velocity * 1.22));
    if (Math.abs(velocity) < .055) {
      setKineticState(false);
      return;
    }

    setKineticState(true);
    let previous = performance.now();
    const tick = now => {
      const dt = Math.min(32, Math.max(1, now - previous));
      previous = now;
      const before = scrollY;
      const limit = maxScroll();
      const next = Math.max(0, Math.min(limit, before + velocity * dt));
      scrollTo(0, next);
      velocity *= Math.pow(.946, dt / 16.667);
      if (next <= 0 || next >= limit) velocity *= .34;
      if (Math.abs(velocity) > .014) inertiaFrame = requestAnimationFrame(tick);
      else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest(interactiveSelector) || document.body.classList.contains('modal-open')) return;
    cancelInertia();
    dragging = true;
    moved = false;
    suppressClick = false;
    startY = lastY = e.clientY;
    startScroll = scrollY;
    lastTime = lastMoveTime = performance.now();
    velocity = 0;
    root.classList.add('page-dragging');
    document.body.classList.add('page-dragging');
    setKineticState(true);
  });

  addEventListener('mousemove', e => {
    if (!dragging) return;
    const now = performance.now();
    const dyFromStart = e.clientY - startY;
    if (Math.abs(dyFromStart) > 3) moved = true;
    scrollTo(0, Math.max(0, Math.min(maxScroll(), startScroll - dyFromStart)));
    const dt = Math.max(1, now - lastTime);
    const instantVelocity = (lastY - e.clientY) / dt;
    velocity = velocity * .58 + instantVelocity * .42;
    lastY = e.clientY;
    lastTime = now;
    lastMoveTime = now;
    e.preventDefault();
  }, { passive: false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('page-dragging');
    document.body.classList.remove('page-dragging');
    if (moved) {
      suppressClick = true;
      beginInertia();
      setTimeout(() => { suppressClick = false; }, 110);
    } else setKineticState(false);
  };
  addEventListener('mouseup', finish);
  addEventListener('blur', finish);

  document.addEventListener('click', e => {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
  }, true);

  const wheelCanUseOwnScroller = (target, deltaY) => {
    let node = target instanceof Element ? target : null;
    while (node && node !== document.body && node !== root) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1;
      if (scrollable) {
        const canUp = node.scrollTop > 0;
        const canDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
        if ((deltaY < 0 && canUp) || (deltaY > 0 && canDown)) return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const normalizeWheelDelta = e => {
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= innerHeight;
    return Math.max(-190, Math.min(190, delta));
  };

  const startWheelInertia = () => {
    if (inertiaFrame) return;
    setKineticState(true);
    let previous = performance.now();
    const tick = now => {
      const dt = Math.min(32, Math.max(1, now - previous));
      previous = now;
      const limit = maxScroll();
      const before = scrollY;
      const next = Math.max(0, Math.min(limit, before + velocity * dt));
      scrollTo(0, next);
      velocity *= Math.pow(.885, dt / 16.667);
      if (next <= 0 || next >= limit) velocity *= .28;
      if (Math.abs(velocity) > .012) inertiaFrame = requestAnimationFrame(tick);
      else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || dragging || document.body.classList.contains('modal-open')) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (wheelCanUseOwnScroller(e.target, e.deltaY)) return;
    e.preventDefault();
    velocity += normalizeWheelDelta(e) * .0078;
    velocity = Math.max(-3.4, Math.min(3.4, velocity));
    startWheelInertia();
  }, { passive: false });

  addEventListener('keydown', cancelInertia);
  document.addEventListener('mousedown', () => {
    if (!dragging && inertiaFrame) cancelInertia();
  }, true);
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

  let dragging = false;
  let grabOffset = 0;
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
    e.stopPropagation();
    window.cancelPageInertia?.();
    grabOffset = e.clientY - thumb.getBoundingClientRect().top;
    dragging = true;
    thumb.classList.add('dragging');
    thumb.setPointerCapture?.(e.pointerId);
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    move(e.clientY);
  }, { passive: false });
  const finish = e => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };
  addEventListener('pointerup', finish);
  addEventListener('pointercancel', finish);
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });
  sync();
}

function setModal(modal, open) {
  if (!modal) return;
  if (open) window.cancelPageInertia?.();
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('modal-open', $$('.hub-modal-backdrop.open').length > 0);
}

function showToast(text) {
  const toast = $('#hubToast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function previewClassFor(card) {
  if (card.dataset.category.includes('uvd')) return 'uvd';
  if (card.dataset.category.includes('gibdd')) return 'gibdd';
  if (card.dataset.category.includes('armia')) return 'army';
  return 'okb';
}

function openCard(card) {
  const modal = $('#detailModal');
  if (!modal) return;
  const preview = $('#detailPreview');
  const symbol = $('#detailSymbol');
  const title = card.dataset.title || 'Конфиг';
  const status = card.dataset.status || '—';
  const ready = card.dataset.statusKind === 'ready';

  $('#detailTitle').textContent = title;
  $('#detailPreviewLabel').textContent = card.dataset.label || title;
  $('#detailDescription').textContent = card.dataset.description || '';
  $('#detailStatus').textContent = status;
  symbol.innerHTML = iconMap[card.dataset.symbol] || iconMap.medical;
  preview.className = `detail-preview detail-preview-${previewClassFor(card)}`;

  const tags = $('#detailTags');
  tags.innerHTML = '';
  (card.dataset.tags || '').split('|').filter(Boolean).forEach(tag => {
    const item = document.createElement('span');
    item.textContent = tag;
    tags.appendChild(item);
  });

  const primary = $('#detailPrimary');
  primary.textContent = ready ? 'Открыть в ReConfig' : 'В разработке';
  primary.disabled = !ready;
  primary.classList.toggle('disabled', !ready);
  $('#detailNote').textContent = ready
    ? 'Прямая установка из ReHub будет подключена вместе с API мастерской.'
    : 'Этот официальный набор уже закреплён в мастерской, но его содержимое ещё готовится.';

  setModal(modal, true);
}

function initCards() {
  $$('.hub-video-card').forEach(card => {
    card.addEventListener('click', () => openCard(card));
    card.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openCard(card);
    });
  });
}

function initSearch() {
  const search = $('#hubSearch');
  const filters = $$('#hubFilters .hub-filter');
  const cards = $$('.hub-video-card');
  const empty = $('#hubNoResults');
  let activeFilter = 'all';

  const apply = () => {
    const query = (search?.value || '').trim().toLocaleLowerCase('ru-RU');
    let shown = 0;
    cards.forEach(card => {
      const category = card.dataset.category || '';
      const haystack = `${card.dataset.search || ''} ${card.dataset.title || ''}`.toLocaleLowerCase('ru-RU');
      const matchesFilter = activeFilter === 'all' || category.includes(activeFilter);
      const matchesQuery = !query || haystack.includes(query);
      const visible = matchesFilter && matchesQuery;
      card.hidden = !visible;
      if (visible) shown++;
    });
    if (empty) empty.hidden = shown !== 0;
  };

  search?.addEventListener('input', apply);
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    activeFilter = button.dataset.filter || 'all';
    apply();
  }));
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
  [upload, detail].forEach(modal => modal?.addEventListener('mousedown', e => {
    if (e.target === modal) setModal(modal, false);
  }));
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setModal(upload, false);
    setModal(detail, false);
  });

  $('#detailPrimary')?.addEventListener('click', () => showToast('Прямая установка появится вместе с API ReHub.'));
  $('#detailSecondary')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      showToast('Ссылка на ReHub скопирована.');
    } catch (_) {
      showToast('Скопировать ссылку автоматически не удалось.');
    }
  });
}

function initUpload() {
  const input = $('#configFile');
  const drop = $('#uploadDrop');
  const title = $('#uploadFileTitle');
  const meta = $('#uploadFileMeta');
  if (!input || !drop) return;

  const setFile = file => {
    if (!file) return;
    const xml = file.name.toLowerCase().endsWith('.xml');
    if (!xml) {
      showToast('Для ReHub нужен XML-конфиг.');
      return;
    }
    title.textContent = file.name;
    meta.textContent = `${Math.max(1, Math.round(file.size / 1024))} КБ · XML`;
  };
  input.addEventListener('change', () => setFile(input.files?.[0]));
  ['dragenter','dragover'].forEach(type => drop.addEventListener(type, e => {
    e.preventDefault();
    drop.classList.add('dragover');
  }));
  ['dragleave','drop'].forEach(type => drop.addEventListener(type, e => {
    e.preventDefault();
    drop.classList.remove('dragover');
  }));
  drop.addEventListener('drop', e => setFile(e.dataTransfer?.files?.[0]));
  $('#uploadForm')?.addEventListener('submit', e => {
    e.preventDefault();
    showToast('Карточка подготовлена. Для публикации подключим API ReHub.');
  });
}

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initCardParallax();
initDragScroll();
initCustomScrollbar();
initCards();
initSearch();
initModals();
initUpload();
bindCursorHover();
