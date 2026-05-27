import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get('year_month'); // 例: "2025-05"

  let query = supabaseAdmin
    .from('referral_rewards')
    .select(`
      year_month,
      amount,
      referrer_plan,
      referred_plan,
      status,
      referrer:referrer_id ( email ),
      referred:referred_id ( email )
    `)
    .order('year_month', { ascending: false })
    .order('created_at', { ascending: false });

  if (yearMonth) {
    query = query.eq('year_month', yearMonth);
  }

  const { data, error } = await query;

  if (error) {
    console.error('CSV query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const header = [
    'year_month',
    'referrer_email',
    'referrer_plan',
    'referred_email',
    'referred_plan',
    'amount',
    'status',
  ].join(',');

  const rows = (data ?? []).map((row: any) =>
    [
      row.year_month ?? '',
      row.referrer?.email ?? '',
      row.referrer_plan ?? '',
      row.referred?.email ?? '',
      row.referred_plan ?? '',
      row.amount ?? 0,
      row.status ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [header, ...rows].join('\n');
  const filename = yearMonth
    ? `referral_rewards_${yearMonth}.csv`
    : `referral_rewards_all.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
