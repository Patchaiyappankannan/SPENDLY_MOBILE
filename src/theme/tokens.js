// Design tokens. Ink-navy primary + brass accent: calm, ledger-like, readable at a glance.
export const palette = {
  light: {
    bg: '#F3F5F8', surface: '#FFFFFF', surfaceAlt: '#E9EDF3',
    text: '#111827', textMuted: '#6B7280', border: '#E1E6EE',
    primary: '#14213D', primarySoft: '#E3E8F2', onPrimary: '#FFFFFF',
    accent: '#B7791F', accentSoft: '#F8EBD0',
    income: '#1B8A5A', incomeSoft: '#DDF3E8',
    expense: '#C8442F', expenseSoft: '#FBE4DF',
    hero: '#14213D', heroText: '#FFFFFF', heroMuted: '#A9B6D3', heroChip: 'rgba(255,255,255,0.10)',
  },
  dark: {
    bg: '#0C111B', surface: '#151C2B', surfaceAlt: '#1D2639',
    text: '#F1F5F9', textMuted: '#94A3B8', border: '#26314A',
    primary: '#9DB4E3', primarySoft: '#202C45', onPrimary: '#0C111B',
    accent: '#E3AE4A', accentSoft: '#3A2E14',
    income: '#4CC38A', incomeSoft: '#12301F',
    expense: '#F0806C', expenseSoft: '#3A1D18',
    hero: '#1E2B47', heroText: '#FFFFFF', heroMuted: '#9DB0D6', heroChip: 'rgba(255,255,255,0.08)',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const font = { xs: 12, sm: 13, md: 15, lg: 17, xl: 22, xxl: 32 };

export const shadow = (dark) =>
  dark ? {} : { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
