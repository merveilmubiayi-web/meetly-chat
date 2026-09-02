import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const nativeRedirectUri = 'meetlyneuf://auth/callback';

export function getGoogleRedirectUri() {
  if (Platform.OS === 'web') {
    const configuredWebUrl = process.env.EXPO_PUBLIC_WEB_URL;
    if (configuredWebUrl) return `${configuredWebUrl.replace(/\/$/, '')}/auth/callback`;
    if (typeof window !== 'undefined') {
      const origin = window.location.origin || 'http://localhost:8083';
      return `${origin.replace(/\/$/, '')}/auth/callback`;
    }
  }

  return makeRedirectUri({
    native: nativeRedirectUri,
    scheme: 'meetlyneuf',
    path: 'auth/callback',
  });
}

export async function completeNativeGoogleSession(result) {
  const redirectUrl = result?.url || (typeof window !== 'undefined' ? window.location.href : '');
  if (!redirectUrl) return false;

  const parsedUrl = new URL(redirectUrl);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(parsedUrl.search.replace(/^\?/, ''));

  const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
  const code = queryParams.get('code');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const errorParam = queryParams.get('error') || hashParams.get('error');
  if (errorParam) {
    throw new Error(decodeURIComponent(errorParam));
  }

  return false;
}
