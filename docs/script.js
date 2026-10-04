const REPO_OWNER = 'nikolskiy-project';
const REPO_NAME = 'ReConfig-Province';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`;
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
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
    setDownloadLink($('#heroDownload'), latestAsset, latest.html_url || RELEASES_PAGE);

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
function observeReveals() {
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
    }, { threshold: .12, rootMargin: '0px 0px -30px' });
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
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      $$('.faq-item').forEach(other => { if (other !== item) other.open = false; });
    });
  });
}

function initParallax() {
  if (!matchMedia('(pointer:fine)').matches || innerWidth < 900 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shell = $('.window-shell');
  if (!shell) return;
  window.addEventListener('mousemove', e => {
    const nx = (e.clientX / innerWidth - .5);
    const ny = (e.clientY / innerHeight - .5);
    shell.style.transform = `rotateY(${(-4 + nx * 2.2).toFixed(2)}deg) rotateX(${(1.5 - ny * 1.5).toFixed(2)}deg) translate3d(0,0,0)`;
  }, { passive:true });
}

$('#year').textContent = new Date().getFullYear();
observeReveals();
initHeader();
initCursor();
initFaq();
initParallax();
loadReleases();
