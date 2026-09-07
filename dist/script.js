/* Progressive enhancement: navigation and links work without JavaScript. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window)) return;
  // Animate visible content without hiding it when scripting is unavailable.
  const running = new Set();
  const played = new WeakSet();
  function enter(element, delay = 0) {
    if (reducedMotion.matches || played.has(element) || !element.animate) return;
    played.add(element);
    const animation = element.animate([
      { opacity: 0.25, transform: 'translateY(22px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 650, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    running.add(animation);
    animation.finished.then(() => running.delete(animation), () => running.delete(animation));
  }
  document.querySelectorAll('.hero__intro, .hero h1, .hero__side').forEach((element, index) => {
    enter(element, index * 90);
  });
  const revealObserver = new IntersectionObserver((entries, observer) => {
    let order = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      enter(entry.target, order++ * 65);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section-heading, .feature, .category, .footer').forEach(element => {
    revealObserver.observe(element);
  });
  // Keyboard and anchor navigation should never wait for an entrance animation.
  document.addEventListener('focusin', () => running.forEach(animation => animation.finish()));
  window.addEventListener('hashchange', () => running.forEach(animation => animation.finish()));
  reducedMotion.addEventListener('change', event => {
    if (event.matches) running.forEach(animation => animation.cancel());
  });
  const categoryLinks = [...document.querySelectorAll('.directory-nav__link')];
  const categoryObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    if (!visible.length) return;
    const currentId = visible[0].target.id;
    categoryLinks.forEach(link => {
      if (link.hash === `#${currentId}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('.category').forEach(section => categoryObserver.observe(section));
})();
