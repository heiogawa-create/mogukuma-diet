import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 紹介コードを適用
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'コードが必要です' }, { status: 400 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // コードの存在確認
    const { data: referralCode } = await admin
      .from('referral_codes')
      .select('user_id')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (!referralCode) {
      return NextResponse.json({ error: '無効な紹介コードです' }, { status: 400 });
    }

    // 自分自身のコードは使えない
    if (referralCode.user_id === user.id) {
      return NextResponse.json({ error: '自分の紹介コードは使えません' }, { status: 400 });
    }

    // すでに紹介関係がある場合はスキップ
    const { data: existing } = await admin
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'すでに紹介コードが適用されています' }, { status: 400 });
    }

    // 紹介関係を保存
    await admin.from('referrals').insert({
      referrer_id: referralCode.user_id,
      referred_id: user.id,
      code: code.toUpperCase().trim(),
      status: 'pending',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}
