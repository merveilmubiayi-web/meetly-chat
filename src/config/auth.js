import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const nativeRedirectUri = 'meetlyneuf://auth/callback';

export function getGoogleRedirectUri() {
  if (Platform.OS === 'web') {
    const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL;
    if (configuredWebUrl) return `${configuredWebUrl.replace(/\/$/, '')}/auth/callback`;
    if (typeof window !== 'undefined') return `${window.location.origin}/auth/callback`;
  }

  return makeRedirectUri({
    native: nativeRedirectUri,
    scheme: 'meetlyneuf',
    path: 'auth/callback',
  });
}

export async function completeNativeGoogleSession(result) {
  const redirectUrl = result?.url;
  if (!redirectUrl) return false;

  const parsedUrl = new URL(redirectUrl);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (!accessToken || !refreshToken) return false;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return true;
}
