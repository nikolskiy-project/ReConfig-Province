const REPO_OWNER = 'nikolskiy-project';
const REPO_NAME = 'ReConfig-Province';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;
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

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function setDownloadLink(anchor, asset) {
  if (!anchor || !asset?.browser_download_url) return false;
  anchor.href = asset.browser_download_url;
  anchor.classList.remove('disabled');
  anchor.removeAttribute('aria-disabled');
  return true;
}

function releaseRow(release) {
  const asset = releaseAsset(release);
  const mode = updateMode(release.body || '');
  const row = document.createElement('article');
  row.className = 'release-item reveal';
  const title = release.name || `ReConfig Province ${release.tag_name || ''}`;
  const desc = summarize(release.body || '');
  row.innerHTML = `
    <div class="release-ver">
      <strong>${escapeHtml(release.tag_name || 'Без номера')}</strong>
      ${mode === 'required' ? '<span class="release-badge required">Важная</span>' : ''}
    </div>
    <div class="release-info">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
    </div>
    <div class="release-actions">
      <span class="release-date">${formatDate(release.published_at)}</span>
      ${asset ? `<a class="release-download interactive" href="${escapeHtml(asset.browser_download_url)}" title="Скачать эту версию" aria-label="Скачать ${escapeHtml(release.tag_name || 'версию')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>
      </a>` : `<span class="release-download disabled" title="Файл этой версии недоступен">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>
      </span>`}
    </div>`;
  return row;
}

