// lib/subscription.ts
// ユーザーのサブスクリプション状態を取得・チェックするユーティリティ

import { createClient } from '@supabase/supabase-js';
import { PLANS, PlanId } from './stripe';

// Service Role クライアント（サーバーサイドのみ）
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanId;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

// =============================================
// ユーザーのサブスク情報を取得
// =============================================
export async function getUserSubscription(
  userId: string
): Promise<SubscriptionRecord | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('subscription fetch error:', error);
    return null;
  }

  return data as SubscriptionRecord;
}

// =============================================
// プレミアムかどうか判定
// =============================================
export function isPremium(subscription: SubscriptionRecord | null): boolean {
  if (!subscription) return false;
  return (
    subscription.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  );
}

// =============================================
// プランの制限値を取得
// =============================================
export function getPlanLimits(planId: PlanId) {
  return PLANS[planId].limits;
}

// =============================================
// 今日の食事記録件数を取得
// =============================================
export async function getTodayMealCount(userId: string): Promise<number> {
  const supabase = getServiceClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { count, error } = await supabase
    .from('meal_logs') // ← テーブル名が異なる場合は修正
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString());

  if (error) {
    console.error('meal count error:', error);
    return 0;
  }

  return count ?? 0;
}

// =============================================
// サブスク情報を更新（Webhookから呼ぶ）
// =============================================
export async function upsertSubscription(data: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: PlanId;
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

// =============================================
// サブスクをフリープランに戻す
// =============================================
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
