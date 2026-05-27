import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.replace('Bearer ', '');
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth') || new Date().toISOString().slice(0, 7);

    // 報酬データを取得
    const { data: rewards } = await admin
      .from('referral_rewards')
      .select('*')
      .eq('year_month', yearMonth)
      .order('created_at', { ascending: false });

    if (!rewards) return NextResponse.json({ data: [] });

    // referrer_idでグループ化
    const grouped: Record<string, {
      referrer_id: string;
      total_amount: number;
      active_referrals: number;
      status: string;
      rewards: typeof rewards;
    }> = {};

    for (const reward of rewards) {
      if (!grouped[reward.referrer_id]) {
        grouped[reward.referrer_id] = {
          referrer_id: reward.referrer_id,
          total_amount: 0,
          active_referrals: 0,
          status: reward.status,
          rewards: [],
        };
      }
      grouped[reward.referrer_id].total_amount += reward.amount;
      grouped[reward.referrer_id].active_referrals += 1;
      grouped[reward.referrer_id].rewards.push(reward);
    }

    // メールアドレスを取得
    const result = await Promise.all(
      Object.values(grouped).map(async (g) => {
        const { data: userData } = await admin.auth.admin.getUserById(g.referrer_id);
        return {
          ...g,
          email: userData?.user?.email ?? '不明',
        };
      })
    );

    return NextResponse.json({ data: result, yearMonth });
  } catch (error) {
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}

// 支払い済みに更新
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.replace('Bearer ', '');
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const { referrer_id, year_month } = await request.json();

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await admin
      .from('referral_rewards')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('referrer_id', referrer_id)
      .eq('year_month', year_month);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}
