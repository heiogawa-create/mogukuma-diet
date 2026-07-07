import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}


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
      analyzeLimit: 0,
    },
  },
  premium: {
    id: 'premium',
    name: 'プレミアムプラン',
    price: 480,
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
    features: [
      '食事記録 無制限',
      'AI写真解析 月50回',
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
      analyzeLimit: 50,
    },
  },
  max: {
    id: 'max',
    name: 'MAXプラン',
    price: 860,
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID!,
    features: [
      '食事記録 無制限',
      'AI写真解析 月100回',
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
      analyzeLimit: 100,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId;
  }
  const customer = await getStripe().customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });
  return customer.id;
}

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
  return getStripe().checkout.sessions.create({
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

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
