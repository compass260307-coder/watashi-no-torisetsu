import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { getPublicConfig } from '@/lib/config';

let client: SupabaseClient | null = null;
let appStateListenerInstalled = false;

export function getSupabaseClient() {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = getPublicConfig();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabaseの公開設定がありません。.envを設定してください。');
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });

  if (!appStateListenerInstalled && Platform.OS !== 'web') {
    appStateListenerInstalled = true;
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }

  return client;
}
