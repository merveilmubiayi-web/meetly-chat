import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext(null);

export const palette = {
  light: {
    background: '#0a0a0c',
    surface: '#141418',
    surfaceStrong: '#20202a',
    border: 'rgba(255, 255, 255, 0.05)',
    text: '#ffffff',
    textSecondary: '#8a8a9a',
    icon: '#ffffff',
    iconMuted: '#8a8a9a',
    accent: '#a613c4',
    accentSoft: 'rgba(166, 19, 196, 0.15)',
    input: '#0a0a0c',
    shadow: 'rgba(0, 0, 0, 0.35)',
    success: '#10b981',
  },
  dark: {
    background: '#0a0a0c',
    surface: '#141418',
    surfaceStrong: '#20202a',
    border: 'rgba(255, 255, 255, 0.05)',
    text: '#ffffff',
    textSecondary: '#8a8a9a',
    icon: '#ffffff',
    iconMuted: '#8a8a9a',
    accent: '#a613c4',
    accentSoft: 'rgba(166, 19, 196, 0.15)',
    input: '#0a0a0c',
    shadow: 'rgba(0, 0, 0, 0.5)',
    success: '#10b981',
  },
};

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemScheme === 'dark');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('@meetly/theme')
      .then((savedTheme) => {
        if (!mounted) return;
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setIsDarkMode(savedTheme === 'dark');
        } else if (systemScheme) {
          setIsDarkMode(systemScheme === 'dark');
        }
      })
      .catch(() => {
        if (mounted && systemScheme) setIsDarkMode(systemScheme === 'dark');
      });

    return () => {
      mounted = false;
    };
  }, [systemScheme]);

  useEffect(() => {
    AsyncStorage.setItem('@meetly/theme', isDarkMode ? 'dark' : 'light').catch(() => {});
  }, [isDarkMode]);

  const value = useMemo(
    () => ({
      isDarkMode,
      setIsDarkMode,
      theme: isDarkMode ? palette.dark : palette.light,
    }),
    [isDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { isDarkMode: true, setIsDarkMode: () => {}, theme: palette.dark };
  }
  return context;
}
