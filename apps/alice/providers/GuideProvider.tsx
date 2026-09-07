import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getPublicConfig } from '@/lib/config';
import { getSupabaseClient } from '@/lib/supabase';
import type { Guide } from '@/types/foundation';

const STORAGE_KEY = 'alice.guide.v1';

type GuideContextValue = {
  guide: Guide;
  isReady: boolean;
  setGuide: (guide: Guide) => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function GuideProvider({ children }: PropsWithChildren) {
  const [guide, setGuideState] = useState<Guide>('alice');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedGuide) => {
        if (isMounted && (storedGuide === 'alice' || storedGuide === 'harry')) {
          setGuideState(storedGuide);
        }
      })
      .finally(() => {
        if (isMounted) setIsReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setGuide = useCallback((nextGuide: Guide) => {
    setGuideState(nextGuide);
    void AsyncStorage.setItem(STORAGE_KEY, nextGuide);
    const config = getPublicConfig();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      void getSupabaseClient().auth.getSession().then(({ data }) => {
        if (!data.session) return;
        return getSupabaseClient().from('accounts').update({ guide: nextGuide }).eq('id', data.session.user.id);
      }).catch(() => undefined);
    }
  }, []);

  const value = useMemo(() => ({ guide, isReady, setGuide }), [guide, isReady, setGuide]);

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useGuide() {
  const context = useContext(GuideContext);

  if (!context) {
    throw new Error('useGuide must be used inside GuideProvider');
  }

  return context;
}
