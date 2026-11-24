(() => {
  'use strict';

  const key = 'milestones.theme.v1';
  const deviceTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';

  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Follow the system when storage is unavailable on startup.
  }

  function applyTheme() {
    const systemTheme = deviceTheme.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = preference === 'system' ? systemTheme : preference;
  }

  applyTheme();
  deviceTheme.addEventListener('change', applyTheme);

  document.addEventListener('DOMContentLoaded', () => {
    for (const option of document.querySelectorAll('input[name="theme"]')) {
      option.checked = option.value === preference;
      option.addEventListener('change', () => {
        preference = option.value;
        applyTheme();
        const status = document.getElementById('theme-status');
        try {
          localStorage.setItem(key, preference);
          status.textContent = '';
        } catch {
          status.textContent = 'Theme changed for this session.';
        }
      });
    }
  });
})();
