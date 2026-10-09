'use strict';
// Публичный адрес API. Секрет Crypto Pay хранится ТОЛЬКО в Cloudflare Worker.
const CRYPTO_DONATIONS_API = 'https://rehub-api.amenala789.workers.dev/api/donations/crypto/invoice';
const DONATION_LINKS = { donatello: '' };

(function initDonations() {
  const byId = id => document.getElementById(id);
  byId('year').textContent = new Date().getFullYear();
  const topbar = byId('topbar');
  const syncTopbar = () => topbar.classList.toggle('scrolled', window.scrollY > 16);
  addEventListener('scroll', syncTopbar, { passive: true });
  syncTopbar();

  function setDonationLink(name, elId, statusId, readyLabel) {
    const anchor = byId(elId);
    const status = byId(statusId);
    const value = String(DONATION_LINKS[name] || '').trim();
    let url;
    try { url = new URL(value); } catch { return; }
    // Only allow trustworthy schemes and expected provider hosts (including subdomains).
    if (url.protocol !== 'https:') return;
    const host = url.hostname.toLowerCase();
    const domains = ['donatello.to', 'donatello.me'];
    if (!domains.includes(host) || url.username || url.password) return;
    anchor.href = url.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.classList.remove('donate-inactive');
    anchor.removeAttribute('aria-disabled');
    anchor.removeAttribute('tabindex');
    status.textContent = readyLabel;
    status.classList.add('ready');
  }
  setDonationLink('donatello', 'donatelloLink', 'donatelloStatus', 'Оплата на личной странице Donatello');

  const toast = byId('donateToast');
  let toastTimer;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
  // Счёт создаётся сервером: никакого Crypto Pay API token в исходниках сайта.
  let selectedCryptoAmount = '3';
  const cryptoButton = byId('cryptoLink');
  const cryptoLabel = cryptoButton.querySelector('span');
  byId('cryptoAmounts').querySelectorAll('[data-amount]').forEach(button => {
    button.addEventListener('click', () => {
      selectedCryptoAmount = button.dataset.amount;
      byId('cryptoAmounts').querySelectorAll('[data-amount]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });
    });
  });
  cryptoButton.addEventListener('click', async () => {
    if (cryptoButton.disabled) return;
    cryptoButton.disabled = true;
    cryptoLabel.textContent = 'Создаём счёт…';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(CRYPTO_DONATIONS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: selectedCryptoAmount }),
          signal: controller.signal,
          cache: 'no-store'
        });
      } finally { clearTimeout(timeout); }
      const data = await response.json();
      if (!response.ok || !data?.ok || typeof data.invoice_url !== 'string') {
        throw new Error('Не удалось создать счёт');
      }
      const url = new URL(data.invoice_url);
      if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'pay.crypt.bot'].includes(url.hostname.toLowerCase()) || url.username || url.password) {
        throw new Error('Некорректная ссылка на оплату');
      }
      // Навигация в той же вкладке работает без блокировки pop-up браузером.
      window.location.assign(url.href);
    } catch (error) {
      showToast(error.name === 'AbortError' ? 'Сервис оплаты не ответил. Попробуйте позже.' : 'Не удалось создать счёт. Попробуйте позже.');
    } finally {
      cryptoButton.disabled = false;
      cryptoLabel.textContent = 'Создать счёт';
    }
  });

  byId('copyAccount').addEventListener('click', async () => {
    const account = byId('gameAccount').textContent.trim();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(account);
      } else {
        const input = document.createElement('textarea');
        input.value = account;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        const ok = document.execCommand('copy');
        input.remove();
        if (!ok) throw new Error('Clipboard unavailable');
      }
      showToast('Номер счёта скопирован');
    } catch {
      showToast('Скопируйте номер вручную: ' + account);
    }
  });

  // Инерция колесом, перетаскивание и фирменный ползунок главной страницы.
  initDragScroll();
  initCustomScrollbar();

  // Фирменный курсор ReConfig на компьютерах — без запуска script.js главной страницы.
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dot = byId('cursorDot'), ring = byId('cursorRing'), glow = byId('cursorGlow');
  let mouseX = innerWidth/2, mouseY = innerHeight/2;
  let dx = mouseX, dy = mouseY, rx = mouseX, ry = mouseY, gx = mouseX, gy = mouseY;
  addEventListener('mousemove', event => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    document.body.classList.add('cursor-active');
  }, { passive: true });
  addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  document.querySelectorAll('a,button').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
  const frame = () => {
    dx += (mouseX-dx)*.46; dy += (mouseY-dy)*.46;
    rx += (mouseX-rx)*.135; ry += (mouseY-ry)*.135;
    gx += (mouseX-gx)*.045; gy += (mouseY-gy)*.045;
    dot.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    glow.style.transform = `translate3d(${gx}px,${gy}px,0)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

// Механика скролла синхронизирована с главной страницей ReConfig.
function initDragScroll() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  let dragging = false;
  let moved = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let lastTime = 0;
  let lastMoveTime = 0;
  let velocity = 0;          // px/ms, положительное значение = прокрутка вниз
  let inertiaFrame = 0;
  let suppressClick = false;

  const interactiveSelector = 'a, button, input, textarea, select, [contenteditable="true"], .site-scrollbar-thumb';
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

    // Если перед отпусканием мышь уже почти остановилась — не запускаем старую скорость.
    const idleFor = performance.now() - lastMoveTime;
    if (idleFor > 85) velocity *= Math.max(0, 1 - (idleFor - 85) / 150);

    // Небольшой «бросок», как у телефонного kinetic scrolling.
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
      window.scrollTo(0, next);

      // Плавное затухание, почти как после свайпа на телефоне.
      velocity *= Math.pow(.946, dt / 16.667);

      // При достижении края гасим остаточную скорость без рывка.
      if (next <= 0 || next >= limit) velocity *= .34;

      if (Math.abs(velocity) > .014) {
        inertiaFrame = requestAnimationFrame(tick);
      } else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  document.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest(interactiveSelector)) return;

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

  window.addEventListener('mousemove', e => {
    if (!dragging) return;

    const now = performance.now();
    const dyFromStart = e.clientY - startY;
    if (Math.abs(dyFromStart) > 3) moved = true;

    const nextScroll = Math.max(0, Math.min(maxScroll(), startScroll - dyFromStart));
    window.scrollTo(0, nextScroll);

    const dt = Math.max(1, now - lastTime);
    const instantVelocity = (lastY - e.clientY) / dt;

    // Последние движения имеют больший вес — направление броска ощущается естественно.
    velocity = velocity * .58 + instantVelocity * .42;
    lastY = e.clientY;
    lastTime = now;
    lastMoveTime = now;

    e.preventDefault();
  }, { passive:false });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('page-dragging');
    document.body.classList.remove('page-dragging');

    if (moved) {
      suppressClick = true;
      beginInertia();
      setTimeout(() => { suppressClick = false; }, 110);
    } else {
      setKineticState(false);
    }
  };

  window.addEventListener('mouseup', finish);
  window.addEventListener('blur', finish);

  document.addEventListener('click', e => {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
  }, true);

  // Кинетическая прокрутка колесом мыши: импульсы складываются,
  // а после последнего шага страница продолжает движение и мягко тормозит.
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
      window.scrollTo(0, next);

      // Чуть более длинный хвост, чем у drag-свайпа: колесо ощущается
      // плавным, но не «ватным».
      velocity *= Math.pow(.885, dt / 16.667);
      if (next <= 0 || next >= limit) velocity *= .28;

      if (Math.abs(velocity) > .012) {
        inertiaFrame = requestAnimationFrame(tick);
      } else {
        inertiaFrame = 0;
        velocity = 0;
        setKineticState(false);
      }
    };
    inertiaFrame = requestAnimationFrame(tick);
  };

  window.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || dragging) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (wheelCanUseOwnScroller(e.target, e.deltaY)) return;

    e.preventDefault();

    const delta = normalizeWheelDelta(e);
    // Сохраняем направление и накапливаем скорость при нескольких
    // быстрых прокрутах подряд.
    velocity += delta * .0078;
    velocity = Math.max(-3.4, Math.min(3.4, velocity));
    startWheelInertia();
  }, { passive:false });

  // Клавиатура и новый клик сразу останавливают остаточное движение.
  window.addEventListener('keydown', cancelInertia);
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
    const doc = document.documentElement;
    const viewport = innerHeight;
    const total = Math.max(doc.scrollHeight, viewport);
    const trackHeight = track.clientHeight;
    const minThumb = 52;
    const thumbHeight = Math.max(minThumb, Math.min(trackHeight, trackHeight * (viewport / total)));
    const maxScroll = Math.max(0, total - viewport);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    return { thumbHeight, maxScroll, maxThumbTop };
  };

  const sync = () => {
    const { thumbHeight, maxScroll, maxThumbTop } = metrics();
    const ratio = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${maxThumbTop * ratio}px, 0)`;
    track.classList.toggle('hidden', maxScroll <= 0);
  };

  const moveThumb = clientY => {
    const rect = track.getBoundingClientRect();
    const { maxScroll, maxThumbTop } = metrics();
    if (maxScroll <= 0 || maxThumbTop <= 0) return;
    const top = Math.max(0, Math.min(maxThumbTop, clientY - rect.top - grabOffset));
    window.scrollTo(0, (top / maxThumbTop) * maxScroll);
  };

  thumb.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.cancelPageInertia === 'function') window.cancelPageInertia();
    const rect = thumb.getBoundingClientRect();
    grabOffset = e.clientY - rect.top;
    dragging = true;
    document.documentElement.classList.add('page-dragging');
    document.body.classList.add('page-dragging');
    thumb.classList.add('dragging');
    thumb.setPointerCapture?.(e.pointerId);
  });

  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    e.preventDefault();
    moveThumb(e.clientY);
  }, { passive:false });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    document.documentElement.classList.remove('page-dragging');
    document.body.classList.remove('page-dragging');
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('scroll', sync, { passive:true });
  window.addEventListener('resize', sync, { passive:true });

  sync();
}

