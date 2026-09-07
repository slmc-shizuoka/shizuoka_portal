(() => {
  'use strict';
  const tablist = document.getElementById('view-tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  panels.forEach((panel, index) => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabs[index].id);
    panel.setAttribute('tabindex', '0');
  });
  function activate(index) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
  }
  function targetIndex(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return 0; }
    const target = document.getElementById(id);
    const index = panels.findIndex(panel => target && panel.contains(target));
    return index < 0 ? 0 : index;
  }
  function syncLocation() { activate(targetIndex(window.location.hash)); }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      activate(index);
      const hash = ['#portal', '#dashboard', '#memo', '#gallery'][index];
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    });
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  });
  // Reveal an anchor's panel before native scrolling and header focus handling.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    activate(targetIndex(link.hash));
  }, true);
  window.addEventListener('hashchange', syncLocation);
  window.addEventListener('popstate', syncLocation);
  syncLocation();
  tablist.hidden = false;
})();
