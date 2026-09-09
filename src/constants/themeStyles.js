import { useThemeMode } from '../contexts/ThemeContext';

export function useThemeStyles() {
  const { theme, isDarkMode } = useThemeMode();

  return {
    theme,
    isDarkMode,
    screen: { backgroundColor: theme.background },
    header: { backgroundColor: theme.background, borderColor: theme.border },
    card: { backgroundColor: theme.surface, borderColor: theme.border },
    input: { backgroundColor: theme.input, color: theme.text, borderColor: theme.border },
    text: { color: theme.text },
    secondaryText: { color: theme.textSecondary },
    mutedText: { color: theme.iconMuted },
    statusBar: isDarkMode ? 'light-content' : 'dark-content',
  };
}
