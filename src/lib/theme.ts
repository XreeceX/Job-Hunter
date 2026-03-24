export const THEME_STORAGE_KEY = 'job-hunter-theme';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Inline in layout <head> — must match applyTheme() in theme-toggle.tsx */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}',t=localStorage.getItem(k),d=!1;if(t==='dark')d=!0;else if(t==='light')d=!1;else if(t==='system')d=window.matchMedia('(prefers-color-scheme: dark)').matches;else d=!1;document.documentElement.classList.toggle('dark',d)}catch(e){}})();`;
