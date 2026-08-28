import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jjbgsztyjpbcgrhxxsho.supabase.co';
const supabaseAnonKey = 'sb_publishable_PSUczjDvYDDEzZh60szj_w_UQzCC5JW';

/** @type {{ getItem: (key: string) => Promise<string | null>, setItem: (key: string, value: string) => Promise<void>, removeItem: (key: string) => Promise<void> }} */
const webStorage = {
  /** @param {string} key */
  getItem: async (key) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  /** @param {string} key @param {string} value */
  setItem: async (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  /** @param {string} key */
  removeItem: async (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);