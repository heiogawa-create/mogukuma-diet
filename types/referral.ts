export type Plan = 'free' | 'premium' | 'max';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  code: string;
  status: 'pending' | 'active' | 'cancelled' | 'fraud_suspected';
  activated_at: string | null;
  referred_ip: string | null;
  referred_card_fingerprint: string | null;
  created_at: string;
}

export interface ReferralReward {
  id: string;
  referrer_id: string;
  referred_id: string;    // ← referred_id
  year_month: string;     // ← year_month "YYYY-MM"
  plan: string;
  amount: number;         // ← amount
  referrer_plan: Plan;
  referred_plan: Plan;
  status: 'pending' | 'confirmed' | 'paid';
  paid_at: string | null;
  created_at: string;
}

export interface ReferralCsvRow {
  year_month: string;
  referrer_email: string;
  referrer_plan: string;
  referred_email: string;
  referred_plan: string;
  amount: number;
  status: string;
}

export interface RewardInput {
  referrerId: string;
  referredUserId: string;
  referrerPlan: Plan;
  referredPlan: Plan;
  yearMonth: string;       // ← yearMonth "YYYY-MM"
  stripeSubscriptionId: string;
  cardFingerprint?: string;
  subscribedAt: Date;
}
