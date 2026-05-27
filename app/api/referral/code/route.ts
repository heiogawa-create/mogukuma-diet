import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function generateCode(userId: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = userId.slice(0, 4).toUpperCase().replace(/-/g, 'X');
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}

// 自分の紹介コードを取得（なければ作成）
export async function GET(request: NextRequest) {
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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 既存コードを確認
    const { data: existing } = await admin
      .from('referral_codes')
      .select('code')
      .eq('user_id', user.id)
      .single();

    if (existing) return NextResponse.json({ code: existing.code });

    // 新規作成
    let code = generateCode(user.id);
    let attempts = 0;
    while (attempts < 10) {
      const { error } = await admin
        .from('referral_codes')
        .insert({ user_id: user.id, code });
      if (!error) break;
      code = generateCode(user.id);
      attempts++;
    }

    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json({ error: 'エラーが発生しました' }, { status: 500 });
  }
}
