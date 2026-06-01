import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ count: 0 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ count: 0 });
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const currentPeriodEnd = searchParams.get('currentPeriodEnd');
    
    // 請求期間の開始日を計算
    let periodStart: string;
    if (currentPeriodEnd) {
      const endDate = new Date(currentPeriodEnd);
      endDate.setMonth(endDate.getMonth() - 1);
      periodStart = endDate.toISOString();
    } else {
      // フォールバック：今月の1日
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    }

    const { count } = await supabaseAdmin
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('api_type', 'analyze')
      .gte('used_at', periodStart);

    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    console.error('analyze count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
