import { createClient } from '@supabase/supabase-js';
import type { Plan, RewardInput } from '@/types/referral';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// 報酬計算
// ============================================================

export function getReferralReward(referrerPlan: Plan, referredPlan: Plan): number {
  if (referrerPlan === 'max' && referredPlan === 'max') return 150;
  return 100;
}

/** "YYYY-MM" 形式で現在月を返す */
export function getCurrentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ============================================================
// 報酬確定条件チェック（7日継続）
// ============================================================

export async function checkRewardEligibility(
  subscribedAt: Date
): Promise<{ eligible: boolean; reason?: string }> {
  const diffDays = (Date.now() - subscribedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) {
    return { eligible: false, reason: '7日未満のため対象外' };
  }
  return { eligible: true };
}

// ============================================================
// 不正防止チェック
// ============================================================

/** 同一カードfingerprintが別ユーザーに存在するか */
export async function checkCardFingerprintFraud(
  fingerprint: string,
  excludeUserId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referred_card_fingerprint', fingerprint)
    .neq('referred_id', excludeUserId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** 同一IPから24時間以内に3件以上の紹介登録があるか */
export async function checkIpFraud(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referred_ip', ip)
    .gte('created_at', since);
  return (count ?? 0) >= 3;
}

/** 自己紹介チェック */
export function checkSelfReferral(referrerId: string, referredId: string): boolean {
  return referrerId === referredId;
}

// ============================================================
// 報酬記録
// ============================================================

export async function recordReward(input: RewardInput): Promise<{
  success: boolean;
  duplicate?: boolean;
  error?: string;
}> {
  const { eligible, reason } = await checkRewardEligibility(input.subscribedAt);
  if (!eligible) {
    console.log(`Reward skipped for ${input.referredUserId}: ${reason}`);
    return { success: false, error: reason };
  }

  const amount = getReferralReward(input.referrerPlan, input.referredPlan);

  const { error } = await supabaseAdmin
    .from('referral_rewards')
    .insert({
      referrer_id: input.referrerId,
      referred_id: input.referredUserId,   // ← referred_id
      year_month: input.yearMonth,          // ← year_month
      amount,                               // ← amount
      plan: input.referredPlan,             // 既存カラム（紹介された人のプラン）
      referrer_plan: input.referrerPlan,
      referred_plan: input.referredPlan,
      status: 'pending',
    });

  if (error) {
    // UNIQUE制約違反 = 同月内に既に記録済み
    if (error.code === '23505') {
      console.log(`Duplicate reward skipped: ${input.yearMonth} ${input.referrerId} -> ${input.referredUserId}`);
      return { success: false, duplicate: true };
    }
    console.error('recordReward error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================
// referral active 化 + subscriptions.current_plan 更新
// ============================================================

export async function activateReferralAndUpdatePlan(
  userId: string,
  plan: Plan
): Promise<void> {
  const { error: referralError } = await supabaseAdmin
    .from('referrals')
    .update({ status: 'active', activated_at: new Date().toISOString() })
    .eq('referred_id', userId)
    .eq('status', 'pending');

  if (referralError) {
    console.error('activateReferral error:', referralError);
  }

  await updateCurrentPlan(userId, plan);
}

export async function updateCurrentPlan(userId: string, plan: Plan): Promise<void> {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ current_plan: plan })
    .eq('user_id', userId);

  if (error) {
    console.error('updateCurrentPlan error:', error);
  }
}
