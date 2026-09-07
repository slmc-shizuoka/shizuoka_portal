(() => {
  'use strict';
  const clock = document.getElementById('header-time');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  function updateClock() {
    const now = new Date();
    clock.textContent = formatter.format(now);
    clock.dateTime = now.toISOString();
    clock.setAttribute('aria-label', `日本時間 ${clock.textContent}`);
  }
  updateClock();
  window.setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });

  const menu = document.getElementById('header-menu');
  const toggle = menu.querySelector('summary');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('focusin', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menu.open = false;
    const destination = document.getElementById(link.hash.slice(1));
    if (destination) {
      destination.setAttribute('tabindex', '-1');
      destination.focus({ preventScroll: true });
    }
  }));
})();
