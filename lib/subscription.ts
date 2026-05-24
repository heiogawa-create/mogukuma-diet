import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createClient(url, key);
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: 'free' | 'premium';
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export async function getUserSubscription(userId: string): Promise<SubscriptionRecord | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as SubscriptionRecord;
}

export function isPremium(subscription: SubscriptionRecord | null): boolean {
  if (!subscription) return false;
  return subscription.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing');
}

export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: 'free' | 'premium';
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: data.userId,
      stripe_customer_id: data.stripeCustomerId,
      stripe_subscription_id: data.stripeSubscriptionId,
      stripe_price_id: data.stripePriceId,
      plan: data.plan,
      status: data.status,
      current_period_start: data.currentPeriodStart.toISOString(),
      current_period_end: data.currentPeriodEnd.toISOString(),
      cancel_at_period_end: data.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(`subscription upsert failed: ${error.message}`);
}

export async function downgradeToFree(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(`downgrade failed: ${error.message}`);
}
