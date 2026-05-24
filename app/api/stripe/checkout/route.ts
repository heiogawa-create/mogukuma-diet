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

    const origin = request.headers.get('origin') || 'https://mogukuma-diet.vercel.app';
    const subscription = await getUserSubscription(user.id);

    if (subscription?.plan === 'premium' && subscription.status === 'active') {
      return NextResponse.json({ error: 'すでにプレミアムプランです' }, { status: 400 });
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
    return NextResponse.json({ error: '決済処理でエラーが発生しました' }, { status: 500 });
  }
}
