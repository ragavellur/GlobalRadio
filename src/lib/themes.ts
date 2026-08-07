export interface Theme {
  id: string;
  name: string;
  accent: string;
  rgb: string;
}

export const THEME_KEY = 'globalradio:theme';
export const DEFAULT_THEME_ID = 'blue';

export const THEMES: Theme[] = [
  { id: 'green', name: 'Neon Green', accent: '#00C864', rgb: '0, 200, 100' },
  { id: 'yellow', name: 'Neon Yellow', accent: '#FFEA00', rgb: '255, 234, 0' },
  { id: 'blue', name: 'Neon Blue', accent: '#00C2FF', rgb: '0, 194, 255' },
  { id: 'pink', name: 'Neon Pink', accent: '#FF2D95', rgb: '255, 45, 149' },
  { id: 'purple', name: 'Neon Purple', accent: '#C13BFF', rgb: '193, 59, 255' },
  { id: 'red', name: 'Neon Red', accent: '#FF3B30', rgb: '255, 59, 48' },
  { id: 'orange', name: 'Neon Orange', accent: '#FF9500', rgb: '255, 149, 0' },
];

export function getTheme(id: string): Theme | null {
  return THEMES.find((t) => t.id === id) ?? null;
}

export function loadThemeId(): string {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && getTheme(saved)) return saved;
  } catch {}
  return DEFAULT_THEME_ID;
}

export function applyThemeVars(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty('--gr-accent', theme.accent);
  root.style.setProperty('--gr-accent-rgb', theme.rgb);
}
