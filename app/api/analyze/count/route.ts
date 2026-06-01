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

    // サーバー側で直接current_period_startを取得
    const { data: subData } = await supabaseAdmin
      .from('subscriptions')
      .select('current_period_start')
      .eq('user_id', user.id)
      .single();

    if (!subData?.current_period_start) {
      return NextResponse.json({ count: 0 });
    }

    const periodStart = new Date(subData.current_period_start).toISOString();

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
