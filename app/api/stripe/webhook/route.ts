import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe, constructWebhookEvent } from '@/lib/stripe';
import { upsertSubscription, downgradeToFree } from '@/lib/subscription';

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
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsertWithUserId(subscription, null);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          await downgradeToFree(userId);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await handleSubscriptionUpsertWithUserId(sub, null, 'past_due');
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const userId = session.metadata?.supabase_user_id;
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          if (userId && !subscription.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(session.subscription as string, {
              metadata: { supabase_user_id: userId },
            });
          }
          await handleSubscriptionUpsertWithUserId(subscription, userId);
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleSubscriptionUpsertWithUserId(
  subscription: Stripe.Subscription,
  userId?: string | null,
  overrideStatus?: string
) {
  const resolvedUserId = userId || subscription.metadata?.supabase_user_id;
  if (!resolvedUserId) {
    console.error('No userId found for subscription:', subscription.id);
    return;
  }
  const priceId = subscription.items.data[0]?.price.id;

  // プランを判定
  let plan: 'free' | 'premium' | 'max' = 'free';
  if (priceId === process.env.STRIPE_MAX_PRICE_ID) {
    plan = 'max';
  } else if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
    plan = 'premium';
  }

  const item = subscription.items.data[0];
  const periodStart = (item as any)?.current_period_start
    ?? (subscription as any).current_period_start;
  const periodEnd = (item as any)?.current_period_end
    ?? (subscription as any).current_period_end;

  const currentPeriodStart = periodStart
    ? new Date(periodStart * 1000)
    : new Date();
  const currentPeriodEnd = periodEnd
    ? new Date(periodEnd * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await upsertSubscription({
    userId: resolvedUserId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    status: overrideStatus || subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });
}
