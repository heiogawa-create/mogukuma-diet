import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSubscription, isPremium, isMax } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);
    const premium = isPremium(subscription);
    const max = isMax(subscription);

    return NextResponse.json({
  plan: subscription?.plan ?? 'free',
  status: subscription?.status ?? 'active',
  isPremium: premium,
  isMax: max,
  currentPeriodEnd: subscription?.current_period_end ?? null,
  currentPeriodStart: subscription?.current_period_start ?? null,
  cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
  hasCustomer: !!subscription?.stripe_customer_id,
});
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
