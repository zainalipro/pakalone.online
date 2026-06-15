export interface ThemePalette {
  name: string;
  id: string;
  isDark: boolean;
  colors: {
    '--theme-primary-50': string;
    '--theme-primary-100': string;
    '--theme-primary-200': string;
    '--theme-primary-300': string;
    '--theme-primary-400': string;
    '--theme-primary-500': string;
    '--theme-primary-600': string;
    '--theme-primary-700': string;
    '--theme-primary-800': string;
    '--theme-primary-900': string;

    '--theme-bg': string;
    '--theme-card': string;
    '--theme-card-hover': string;
    '--theme-border': string;
    '--theme-header-bg': string;
    '--theme-text-main': string;
    '--theme-text-muted': string;
    '--theme-text-accent': string;

    '--theme-pulse-low': string;
    '--theme-pulse-mid': string;
    '--theme-pulse-lowest': string;
    '--theme-pulse-high': string;
    '--theme-pulse-highest': string;
  };
}

export const THEMES: ThemePalette[] = [
  {
    name: '🌐 Clean SaaS Light',
    id: 'saas-light',
    isDark: false,
    colors: {
      '--theme-primary-50': '#eff6ff',
      '--theme-primary-100': '#dbeafe',
      '--theme-primary-200': '#bfdbfe',
      '--theme-primary-300': '#93c5fd',
      '--theme-primary-400': '#60a5fa',
      '--theme-primary-500': '#3b82f6',
      '--theme-primary-600': '#2563eb',
      '--theme-primary-700': '#1d4ed8',
      '--theme-primary-800': '#1e40af',
      '--theme-primary-900': '#1e3a8a',

      '--theme-bg': '#f8fafc',
      '--theme-card': '#ffffff',
      '--theme-card-hover': '#f1f5f9',
      '--theme-border': '#e2e8f0',
      '--theme-header-bg': '#ffffff',
      '--theme-text-main': '#0f172a',
      '--theme-text-muted': '#475569',
      '--theme-text-accent': '#2563eb',

      '--theme-pulse-low': 'rgba(37, 99, 235, 0.2)',
      '--theme-pulse-mid': 'rgba(37, 99, 235, 0.08)',
      '--theme-pulse-lowest': 'rgba(37, 99, 235, 0.02)',
      '--theme-pulse-high': 'rgba(37, 99, 235, 0.5)',
      '--theme-pulse-highest': 'rgba(37, 99, 235, 0.2)',
    },
  },
  {
    name: '🌌 Blue Pro Dark',
    id: 'saas-dark',
    isDark: true,
    colors: {
      '--theme-primary-50': '#f0f9ff',
      '--theme-primary-100': '#e0f2fe',
      '--theme-primary-200': '#bae6fd',
      '--theme-primary-300': '#7dd3fc',
      '--theme-primary-400': '#38bdf8',
      '--theme-primary-500': '#0ea5e9',
      '--theme-primary-600': '#0284c7',
      '--theme-primary-700': '#0369a1',
      '--theme-primary-800': '#075985',
      '--theme-primary-900': '#0c4a6e',

      '--theme-bg': '#090d16',
      '--theme-card': '#0f172a',
      '--theme-card-hover': '#1e293b',
      '--theme-border': '#1e293b',
      '--theme-header-bg': '#0f172a',
      '--theme-text-main': '#f8fafc',
      '--theme-text-muted': '#94a3b8',
      '--theme-text-accent': '#38bdf8',

      '--theme-pulse-low': 'rgba(56, 189, 248, 0.3)',
      '--theme-pulse-mid': 'rgba(56, 189, 248, 0.1)',
      '--theme-pulse-lowest': 'rgba(56, 189, 248, 0.02)',
      '--theme-pulse-high': 'rgba(56, 189, 248, 0.6)',
      '--theme-pulse-highest': 'rgba(56, 189, 248, 0.3)',
    },
  },
  {
    name: '🏆 Classic gold',
    id: 'gold',
    isDark: true,
    colors: {
      '--theme-primary-50': '#fefcf0',
      '--theme-primary-100': '#fdf5cc',
      '--theme-primary-200': '#fae792',
      '--theme-primary-300': '#f6d14f',
      '--theme-primary-400': '#f1b71d',
      '--theme-primary-500': '#dca00f',
      '--theme-primary-600': '#b57a09',
      '--theme-primary-700': '#8c5809',
      '--theme-primary-800': '#673d09',
      '--theme-primary-900': '#4a2806',

      '--theme-bg': '#08080c',
      '--theme-card': '#0f0f15',
      '--theme-card-hover': '#1c1c24',
      '--theme-border': '#1c1c24',
      '--theme-header-bg': '#0f0f15',
      '--theme-text-main': '#f3f4f6',
      '--theme-text-muted': '#a1a1aa',
      '--theme-text-accent': '#f1b71d',

      '--theme-pulse-low': 'rgba(220, 160, 15, 0.4)',
      '--theme-pulse-mid': 'rgba(220, 160, 15, 0.15)',
      '--theme-pulse-lowest': 'rgba(220, 160, 15, 0.05)',
      '--theme-pulse-high': 'rgba(220, 160, 15, 0.8)',
      '--theme-pulse-highest': 'rgba(220, 160, 15, 0.4)',
    },
  },
];

export function applyTheme(themeId: string) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  if (theme.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('pakalone-theme', themeId);
}
