import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const REWARD_AMOUNTS = {
  premium: 100,
  max: 150,
};

export async function POST(request: NextRequest) {
  try {
    // 管理者キーで認証
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.replace('Bearer ', '');
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const yearMonth = new Date().toISOString().slice(0, 7);

    // アクティブな紹介関係を取得
    const { data: referrals } = await admin
      .from('referrals')
      .select('referrer_id, referred_id')
      .eq('status', 'active');

    if (!referrals || referrals.length === 0) {
      return NextResponse.json({ message: 'アクティブな紹介なし', count: 0 });
    }

    let count = 0;
    for (const referral of referrals) {
      // 紹介された人のプランを確認
      const { data: subscription } = await admin
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', referral.referred_id)
        .single();

      if (!subscription) continue;
      if (subscription.status !== 'active') continue;
      if (subscription.plan === 'free') continue;

      const amount = REWARD_AMOUNTS[subscription.plan as 'premium' | 'max'] ?? 0;
      if (amount === 0) continue;

      // 報酬を記録（重複はスキップ）
      const { error } = await admin.from('referral_rewards').upsert(
        {
          referrer_id: referral.referrer_id,
          referred_id: referral.referred_id,
          year_month: yearMonth,
          plan: subscription.plan,
          amount,
          status: 'pending',
        },
        { onConflict: 'referrer_id,referred_id,year_month' }
      );

      if (!error) count++;
    }

    return NextResponse.json({ message: '報酬計算完了', count, yearMonth });
  } catch (error) {
    console.error('Calculate error:', error);
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}
