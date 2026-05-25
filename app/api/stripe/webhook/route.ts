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
        await handleSubscriptionUpsert(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id
          || await getUserIdFromCustomer(subscription.customer as string);
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
          await handleSubscriptionUpsert(sub, 'past_due');
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
          // subscriptionのmetadataにuserIdを追加してからupsert
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
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  try {
    const { data } = await import('@/lib/subscription').then(m => ({ data: null }));
    return null;
  } catch {
    return null;
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
  const isPremiumPrice = priceId === process.env.STRIPE_PREMIUM_PRICE_ID;
  await upsertSubscription({
    userId: resolvedUserId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan: isPremiumPrice ? 'premium' : 'free',
    status: overrideStatus || subscription.status,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  });
}
async function handleSubscriptionUpsert(
  subscription: Stripe.Subscription,
  overrideStatus?: string
) {
  await handleSubscriptionUpsertWithUserId(subscription, null, overrideStatus);
}
