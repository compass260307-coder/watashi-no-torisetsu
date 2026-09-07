import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppApiError, getBootstrap } from '@/lib/app-api';
import { getPublicConfig } from '@/lib/config';
import { getSupabaseClient } from '@/lib/supabase';
import { useGuide } from '@/providers/GuideProvider';
import type { BootstrapResponse } from '@/types/app';

type BootstrapContextValue = {
  data: BootstrapResponse | null;
  error: string | null;
  isLoading: boolean;
  refresh: (accessToken?: string) => Promise<BootstrapResponse | null>;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({ children }: PropsWithChildren) {
  const { setGuide } = useGuide();
  const publicConfig = getPublicConfig();
  const hasApiConfig = Boolean(
    publicConfig.apiBaseUrl &&
    publicConfig.supabaseUrl &&
    publicConfig.supabaseAnonKey,
  );
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(hasApiConfig);

  const refresh = useCallback(async (accessToken?: string) => {
    const config = getPublicConfig();
    if (!config.apiBaseUrl || !config.supabaseUrl || !config.supabaseAnonKey) {
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    try {
      const token = accessToken ?? (await getSupabaseClient().auth.getSession()).data.session?.access_token;
      if (!token) {
        setData(null);
        setError(null);
        return null;
      }
      const next = await getBootstrap(token);
      setData(next);
      setError(null);
      setGuide(next.account.guide);
      return next;
    } catch (caught) {
      if (caught instanceof AppApiError && caught.code === 'account_not_linked') {
        setData(null);
        setError(null);
        return null;
      }
      setData(null);
      setError(caught instanceof Error ? caught.message : 'Aliceを読み込めませんでした。');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setGuide]);

  useEffect(() => {
    if (!hasApiConfig) return;
    void getSupabaseClient().auth.getSession().then(({ data: sessionData }) => {
      void refresh(sessionData.session?.access_token);
    });
    const config = getPublicConfig();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;

    const { data: listener } = getSupabaseClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setData(null);
        setError(null);
        setIsLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [hasApiConfig, refresh]);

  const value = useMemo(() => ({ data, error, isLoading, refresh }), [data, error, isLoading, refresh]);
  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap() {
  const context = useContext(BootstrapContext);
  if (!context) throw new Error('useBootstrap must be used inside BootstrapProvider');
  return context;
}
