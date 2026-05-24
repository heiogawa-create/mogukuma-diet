// app/api/stripe/webhook/route.ts
// Stripe Webhook イベントを受け取り、DBを更新する

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, constructWebhookEvent, PLANS } from '@/lib/stripe';
import { upsertSubscription, downgradeToFree } from '@/lib/subscription';

// Next.js の body parser を無効化（生のbodyが必要）
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(Buffer.from(body), signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // =============================================
      // サブスク作成・更新
      // =============================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(subscription);
        break;
      }

      // =============================================
      // サブスク削除（解約）
      // =============================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          await downgradeToFree(userId);
          console.log(`Downgraded user ${userId} to free plan`);
        }
        break;
      }

      // =============================================
      // 支払い失敗
      // =============================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await handleSubscriptionUpsert(sub, 'past_due');
        }
        break;
      }

      // =============================================
      // Checkout完了
      // =============================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await handleSubscriptionUpsert(subscription);
        }
        break;
      }

      default:
        // 不要なイベントは無視
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// =============================================
// サブスクリプション情報を DB に反映
// =============================================
async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription,
  overrideStatus?: string
) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.warn('No supabase_user_id in subscription metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const isPremiumPrice = priceId === process.env.STRIPE_PREMIUM_PRICE_ID;

  await upsertSubscription({
    userId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan: isPremiumPrice ? 'premium' : 'free',
    status: overrideStatus || subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  console.log(`Subscription upserted for user ${userId}: ${subscription.status}`);
}
