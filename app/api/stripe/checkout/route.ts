import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  PLANS,
  getOrCreateStripeCustomer,
  createCheckoutSession,
} from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
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

    // リクエストボディからプランを取得
    const body = await request.json().catch(() => ({}));
    const planId = body.plan === 'max' ? 'max' : 'premium';

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://mogukuma-diet.netlify.app';
    const subscription = await getUserSubscription(user.id);

    // すでに同じプランの場合はエラー
    if (subscription?.plan === planId && subscription.status === 'active') {
      return NextResponse.json({ error: `すでに${planId === 'max' ? 'MAX' : 'プレミアム'}プランです` }, { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email!,
      subscription?.stripe_customer_id
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!subscription?.stripe_customer_id) {
      await supabaseAdmin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const priceId = planId === 'max'
      ? PLANS.max.stripePriceId
      : PLANS.premium.stripePriceId;

    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${origin}/?upgrade=success`,
      cancelUrl: `${origin}/pricing?upgrade=canceled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: '決済処理でエラーが発生しました' }, { status: 500 });
  }
}
