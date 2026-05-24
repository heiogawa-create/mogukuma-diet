// app/api/stripe/checkout/route.ts
// Stripe Checkout Session を作成するAPIエンドポイント

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  stripe,
  PLANS,
  getOrCreateStripeCustomer,
  createCheckoutSession,
} from '@/lib/stripe';
import { getUserSubscription, upsertSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const user = session.user;
    const origin = request.headers.get('origin') || 'https://mogukuma-diet.vercel.app';

    // 2. 既存サブスク確認
    const subscription = await getUserSubscription(user.id);

    if (subscription?.plan === 'premium' && subscription.status === 'active') {
      return NextResponse.json(
        { error: 'すでにプレミアムプランです' },
        { status: 400 }
      );
    }

    // 3. Stripe Customer 取得または作成
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email!,
      subscription?.stripe_customer_id
    );

    // 4. customer_id を DB に保存（まだない場合）
    if (!subscription?.stripe_customer_id) {
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await adminClient
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // 5. Checkout Session 作成
    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId: PLANS.premium.stripePriceId,
      userId: user.id,
      successUrl: `${origin}/settings?upgrade=success`,
      cancelUrl: `${origin}/pricing?upgrade=canceled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: '決済処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}
