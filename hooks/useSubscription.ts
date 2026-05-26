'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';

export interface SubscriptionState {
  plan: 'free' | 'premium' | 'max';
  status: string;
  isPremium: boolean;
  isMax: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  loading: boolean;
  error: string | null;
}

const DEFAULT_STATE: SubscriptionState = {
  plan: 'free',
  status: 'active',
  isPremium: false,
  isMax: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
  loading: true,
  error: null,
};

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);

  const fetchSubscription = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let session = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          session = data.session;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!session) {
        setState(prev => ({ ...prev, loading: false, error: '認証が必要です' }));
        return;
      }

      const res = await fetch('/api/stripe/subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setState({ ...data, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: 'サブスク情報の取得に失敗しました' }));
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        fetchSubscription();
      }
    });
    fetchSubscription();
    return () => subscription.unsubscribe();
  }, [fetchSubscription]);

  const startCheckout = useCallback(async (plan: 'premium' | 'max' = 'premium') => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'checkout failed');
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message || '決済処理でエラーが発生しました' }));
    }
  }, []);

  const openPortal = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'portal failed');
      }
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message || 'ポータルへのアクセスでエラーが発生しました' }));
    }
  }, []);

  return { ...state, refetch: fetchSubscription, startCheckout, openPortal };
}
