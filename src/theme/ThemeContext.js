import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palette } from './tokens';
import { getSetting, setSetting } from '../repositories/settingsRepo';

// Holds appearance (system/light/dark) and currency symbol: both are device-level preferences.
const Ctx = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('system');
  const [currency, setCurrencyState] = useState('₹');

  useEffect(() => {
    (async () => {
      setModeState(await getSetting('theme', 'system'));
      setCurrencyState(await getSetting('currency', '₹'));
    })();
  }, []);

  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const value = useMemo(
    () => ({
      c: dark ? palette.dark : palette.light,
      dark, mode, currency,
      setMode: async (m) => { setModeState(m); await setSetting('theme', m); },
      setCurrency: async (x) => { setCurrencyState(x); await setSetting('currency', x); },
    }),
    [dark, mode, currency]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
