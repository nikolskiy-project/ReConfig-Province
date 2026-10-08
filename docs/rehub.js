const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const REHUB_API = String(window.REHUB_API || '').replace(/\/$/, '');
const PREVIEW_MAX_SOURCE = 8 * 1024 * 1024;
const PREVIEW_MAX_BYTES = 600 * 1024;
const CONFIG_MAX_BYTES = 1024 * 1024;

function asciiLower(byte) {
  return byte >= 65 && byte <= 90 ? byte + 32 : byte;
}

function findAscii(bytes, needle, from = 0) {
  const pattern = [...needle].map(ch => ch.charCodeAt(0));
  outer: for (let i = Math.max(0, from); i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (asciiLower(bytes[i + j]) !== asciiLower(pattern[j])) continue outer;
    }
    return i;
  }
  return -1;
}

function countBindEntries(bytes) {
  let count = 0, at = 0;
  while ((at = findAscii(bytes, '<bind', at)) !== -1) {
    const next = bytes[at + 5];
    if (next !== 115 && next !== 83) count++;
    at += 5;
  }
  return count;
}

async function extractBindsFile(file) {
  if (!file?.name?.toLowerCase().endsWith('.xml')) throw new Error('Для ReHub нужен XML-конфиг.');
  if (file.size > CONFIG_MAX_BYTES) throw new Error('XML не должен быть больше 1 МБ.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = findAscii(bytes, '<binds');
  if (start < 0) throw new Error('В XML не найден блок <binds>…</binds>.');
  const openEnd = bytes.indexOf(62, start); // >
  if (openEnd < 0) throw new Error('Блок <binds> повреждён.');
  const close = findAscii(bytes, '</binds>', openEnd + 1);
  if (close < 0) throw new Error('В XML не найден закрывающий </binds>.');
  const end = close + 8;
  const block = bytes.slice(start, end);
  const bindCount = countBindEntries(block);
  if (!bindCount) throw new Error('В блоке <binds> нет ни одного bind.');
  return {
    file: new File([block], file.name, { type: 'application/xml' }),
    bindCount,
    sourceBytes: bytes.length,
    exportedBytes: block.length
  };
}

const iconMap = {
  medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><circle cx="12" cy="12" r="8.6"/><path d="M12 7v10M7 12h10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M12 3 19 6v5c0 4.8-2.9 8-7 10-4.1-2-7-5.2-7-10V6l7-3Z"/><path d="m9.5 12 1.7 1.7 3.7-4"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="M5 17h14l-1-6-3-3H9l-3 3-1 6Z"/><path d="M7 17v2M17 17v2M8 13h8"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"><path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z"/></svg>'
};

let revealObserver;
const revealBound = new WeakSet();
function observeReveals(root = document) {
  const items = $$('.reveal', root).filter(el => !revealBound.has(el));
  items.forEach((el, index) => {
    revealBound.add(el);
    if (!el.classList.contains('delay-1') && !el.classList.contains('delay-2')) {
      el.style.setProperty('--reveal-delay', `${Math.min(index * 38, 190)}ms`);
    }
  });
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .09, rootMargin: '0px 0px -6% 0px' });
  }
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

// Published configs are addressed by stable IDs, never by their raw GitHub URL.
let activeDetailCard = null;
let rehubCatalogLoaded = false;

function configRefForCard(card) {
  if (!card) return '';
  const official = String(card.dataset.officialSlot || '').toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{1,47}$/.test(official)) return `official:${official}`;
  const community = String(card.dataset.communityId || '').toLowerCase();
  if (/^[a-f0-9]{12}$/.test(community)) return `community:${community}`;
  return '';
}

function downloadPathForCard(card) {
  const ref = configRefForCard(card);
  if (!ref || !card?.dataset.downloadUrl || !REHUB_API) return '';
  const [type, id] = ref.split(':');
  return `${REHUB_API}/api/download/${type}/${encodeURIComponent(id)}`;
}

