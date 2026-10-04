const REPO_OWNER = 'nikolskiy-project';
const REPO_NAME = 'ReConfig-Province';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const README_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/README.md`;
const EXPECTED_ASSET = 'ReConfigProvince.exe';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'long', year:'numeric' }).format(new Date(iso));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['Б','КБ','МБ','ГБ'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function stripUpdateMarker(body = '') {
  return body
    .replace(/<!--\s*reconfig-update\s*:\s*(required|optional)\s*-->/ig, '')
    .replace(/^\s+|\s+$/g, '');
}

function updateMode(body = '') {
  return /<!--\s*reconfig-update\s*:\s*required\s*-->/i.test(body) ? 'required' : 'optional';
}

function releaseAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  return assets.find(a => a.name?.toLowerCase() === EXPECTED_ASSET.toLowerCase())
    || assets.find(a => a.name?.toLowerCase().endsWith('.exe'))
    || null;
}

function summarize(body) {
  const clean = stripUpdateMarker(body)
    .replace(/[#>*_`~\[\]]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return clean || 'Описание изменений для этой версии не указано.';
}

function setDownloadLink(anchor, asset, fallback) {
  if (!anchor) return;
  anchor.href = asset?.browser_download_url || fallback;
  anchor.classList.remove('disabled');
  anchor.removeAttribute('aria-disabled');
}

