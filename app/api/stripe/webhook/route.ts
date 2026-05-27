import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripe, constructWebhookEvent } from '@/lib/stripe';
import { upsertSubscription, downgradeToFree } from '@/lib/subscription';
import {
  activateReferralAndUpdatePlan,
  updateCurrentPlan,
  recordReward,
  checkCardFingerprintFraud,
  getCurrentYearMonth,
} from '@/lib/referral';
import type { Plan } from '@/types/referral';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        const plan = getPlanFromPriceId(subscription.items.data[0]?.price.id);
        const userId = subscription.metadata?.supabase_user_id;

        await handleSubscriptionUpsert(subscription, null);

        if (userId && plan !== 'free') {
          await updateCurrentPlan(userId, plan);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        if (userId) {
          await downgradeToFree(userId);
          await updateCurrentPlan(userId, 'free');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await handleSubscriptionUpsert(sub, null, 'past_due');
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const userId = session.metadata?.supabase_user_id;
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['default_payment_method'] }
          );

          if (userId && !subscription.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(session.subscription as string, {
              metadata: { supabase_user_id: userId },
            });
          }

          await handleSubscriptionUpsert(subscription, userId);

          if (userId) {
            const plan = getPlanFromPriceId(subscription.items.data[0]?.price.id);
            const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod | null;
            const cardFingerprint = paymentMethod?.card?.fingerprint ?? undefined;

            // 不正チェック
            if (cardFingerprint) {
              const isFraud = await checkCardFingerprintFraud(cardFingerprint, userId);
              if (isFraud) {
                console.warn(`Card fingerprint fraud detected for user: ${userId}`);
                await supabaseAdmin
                  .from('referrals')
                  .update({ status: 'fraud_suspected' })
                  .eq('referred_id', userId)
                  .eq('status', 'pending');
                break;
              }

              await supabaseAdmin
                .from('referrals')
                .update({ referred_card_fingerprint: cardFingerprint })
                .eq('referred_id', userId);
            }

            // referrals active 化 + current_plan 更新
            await activateReferralAndUpdatePlan(userId, plan);

            // 報酬記録
            await tryRecordReward(userId, plan, subscription);
          }
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

async function tryRecordReward(
  referredUserId: string,
  referredPlan: Plan,
  subscription: Stripe.Subscription
): Promise<void> {
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('referrer_id')
    .eq('referred_id', referredUserId)
    .eq('status', 'active')
    .single();

  if (!referral) return;

  const { data: referrerSub } = await supabaseAdmin
    .from('subscriptions')
    .select('current_plan')
    .eq('user_id', referral.referrer_id)
    .single();

  if (!referrerSub) return;

  const referrerPlan = (referrerSub.current_plan ?? 'free') as Plan;
  const periodStart = (subscription as any).current_period_start;
  const subscribedAt = periodStart ? new Date(periodStart * 1000) : new Date();

  await recordReward({
    referrerId: referral.referrer_id,
    referredUserId,
    referrerPlan,
    referredPlan,
    yearMonth: getCurrentYearMonth(),
    stripeSubscriptionId: subscription.id,
    subscribedAt,
  });
}

function getPlanFromPriceId(priceId?: string): Plan {
  if (priceId === process.env.STRIPE_MAX_PRICE_ID) return 'max';
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  return 'free';
}

async function handleSubscriptionUpsert(
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
  const plan = getPlanFromPriceId(priceId);

  const item = subscription.items.data[0];
  const periodStart = (item as any)?.current_period_start ?? (subscription as any).current_period_start;
  const periodEnd   = (item as any)?.current_period_end   ?? (subscription as any).current_period_end;

  await upsertSubscription({
    userId: resolvedUserId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    status: overrideStatus || subscription.status,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : new Date(),
    currentPeriodEnd:   periodEnd   ? new Date(periodEnd   * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });
}
