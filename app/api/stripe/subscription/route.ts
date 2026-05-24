// app/api/stripe/subscription/route.ts
// クライアントからサブスク状態を取得するAPI

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getUserSubscription, isPremium } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
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
