import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// Check if we are running in Node.js environment (SSR)
const isServer = typeof window === 'undefined';

// SSR-safe storage handler
const safeStorage = {
  getItem: async (key: string) => {
    if (isServer) return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (isServer) return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string) => {
    if (isServer) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'wacrm',
  },
  auth: {
    storage: safeStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