function releaseRow(release, latestTag) {
  const asset = releaseAsset(release);
  const mode = updateMode(release.body || '');
  const row = document.createElement('article');
  row.className = 'release-item reveal';
  const title = release.name || `ReConfig Province ${release.tag_name}`;
  const desc = summarize(release.body || '');
  const isLatest = release.tag_name === latestTag;
  row.innerHTML = `
    <div class="release-ver">
      <strong>${escapeHtml(release.tag_name || 'Без тега')}</strong>
      ${isLatest ? '<span class="release-badge">Актуальная</span>' : mode === 'required' ? '<span class="release-badge required">Обязательная</span>' : ''}
    </div>
    <div class="release-info">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
    </div>
    <div class="release-actions">
      <span class="release-date">${formatDate(release.published_at)}</span>
      <a class="release-download interactive" href="${asset?.browser_download_url || release.html_url}" ${asset ? 'download' : ''} target="_blank" rel="noreferrer" title="${asset ? 'Скачать ReConfigProvince.exe' : 'Открыть релиз'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>
      </a>
    </div>`;
  return row;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadReleases() {
  const list = $('#releasesList');
  try {
    const res = await fetch(RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const releases = (await res.json()).filter(r => !r.draft && !r.prerelease);
    if (!releases.length) throw new Error('Нет опубликованных релизов');

    const latest = releases[0];
    const latestAsset = releaseAsset(latest);
    const latestText = summarize(latest.body || '');

    $('#latestVersion').textContent = latest.tag_name || '—';
    $('#latestDate').textContent = formatDate(latest.published_at);
    $('#latestSize').textContent = formatBytes(latestAsset?.size);
    $('#latestDescription').textContent = latestText.split('\n').slice(0, 5).join('\n');
    $('#downloadSubline').textContent = latestAsset ? `${formatBytes(latestAsset.size)} · Windows EXE` : 'Официальный релиз на GitHub';
    $('#latestReleasePage').href = latest.html_url || RELEASES_PAGE;
    $('#heroVersion').textContent = `Последняя версия: ${latest.tag_name || '—'}`;
    setDownloadLink($('#latestDownload'), latestAsset, latest.html_url || RELEASES_PAGE);

    list.innerHTML = '';
    releases.forEach((release, index) => {
      const row = releaseRow(release, latest.tag_name);
      if (index < 3) row.classList.add(`delay-${Math.min(index,2)}`);
      list.appendChild(row);
    });
    observeReveals();
    bindCursorHover();
  } catch (err) {
    console.warn(err);
    $('#latestVersion').textContent = 'GitHub';
    $('#latestDate').textContent = '—';
    $('#latestSize').textContent = '—';
    $('#latestDescription').textContent = 'Не удалось получить данные GitHub автоматически. Открой страницу Releases, чтобы скачать последнюю версию.';
    $('#heroVersion').textContent = 'Актуальная версия — в GitHub Releases';
    setDownloadLink($('#latestDownload'), null, RELEASES_PAGE);
    $('#latestReleasePage').href = RELEASES_PAGE;
    list.innerHTML = `<div class="empty-state">Не удалось загрузить историю версий. <a href="${RELEASES_PAGE}" target="_blank" rel="noreferrer" style="color:var(--accent-light)">Открыть Releases на GitHub →</a></div>`;
  }
}

let revealObserver;
function applyRevealStagger() {
  const groups = [
    ['.about-grid .reveal', 75],
    ['.feature-list .reveal', 55],
    ['.releases-list .reveal', 45],
    ['.faq-grid .reveal', 70]
  ];
  groups.forEach(([selector, step]) => {
    $$(selector).forEach((el, index) => {
      if (!el.classList.contains('delay-1') && !el.classList.contains('delay-2')) {
        el.style.setProperty('--reveal-delay', `${Math.min(index * step, 220)}ms`);
      }
    });
  });
}

function observeReveals() {
  applyRevealStagger();
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .11, rootMargin: '0px 0px -7% 0px' });
  }
  $$('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}

function initHeader() {
  const topbar = $('#topbar');
  const sync = () => topbar?.classList.toggle('scrolled', window.scrollY > 18);
  sync();
  window.addEventListener('scroll', sync, { passive:true });
}

let hoverBound = new WeakSet();
function bindCursorHover() {
  $$('.interactive, a, button, summary, .interactive-card, .feature-row').forEach(el => {
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
    mouseX = e.clientX; mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive:true });
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

function initFaq() {
  $$('.faq-item').forEach(item => {
    const button = $('.faq-summary', item);
    if (!button) return;
    button.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      $$('.faq-item.open').forEach(other => {
        if (other === item) return;
        other.classList.remove('open');
        $('.faq-summary', other)?.setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('open', willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });
}

function initParallax() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frame = $('#previewFrame');
  if (!frame) return;

  let mouseX = innerWidth / 2;
  let mouseY = innerHeight / 2;
  let tx = 0, ty = 0, trx = 0, try_ = 0;
  let x = 0, y = 0, rx = 0, ry = 0;
  let pointerInside = true;

  const updateTarget = () => {
    if (!pointerInside) {
      tx = ty = trx = try_ = 0;
      return;
    }

    const rect = frame.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (mouseX - centerX) / Math.max(rect.width * .8, 1)));
    const ny = Math.max(-1, Math.min(1, (mouseY - centerY) / Math.max(rect.height * .8, 1)));

    tx = nx * 8;
    ty = ny * 5;
    trx = -ny * 4.8;
    try_ = nx * 6.2;

    const localX = Math.max(0, Math.min(100, ((mouseX - rect.left) / Math.max(rect.width, 1)) * 100));
    const localY = Math.max(0, Math.min(100, ((mouseY - rect.top) / Math.max(rect.height, 1)) * 100));
    frame.style.setProperty('--shine-x', `${localX.toFixed(1)}%`);
    frame.style.setProperty('--shine-y', `${localY.toFixed(1)}%`);
  };

  window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    pointerInside = true;
    updateTarget();
  }, { passive:true });

  document.documentElement.addEventListener('mouseleave', () => {
    pointerInside = false;
    updateTarget();
  });
  document.documentElement.addEventListener('mouseenter', () => {
    pointerInside = true;
    updateTarget();
  });
  window.addEventListener('scroll', updateTarget, { passive:true });
  window.addEventListener('resize', updateTarget, { passive:true });

  const animate = () => {
    x += (tx - x) * .09;
    y += (ty - y) * .09;
    rx += (trx - rx) * .085;
    ry += (try_ - ry) * .085;
    frame.style.transform = `perspective(1050px) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    requestAnimationFrame(animate);
  };

  updateTarget();
  animate();
}

function initHeroDownloadScroll() {
  const button = $('#heroDownload');
  const panel = $('.download-panel');
  if (!button || !panel) return;

  button.setAttribute('href', '#downloads');
  button.addEventListener('click', e => {
    e.preventDefault();
    if (typeof window.cancelPageInertia === 'function') window.cancelPageInertia();

    // Центрируем именно карточку последней версии, а не весь раздел вместе с историей.
    const rect = panel.getBoundingClientRect();
    const panelCenter = scrollY + rect.top + rect.height / 2;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const target = Math.max(0, Math.min(maxScroll, panelCenter - innerHeight / 2));

    window.scrollTo({ top: target, behavior: 'smooth' });
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
    thumb.classList.remove('dragging');
    try { thumb.releasePointerCapture?.(e.pointerId); } catch (_) {}
  };

  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('scroll', sync, { passive:true });
  window.addEventListener('resize', sync, { passive:true });

  sync();
}

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initFaq();
initParallax();
initHeroDownloadScroll();
initDragScroll();
initCustomScrollbar();
loadReleases();