async function loadReleases() {
  const list = $('#releasesList');
  try {
    const res = await fetch(RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Update service: ${res.status}`);

    const releases = (await res.json())
      .filter(r => !r.draft && !r.prerelease)
      .sort((a,b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));

    if (!releases.length) throw new Error('Нет опубликованных версий');

    const latest = releases[0];
    const latestAsset = releaseAsset(latest);
    const latestText = summarize(latest.body || '');

    $('#latestVersion').textContent = latest.tag_name || '—';
    $('#latestDate').textContent = formatDate(latest.published_at);
    $('#latestSize').textContent = formatBytes(latestAsset?.size);
    $('#latestDescription').textContent = latestText.split('\n').slice(0,5).join('\n');
    $('#downloadSubline').textContent = latestAsset ? `${formatBytes(latestAsset.size)} · Windows` : 'Файл временно недоступен';
    $('#heroVersion').textContent = `Последняя версия: ${latest.tag_name || '—'}`;

    setDownloadLink($('#latestDownload'), latestAsset);
    if (latestAsset) setDownloadLink($('#heroDownload'), latestAsset);

    list.innerHTML = '';
    const previous = releases.slice(1);
    if (!previous.length) {
      list.innerHTML = '<div class="empty-state">Предыдущих версий пока нет.</div>';
    } else {
      previous.forEach((release, index) => {
        const row = releaseRow(release);
        if (index < 3) row.classList.add(`delay-${Math.min(index,2)}`);
        list.appendChild(row);
      });
    }

    observeReveals();
    bindCursorHover();
  } catch (err) {
    console.warn(err);
    $('#latestVersion').textContent = '—';
    $('#latestDate').textContent = '—';
    $('#latestSize').textContent = '—';
    $('#latestDescription').textContent = 'Не удалось получить информацию об актуальной версии. Попробуйте обновить страницу немного позже.';
    $('#downloadSubline').textContent = 'Информация временно недоступна';
    $('#heroVersion').textContent = 'Не удалось проверить актуальную версию';
    list.innerHTML = '<div class="empty-state">История версий временно недоступна. Попробуйте обновить страницу позже.</div>';
  }
}

let revealObserver;
function prepareRevealAnimations() {
  $$('.reveal').forEach((el, index) => {
    if (!el.dataset.revealPrepared) {
      el.dataset.revealPrepared = '1';

      // Небольшая индивидуальность для разных блоков без резких эффектов.
      if (el.classList.contains('section-heading') || el.classList.contains('versions-head')) {
        el.dataset.revealStyle = 'left';
      } else if (el.classList.contains('feature-row')) {
        el.dataset.revealStyle = 'row';
      } else if (el.classList.contains('release-item')) {
        el.dataset.revealStyle = 'release';
      } else if (el.classList.contains('download-panel')) {
        el.dataset.revealStyle = 'scale';
      } else {
        el.dataset.revealStyle = 'up';
      }

      // Автоматический каскад для соседних элементов.
      const parent = el.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(child => child.classList?.contains('reveal'));
        const localIndex = Math.max(0, siblings.indexOf(el));
        el.style.setProperty('--reveal-delay', `${Math.min(localIndex * 55, 220)}ms`);
      } else {
        el.style.setProperty('--reveal-delay', `${Math.min(index * 20, 180)}ms`);
      }
    }
  });
}

function observeReveals() {
  prepareRevealAnimations();
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
    }, { threshold:.11, rootMargin:'0px 0px -48px' });
  }
  $$('.reveal:not(.visible)').forEach(el => revealObserver.observe(el));
}

function initHeader() {
  const topbar = $('#topbar');
  let lastY = window.scrollY;
  let ticking = false;

  const sync = () => {
    const y = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, y / maxScroll));

    topbar?.classList.toggle('scrolled', y > 18);
    document.body.classList.toggle('scrolling-down', y > lastY + 2);
    document.body.classList.toggle('scrolling-up', y < lastY - 2);
    document.documentElement.style.setProperty('--scroll-progress', progress.toFixed(4));
    lastY = y;
    ticking = false;
  };

  const requestSync = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sync);
  };

  sync();
  window.addEventListener('scroll', requestSync, { passive:true });
  window.addEventListener('resize', requestSync, { passive:true });
}

let hoverBound = new WeakSet();
function bindCursorHover() {
  $$('.interactive,a,button,summary,.interactive-card,.feature-row,.preview-frame').forEach(el => {
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
  }, { passive:true });
  addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));
  addEventListener('mouseenter', () => document.body.classList.add('cursor-active'));

  const frame = () => {
    dotX += (mouseX - dotX) * .38;
    dotY += (mouseY - dotY) * .38;
    ringX += (mouseX - ringX) * .115;
    ringY += (mouseY - ringY) * .115;
    glowX += (mouseX - glowX) * .035;
    glowY += (mouseY - glowY) * .035;
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
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      $$('.faq-item').forEach(other => { if (other !== item) other.open = false; });
    });
  });
}

function initPreviewMotion() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frame = $('#previewFrame');
  if (!frame) return;
  window.addEventListener('mousemove', e => {
    const nx = e.clientX / innerWidth - .5;
    const ny = e.clientY / innerHeight - .5;
    frame.style.transform = `translate3d(${(nx * 3).toFixed(2)}px,${(ny * 2).toFixed(2)}px,0)`;
  }, { passive:true });
}

function initDragScroll() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900) return;

  let isDown = false;
  let didDrag = false;
  let startY = 0;
  let startScroll = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let momentumFrame = 0;

  const interactiveSelector = 'a, button, summary, input, textarea, select, option, [contenteditable="true"]';

  const stopMomentum = () => {
    if (momentumFrame) cancelAnimationFrame(momentumFrame);
    momentumFrame = 0;
  };

  const endDrag = () => {
    if (!isDown) return;
    isDown = false;
    document.body.classList.remove('page-drag-ready', 'page-dragging');

    if (!didDrag || Math.abs(velocity) < .08 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let v = velocity * 16;
    const momentum = () => {
      if (Math.abs(v) < .15) {
        momentumFrame = 0;
        return;
      }
      window.scrollBy(0, -v);
      v *= .92;
      momentumFrame = requestAnimationFrame(momentum);
    };
    momentumFrame = requestAnimationFrame(momentum);
  };

  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest(interactiveSelector)) return;

    stopMomentum();
    isDown = true;
    didDrag = false;
    startY = e.clientY;
    startScroll = window.scrollY;
    lastY = e.clientY;
    lastTime = performance.now();
    velocity = 0;
    document.body.classList.add('page-drag-ready');
  });

  document.addEventListener('mousemove', e => {
    if (!isDown) return;
    const delta = e.clientY - startY;

    if (!didDrag && Math.abs(delta) > 4) {
      didDrag = true;
      document.body.classList.add('page-dragging');
      document.body.classList.remove('page-drag-ready');
    }
    if (!didDrag) return;

    e.preventDefault();
    window.scrollTo(0, startScroll - delta * 1.08);

    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    velocity = (e.clientY - lastY) / dt;
    lastY = e.clientY;
    lastTime = now;
  }, { passive:false });

  document.addEventListener('mouseup', endDrag);
  window.addEventListener('blur', endDrag);
  document.addEventListener('mouseleave', e => {
    if (e.relatedTarget === null) endDrag();
  });

  // После реального перетаскивания не даём случайному click сработать на карточке.
  document.addEventListener('click', e => {
    if (!didDrag) return;
    e.preventDefault();
    e.stopPropagation();
    didDrag = false;
  }, true);

  document.addEventListener('mouseup', () => {
    // Если браузер по какой-то причине не отправил click после drag,
    // не блокируем следующий осознанный клик пользователя.
    if (didDrag) setTimeout(() => { didDrag = false; }, 80);
  });
}

// Сайт ведёт себя как приложение: текст и изображения не выделяются и не перетаскиваются.
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initFaq();
initPreviewMotion();
initDragScroll();
loadReleases();
