(() => {
  const STORAGE_KEY = 'shizuoka-portal-theme';
  const themes = {
    charcoal: { label:'Charcoal', color:'#2a2a2e' },
    navy: { label:'Deep Navy', color:'#17243a' },
    white: { label:'White', color:'#f7f7f5' },
    ivory: { label:'Ivory', color:'#f4efe5' },
    pink: { label:'Pastel Pink', color:'#f6dce4' },
  };

  function storedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value && themes[value] ? value : 'charcoal';
    } catch {
      return 'charcoal';
    }
  }

  function applyTheme(name, persist = false) {
    const selected = themes[name] ? name : 'charcoal';
    document.documentElement.dataset.theme = selected;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[selected].color);
    document.querySelectorAll('.theme-swatch[data-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.theme === selected));
    });
    const status = document.querySelector('#theme-status');
    if (status) status.textContent = themes[selected].label;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, selected); } catch { /* Preferences remain active for this view. */ }
    }
  }

  const initialTheme = storedTheme();
  applyTheme(initialTheme);

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(initialTheme);
    document.querySelectorAll('.theme-swatch').forEach(button => {
      button.addEventListener('click', () => applyTheme(button.dataset.theme, true));
    });
  });
})();
