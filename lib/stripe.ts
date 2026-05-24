// lib/stripe.ts
// Stripe初期化・プラン定義・ヘルパー関数

import Stripe from 'stripe';

// Stripe インスタンス（サーバーサイドのみ）
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
});

// =============================================
// プラン定義
// =============================================
export const PLANS = {
  free: {
    id: 'free',
    name: 'フリープラン',
    price: 0,
    features: [
      '食事記録 3件/日',
      '手入力のみ',
      '体重記録',
      '基本グラフ',
      '広告あり',
    ],
    limits: {
      mealsPerDay: 3,
      aiPhotoAnalysis: false,
      aiWeeklyReport: false,
      ads: true,
    },
  },
  premium: {
    id: 'premium',
    name: 'プレミアムプラン',
    price: 480,
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
    features: [
      '食事記録 無制限',
      'AI写真解析',
      'AI週間レポート',
      '詳細栄養グラフ',
      '広告なし',
      '優先サポート',
    ],
    limits: {
      mealsPerDay: Infinity,
      aiPhotoAnalysis: true,
      aiWeeklyReport: true,
      ads: false,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

// =============================================
// Stripe Customer 作成または取得
// =============================================
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  return customer.id;
}

// =============================================
// Checkout Session 作成
// =============================================
export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'ja',
    metadata: { supabase_user_id: userId },
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
  });
}

// =============================================
// Customer Portal Session 作成（解約・更新）
// =============================================
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// =============================================
// Webhook Signature 検証
// =============================================
export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