function shareUrlForCard(card) {
  const ref = configRefForCard(card);
  if (!ref) return '';
  const url = new URL(location.href);
  url.hash = `config=${encodeURIComponent(ref)}`;
  return url.href;
}

async function copyShareLink(url) {
  if (!url) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch (_) { /* Firefox / clipboard permissions: use the selection fallback. */ }
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  Object.assign(textarea.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (_) { /* fallback below */ }
  textarea.remove();
  if (!copied && typeof window.prompt === 'function') {
    window.prompt('Скопируй ссылку на конфиг:', url);
  }
  return copied;
}

function sharedRefFromHash() {
  const hash = location.hash || '';
  if (!hash.startsWith('#config=')) return '';
  try {
    const ref = decodeURIComponent(hash.slice('#config='.length));
    return /^(official:[a-z0-9][a-z0-9-]{1,47}|community:[a-f0-9]{12})$/.test(ref) ? ref : '';
  } catch (_) { return ''; }
}

function openSharedConfig() {
  const ref = sharedRefFromHash();
  if (!ref || !rehubCatalogLoaded) return;
  const card = $$('.hub-video-card').find(item => configRefForCard(item) === ref && !!item.dataset.downloadUrl);
  if (card) openCard(card);
  else showToast('Публикация не найдена или была удалена.');
}

async function downloadSelectedConfig(button) {
  const card = activeDetailCard;
  const url = downloadPathForCard(card);
  if (!url) {
    showToast('Этот XML пока недоступен для скачивания.');
    return;
  }
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Загружаю XML…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      let message = `Ошибка загрузки (HTTP ${response.status})`;
      try {
        const data = await response.json();
        if (data?.error) message = String(data.error);
      } catch (_) {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const filename = String(card.dataset.title || 'config')
      .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')
      .trim().slice(0, 72) || 'config';
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}.xml`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    showToast('XML-файл скачан.');
  } catch (error) {
    showToast(error?.name === 'AbortError' ? 'Сервер долго не отвечает. Попробуй ещё раз.' : (error.message || 'Ошибка скачивания XML.'));
  } finally {
    clearTimeout(timeout);
    button.textContent = originalLabel;
    // The user may have switched to another card while the request was in flight.
    button.disabled = !downloadPathForCard(activeDetailCard);
  }
}

function openCard(card) {
  const modal = $('#detailModal');
  if (!modal) return;
  const preview = $('#detailPreview');
  const previewImage = $('#detailPreviewImage');
  const symbol = $('#detailSymbol');
  const title = card.dataset.title || 'Конфиг';
  const status = card.dataset.status || '—';
  const ready = card.dataset.statusKind === 'ready';
  const isCommunity = (card.dataset.category || '').includes('community');
  const previewUrl = card.dataset.previewUrl || '';
  const downloadUrl = card.dataset.downloadUrl || '';

  $('#detailTitle').textContent = title;
  $('#detailPreviewLabel').textContent = card.dataset.label || title;
  $('#detailDescription').textContent = card.dataset.description || '';
  $('#detailStatus').textContent = status;
  $('#detailAuthorName').textContent = card.dataset.author || (isCommunity ? 'Пользователь ReHub' : 'ReConfig Province');
  $('#detailAuthorMeta').textContent = isCommunity ? 'Автор сообщества' : 'Официальный автор · ✓';
  $('#detailPreviewSmall').textContent = isCommunity ? 'ReHub Community' : 'ReConfig Province';
  $('#detailPreviewKind').textContent = isCommunity ? 'Пользовательский конфиг' : 'Официальный конфиг';
  $('#detailPreviewBadge').textContent = isCommunity ? 'Сообщество' : 'Закреплено';

  preview.className = isCommunity ? 'detail-preview detail-preview-community' : `detail-preview detail-preview-${previewClassFor(card)}`;
  if (previewUrl) {
    preview.classList.add('has-image');
    previewImage.hidden = false;
    previewImage.src = previewUrl;
  } else {
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
    symbol.innerHTML = iconMap[card.dataset.symbol] || iconMap.medical;
  }

  const tags = $('#detailTags');
  tags.innerHTML = '';
  (card.dataset.tags || '').split('|').filter(Boolean).forEach(tag => {
    const item = document.createElement('span');
    item.textContent = tag;
    tags.appendChild(item);
  });

  activeDetailCard = card;
  const primary = $('#detailPrimary');
  const canDownload = !!downloadPathForCard(card);
  primary.textContent = canDownload ? 'Скачать XML' : 'Пока недоступно';
  primary.disabled = !canDownload;
  primary.classList.toggle('disabled', !canDownload);
  const share = $('#detailSecondary');
  share.disabled = !shareUrlForCard(card);
  $('#detailNote').textContent = canDownload
    ? 'Скачивается только XML с биндами. Прямая установка в ReConfig появится позже.'
    : 'XML ещё не опубликован — скачивание пока недоступно.';

  const detailScroll = $('#detailScroll');
  if (detailScroll) detailScroll.scrollTop = 0;
  setModal(modal, true);
}

function activateCard(card) {
  if (!card || card.classList.contains('card-click-flash')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    openCard(card);
    return;
  }
  card.classList.add('card-click-flash');
  // Allow the press animation to become visible before the modal covers the card.
  setTimeout(() => {
    card.classList.remove('card-click-flash');
    if (card.isConnected) openCard(card);
  }, 145);
}

/* Works for cards created after the community API request too. */
function initHubCardMotion() {
  const getCard = target => target instanceof Element ? target.closest('.hub-video-card') : null;
  document.addEventListener('pointerover', event => {
    const card = getCard(event.target);
    if (card && !card.contains(event.relatedTarget)) card.classList.add('hub-motion-hover');
  });
  document.addEventListener('pointerout', event => {
    const card = getCard(event.target);
    if (card && !card.contains(event.relatedTarget)) card.classList.remove('hub-motion-hover', 'hub-motion-press');
  });
  document.addEventListener('pointerdown', event => {
    const card = getCard(event.target);
    if (card && event.button === 0) card.classList.add('hub-motion-press');
  });
  const clearPressed = () => {
    document.querySelectorAll('.hub-video-card.hub-motion-press').forEach(card => card.classList.remove('hub-motion-press'));
  };
  document.addEventListener('pointerup', clearPressed);
  document.addEventListener('pointercancel', clearPressed);
  window.addEventListener('blur', clearPressed);
}

function initCards() {
  $$('.hub-video-card').forEach((card, index) => {
    card.addEventListener('click', () => activateCard(card));
    card.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      activateCard(card);
    });
  });
}


const PROGRAM_SELECT_MS = 330;
const programSelectTimers = new WeakMap();
function setProgramSelectOpen(wrap, open) {
  if (!wrap) return;
  const old = programSelectTimers.get(wrap); if (old) clearTimeout(old);
  wrap.classList.add('animating');
  wrap.classList.toggle('open', open);
  const timer = setTimeout(() => { wrap.classList.remove('animating'); programSelectTimers.delete(wrap); }, PROGRAM_SELECT_MS);
  programSelectTimers.set(wrap, timer);
}
function closeProgramSelects(except=null) {
  $$('.program-select.open').forEach(wrap => { if (wrap !== except) setProgramSelectOpen(wrap,false); });
}
function refreshProgramSelect(select) {
  if (!select) return;
  let wrap = select.nextElementSibling;
  if (!wrap || !wrap.classList.contains('program-select')) {
    wrap=document.createElement('div'); wrap.className='program-select';
    wrap.innerHTML='<button type="button" class="program-select-trigger interactive"><span class="program-select-value"></span><span class="program-select-arrow" aria-hidden="true"></span></button><div class="program-select-dropdown"><div class="program-select-options"></div></div>';
    select.classList.add('animated-native-select'); select.insertAdjacentElement('afterend',wrap);
    wrap.querySelector('.program-select-trigger').addEventListener('click',e=>{e.stopPropagation();const will=!wrap.classList.contains('open');closeProgramSelects(wrap);setProgramSelectOpen(wrap,will);});
  }
  const value=wrap.querySelector('.program-select-value'), options=wrap.querySelector('.program-select-options'); options.innerHTML='';
  [...select.options].forEach((option,index)=>{const item=document.createElement('div');item.className='program-select-option';if(option.disabled)item.classList.add('disabled');if(option.value===select.value)item.classList.add('selected');item.textContent=option.textContent;item.style.setProperty('--option-index',index);item.addEventListener('click',e=>{e.stopPropagation();if(option.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refreshProgramSelect(select);setProgramSelectOpen(wrap,false);});options.appendChild(item);});
  const selected=select.options[select.selectedIndex]||select.options[0];value.textContent=selected?selected.textContent:'Выберите значение';
  bindCursorHover();
}
function initProgramSelects(root=document) { $$('select[data-program-select]',root).forEach(refreshProgramSelect); }
document.addEventListener('click',()=>closeProgramSelects());

function initSearch() {
  const search = $('#hubSearch');
  const category = $('#communityCategoryFilter');
  const empty = $('#hubNoResults');
  const apply = () => {
    const query=(search?.value||'').trim().toLocaleLowerCase('ru-RU');
    const selected=(category?.value||'all').toLocaleLowerCase('ru-RU');
    const cards=$$('#communityGrid .hub-video-card');
    let shown=0;
    cards.forEach(card=>{
      const cardCategory=(card.dataset.category||'').toLocaleLowerCase('ru-RU');
      const haystack=[card.dataset.search||'',card.dataset.title||'',card.dataset.label||'',card.dataset.author||'',card.dataset.description||''].join(' ').toLocaleLowerCase('ru-RU');
      const visible=(!query||haystack.includes(query))&&(selected==='all'||cardCategory.includes(selected));
      card.hidden=!visible; if(visible)shown++;
    });
    if(empty) empty.hidden = shown !== 0 || cards.length === 0;
  };
  window.rehubApplySearch=apply;
  search?.addEventListener('input',apply);
  category?.addEventListener('change',apply);
  apply();
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

  $('#detailPrimary')?.addEventListener('click', e => { void downloadSelectedConfig(e.currentTarget); });
  $('#detailSecondary')?.addEventListener('click', async () => {
    const shareUrl = shareUrlForCard(activeDetailCard);
    if (!shareUrl) { showToast('Ссылка на эту публикацию недоступна.'); return; }
    if (await copyShareLink(shareUrl)) showToast('Ссылка на конфиг скопирована.');
  });
}


function escapeText(value) {
  return String(value ?? '');
}

function makeCommunityCard(item, index = 0) {
  const card = document.createElement('article');
  card.className = 'hub-video-card community-card interactive-card reveal';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.dataset.category = `community ${escapeText(item.category).toLocaleLowerCase('ru-RU')}`;
  card.dataset.search = `${escapeText(item.title)} ${escapeText(item.author)} ${escapeText(item.category)} ${escapeText(item.description)}`;
  card.dataset.title = escapeText(item.title || 'Конфиг сообщества');
  card.dataset.label = escapeText(item.category || 'ReHub');
  card.dataset.description = escapeText(item.description || '');
  card.dataset.status = 'Опубликован';
  card.dataset.statusKind = 'ready';
  card.dataset.tags = `${escapeText(item.category || 'Другое')}|Сообщество|${item.verified ? 'Проверено|' : ''}ReHub`;
  card.dataset.symbol = 'star';
  card.dataset.author = escapeText(item.author || 'Пользователь');
  card.dataset.communityId = /^[a-f0-9]{12}$/.test(String(item.id || '')) ? item.id : '';
  card.dataset.previewUrl = escapeText(item.preview_url || '');
  card.dataset.downloadUrl = escapeText(item.download_url || '');

  const thumb = document.createElement('div');
  thumb.className = 'config-thumb';
  if (item.preview_url) {
    const img = document.createElement('img');
    img.className = 'community-preview';
    img.src = item.preview_url;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'community-preview-fallback';
    fallback.innerHTML = iconMap.star;
    thumb.appendChild(fallback);
  }
  const state = document.createElement('span');
  state.className = 'thumb-state ready';
  state.textContent = item.verified ? 'Проверено' : 'Сообщество';
  const shine = document.createElement('div');
  shine.className = 'thumb-shine';
  shine.setAttribute('aria-hidden', 'true');
  thumb.append(state, shine);

  const meta = document.createElement('div');
  meta.className = 'video-card-meta';
  const avatar = document.createElement('img');
  avatar.className = 'video-avatar';
  avatar.src = 'assets/logo.png';
  avatar.alt = '';
  const copy = document.createElement('div');
  copy.className = 'video-card-copy';
  const h3 = document.createElement('h3');
  h3.textContent = item.title || 'Конфиг сообщества';
  const p = document.createElement('p');
  p.textContent = item.author || 'Пользователь';
  if (item.verified) { const check=document.createElement('span'); check.className='verified-dot'; check.textContent='✓'; p.append(' ',check); }
  const small = document.createElement('small');
  small.textContent = `${item.verified ? 'Проверенный конфиг' : 'Сообщество'} · ${item.category || 'Другое'}`;
  copy.append(h3, p, small);
  meta.append(avatar, copy);
  card.append(thumb, meta);

  card.addEventListener('click', () => activateCard(card));
  card.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    activateCard(card);
  });
  return card;
}


function makeOfficialCard(item) {
  const card=document.createElement('article');
  card.className='hub-video-card interactive-card reveal';
  card.tabIndex=0; card.setAttribute('role','button');
  card.dataset.officialSlot=item.slot||'';
  card.dataset.category=`official ${(item.category||'').toLocaleLowerCase('ru-RU')}`;
  card.dataset.search=`${item.title||''} ${item.category||''} ${item.author||''} ${item.description||''} официальный reconfig province`;
  card.dataset.title=item.title||item.category||'Официальный конфиг';
  card.dataset.label=(item.category||'ReHub').toUpperCase();
  card.dataset.description=item.description||'';
  card.dataset.status='Доступен'; card.dataset.statusKind='ready';
  card.dataset.tags=`${item.category||'Официальный'}|Официальный|ReConfig`;
  card.dataset.author=item.author||'ReConfig Province';
  card.dataset.previewUrl=item.preview_url||''; card.dataset.downloadUrl=item.download_url||'';
  card.dataset.symbol='star';
  const thumb=document.createElement('div'); thumb.className='config-thumb';
  if(item.preview_url){const img=document.createElement('img');img.className='community-preview official-preview-image';img.src=item.preview_url;img.alt='';img.loading='lazy';thumb.appendChild(img);}
  const grid=document.createElement('div');grid.className='thumb-grid';thumb.appendChild(grid);
  const follow=document.createElement('div');follow.className='thumb-follow';follow.innerHTML=`<span class="thumb-symbol">${iconMap.star}</span><div class="thumb-copy"><small>ReConfig Province</small><strong>${escapeText((item.category||'ReHub').toUpperCase())}</strong><span>${escapeText(item.title||'Официальный конфиг')}</span></div>`;thumb.appendChild(follow);
  const pin=document.createElement('span');pin.className='thumb-pin';pin.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 3 6 6-2 2 4 4-2 2-4-4-2 2-6-6 6-6Z"/><path d="m8 16-5 5"/></svg>Закреплено';thumb.appendChild(pin);
  const state=document.createElement('span');state.className='thumb-state ready';state.textContent='Доступен';thumb.appendChild(state);
  const shine=document.createElement('div');shine.className='thumb-shine';thumb.appendChild(shine);
  const meta=document.createElement('div');meta.className='video-card-meta';meta.innerHTML=`<img class="video-avatar" src="assets/logo.png" alt=""><div class="video-card-copy"><h3>${escapeText(item.title||item.category||'Официальный конфиг')} <span class="verified-dot">✓</span></h3><p>${escapeText(item.author||'ReConfig Province')} <span>✓</span></p><small>Официальный конфиг · ${escapeText(item.category||'ReHub')}</small></div>`;
  card.append(thumb,meta);
  card.addEventListener('click',()=>activateCard(card));
  card.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();activateCard(card);});
  return card;
}

function applyOfficialConfig(item) {
  if(!item||!item.official||!item.slot)return;
  let card=$(`#hubGrid .hub-video-card[data-official-slot="${CSS.escape(item.slot)}"]`);
  if(!card){card=makeOfficialCard(item);$('#hubGrid')?.appendChild(card);observeReveals(card.parentElement);return;}
  const label=item.category||card.dataset.label||'Официальный';
  card.dataset.officialSlot = item.slot;
  card.dataset.title=item.title||label; card.dataset.description=item.description||''; card.dataset.status='Доступен'; card.dataset.statusKind='ready'; card.dataset.tags=`${label}|Официальный|ReConfig`; card.dataset.author=item.author||'ReConfig Province'; card.dataset.previewUrl=item.preview_url||''; card.dataset.downloadUrl=item.download_url||''; card.dataset.search=`${card.dataset.search||''} ${item.title||''} ${label} ${item.description||''} ${item.author||''}`;
  const thumb=card.querySelector('.config-thumb');
  if(thumb&&item.preview_url){let image=thumb.querySelector('.official-preview-image');if(!image){image=document.createElement('img');image.className='community-preview official-preview-image';image.alt='';image.loading='lazy';thumb.insertBefore(image,thumb.firstChild);}image.src=item.preview_url;}
  const state=card.querySelector('.thumb-state');if(state){state.textContent='Доступен';state.classList.remove('soon');state.classList.add('ready');}
  const title=card.querySelector('.video-card-copy h3');if(title)title.innerHTML=`${escapeText(item.title||label)} <span class="verified-dot">✓</span>`;
  const author=card.querySelector('.video-card-copy p');if(author)author.innerHTML=`${escapeText(item.author||'ReConfig Province')} <span>✓</span>`;
  const small=card.querySelector('.video-card-copy small');if(small)small.textContent=`Официальный конфиг · ${label}`;
}

function rebuildCategorySelect(items, allCatalogItems = []) {
  const select=$('#communityCategoryFilter'); if(!select)return;
  const current=select.value||'all';
  const categories=[...new Set(items.map(item=>String(item?.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  select.innerHTML='<option value="all">Все фракции</option>';
  categories.forEach(name=>{const o=document.createElement('option');o.value=name.toLocaleLowerCase('ru-RU');o.textContent=name;select.appendChild(o);});
  select.value=[...select.options].some(o=>o.value===current)?current:'all'; refreshProgramSelect(select);
  const uploadSelect=$('#uploadForm select[name="category"]');
  if(uploadSelect){
    const uploadCategories=[...new Set(allCatalogItems.map(item=>String(item?.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
    const existing=new Set([...uploadSelect.options].map(o=>o.value));
    uploadCategories.forEach(name=>{if(existing.has(name))return;const o=document.createElement('option');o.value=name;o.textContent=name;uploadSelect.insertBefore(o,uploadSelect.lastElementChild);});
    refreshProgramSelect(uploadSelect);
  }
}

async function loadCommunityConfigs() {
  const grid = $('#communityGrid');
  const empty = $('#communityEmpty');
  const emptyTitle = $('#communityEmptyTitle');
  const emptyText = $('#communityEmptyText');
  if (!grid || !empty) return;

  if (!REHUB_API || REHUB_API.includes('YOUR-WORKER')) {
    emptyTitle.textContent = 'API ReHub ещё не подключён';
    emptyText.textContent = 'Укажи адрес Cloudflare Worker в rehub-config.js — после этого опубликованные конфиги загрузятся автоматически.';
    rehubCatalogLoaded = true;
    openSharedConfig();
    return;
  }

  try {
    const response = await fetch(`${REHUB_API}/api/configs`, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data.configs) ? data.configs : []);
    items.filter(item => item && item.official === true).forEach(applyOfficialConfig);
    const communityItems = items.filter(item => item && item.official !== true);
    grid.innerHTML = '';
    communityItems.forEach((item, index) => grid.appendChild(makeCommunityCard(item, index)));
    rebuildCategorySelect(communityItems, items);
    observeReveals(grid);

    // The "no configs yet" panel must never coexist with real community cards.
    empty.hidden = communityItems.length > 0;
    empty.setAttribute('aria-hidden', communityItems.length > 0 ? 'true' : 'false');

    initCardParallax();
    bindCursorHover();
    window.rehubApplySearch?.();
  } catch (error) {
    emptyTitle.textContent = 'Не удалось загрузить мастерскую';
    emptyText.textContent = 'Проверь адрес API и настройки CORS в Cloudflare Worker.';
    console.error('ReHub API:', error);
  } finally {
    rehubCatalogLoaded = true;
    openSharedConfig();
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось сжать изображение')), type, quality));
}

async function compressPreview(file) {
  if (!file) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Превью должно быть JPG, PNG или WebP.');
  if (file.size > PREVIEW_MAX_SOURCE) throw new Error('Исходное превью не должно быть больше 8 МБ.');

  const bitmap = await createImageBitmap(file);
  const maxW = 1280, maxH = 720;
  const baseScale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  let width = Math.max(1, Math.round(bitmap.width * baseScale));
  let height = Math.max(1, Math.round(bitmap.height * baseScale));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Браузер не поддерживает обработку изображения.');

  let blob = null;
  const qualities = [.86,.78,.70,.62,.54];
  for (let pass = 0; pass < 4; pass++) {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#101017';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(bitmap,0,0,width,height);
    for (const quality of qualities) {
      blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (blob.size <= PREVIEW_MAX_BYTES) break;
    }
    if (blob && blob.size <= PREVIEW_MAX_BYTES) break;
    width = Math.max(640, Math.round(width * .86));
    height = Math.max(360, Math.round(height * .86));
  }
  bitmap.close?.();
  if (!blob || blob.size > PREVIEW_MAX_BYTES) throw new Error('Не удалось ужать превью до 600 КБ. Выбери более простое изображение.');
  return new File([blob], 'preview.webp', { type: 'image/webp' });
}

function initUpload() {
  const configInput = $('#configFile');
  const previewInput = $('#previewFile');
  const configDrop = $('#uploadDrop');
  const previewDrop = $('#previewDrop');
  const configTitle = $('#uploadFileTitle');
  const configMeta = $('#uploadFileMeta');
  const previewTitle = $('#previewFileTitle');
  const previewMeta = $('#previewFileMeta');
  const previewImage = $('#previewImage');
  const form = $('#uploadForm');
  const submit = $('#uploadSubmit');
  if (!configInput || !previewInput || !configDrop || !previewDrop || !form) return;

  let selectedConfig = null;
  let selectedPreview = null;
  let previewObjectUrl = '';

  const setConfig = async file => {
    if (!file) return;
    configTitle.textContent = 'Извлекаю блок биндов…';
    configMeta.textContent = 'В ReHub попадёт только <binds>…</binds>';
    try {
      const extracted = await extractBindsFile(file);
      selectedConfig = extracted.file;
      configTitle.textContent = file.name;
      configMeta.textContent = `${extracted.bindCount} биндов · экспорт ${Math.max(1, Math.round(extracted.exportedBytes / 1024))} КБ · только <binds>`;
    } catch (error) {
      selectedConfig = null;
      configInput.value = '';
      configTitle.textContent = 'Выбрать XML-конфиг';
      configMeta.textContent = 'До 1 МБ · будет экспортирован только блок <binds>';
      showToast(error.message || 'Не удалось прочитать XML.');
    }
  };

  const setPreview = async file => {
    if (!file) return;
    previewTitle.textContent = 'Обрабатываю превью…';
    previewMeta.textContent = 'Сжатие выполняется локально в браузере';
    try {
      selectedPreview = await compressPreview(file);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(selectedPreview);
      previewImage.src = previewObjectUrl;
      previewImage.hidden = false;
      previewDrop.classList.add('has-preview');
      previewTitle.textContent = 'Превью готово';
      previewMeta.textContent = `${Math.round(selectedPreview.size / 1024)} КБ · WebP · до 1280×720`;
    } catch (error) {
      selectedPreview = null;
      previewDrop.classList.remove('has-preview');
      previewImage.hidden = true;
      previewTitle.textContent = 'Добавить превью';
      previewMeta.textContent = 'JPG / PNG / WebP · авто до 1280×720 и 600 КБ';
      showToast(error.message || 'Не удалось обработать превью.');
    }
  };

  configInput.addEventListener('change', () => { void setConfig(configInput.files?.[0]); });
  previewInput.addEventListener('change', () => setPreview(previewInput.files?.[0]));

  const setupDrop = (drop, handler) => {
    ['dragenter','dragover'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(type => drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
    drop.addEventListener('drop', e => handler(e.dataTransfer?.files?.[0]));
  };
  setupDrop(configDrop, file => { void setConfig(file); });
  setupDrop(previewDrop, setPreview);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!selectedConfig) { showToast('Сначала выбери XML-конфиг.'); return; }
    if (!REHUB_API || REHUB_API.includes('YOUR-WORKER')) { showToast('Сначала укажи адрес API в rehub-config.js.'); return; }

    const fields = new FormData(form);
    const payload = new FormData();
    payload.append('title', String(fields.get('title') || '').trim());
    payload.append('author', String(fields.get('author') || '').trim());
    payload.append('category', String(fields.get('category') || 'Другое'));
    payload.append('description', String(fields.get('description') || '').trim());
    payload.append('config', selectedConfig, selectedConfig.name);
    if (selectedPreview) payload.append('preview', selectedPreview, 'preview.webp');

    form.classList.add('submitting');
    submit.disabled = true;
    const oldText = submit.textContent;
    submit.textContent = 'Отправляю…';
    try {
      const response = await fetch(`${REHUB_API}/api/submissions`, { method: 'POST', body: payload });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Ошибка API ${response.status}`);
      showToast(`Отправлено на модерацию · ID ${result.id}`);
      form.reset();
      selectedConfig = null;
      selectedPreview = null;
      configTitle.textContent = 'Выбрать XML-конфиг';
      configMeta.textContent = 'До 1 МБ · будет экспортирован только блок <binds>';
      previewTitle.textContent = 'Добавить превью';
      previewMeta.textContent = 'JPG / PNG / WebP · авто до 1280×720 и 600 КБ';
      previewDrop.classList.remove('has-preview');
      previewImage.hidden = true;
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = '';
      setModal($('#uploadModal'), false);
    } catch (error) {
      showToast(error.message || 'Не удалось отправить конфиг.');
    } finally {
      form.classList.remove('submitting');
      submit.disabled = false;
      submit.textContent = oldText;
    }
  });
}

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initCardParallax();
initDragScroll();
initCustomScrollbar();
initHubCardMotion();
initCards();
initProgramSelects();
initSearch();
initModals();
initUpload();
addEventListener('hashchange', openSharedConfig);
loadCommunityConfigs();
bindCursorHover();
