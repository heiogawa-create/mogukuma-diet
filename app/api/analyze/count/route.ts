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
    const yearMonth = searchParams.get('yearMonth') ?? new Date().toISOString().slice(0, 7);
    const { count } = await supabaseAdmin
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('api_type', 'analyze')
      .eq('year_month', yearMonth);
    console.log('yearMonth:', yearMonth);
    console.log('user_id:', user.id);
    console.log('count:', count);
    return NextResponse.json({ count: count ?? 0 });
  } catch (error) {
    console.error('analyze count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
