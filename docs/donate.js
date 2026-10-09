'use strict';
// Впиши персональные ссылки перед публикацией, если они у тебя уже есть.
// Пример: 'https://t.me/CryptoBot?start=...'
// Пример: 'https://donatello.to/имя-твоего-профиля'
// Пока значения пустые, кнопки безопасно отключены и не ведут на чужие страницы.
const DONATION_LINKS = {
  cryptoBot: '',
  donatello: ''
};

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
    const domains = name === 'cryptoBot' ? ['t.me', 'telegram.me'] : ['donatello.to', 'donatello.me'];
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
  setDonationLink('cryptoBot', 'cryptoLink', 'cryptoStatus', 'Откроется персональная ссылка в Telegram');
  setDonationLink('donatello', 'donatelloLink', 'donatelloStatus', 'Оплата на личной странице Donatello');

  const toast = byId('donateToast');
  let toastTimer;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
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
