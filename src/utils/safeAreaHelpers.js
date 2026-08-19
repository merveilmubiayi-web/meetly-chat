import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useSafeBottomPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  return { paddingBottom: extra + insets.bottom };
}

export function useSafeVerticalPadding(extraTop = 0, extraBottom = 0) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: extraTop + insets.top,
    paddingBottom: extraBottom + insets.bottom,
  };
}
