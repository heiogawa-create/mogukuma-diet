import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserSubscription, isPremium } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const subscription = await getUserSubscription(session.user.id);
    const premium = isPremium(subscription);

    return NextResponse.json({
      plan: subscription?.plan ?? 'free',
      status: subscription?.status ?? 'active',
      isPremium: premium,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      hasCustomer: !!subscription?.stripe_customer_id,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}