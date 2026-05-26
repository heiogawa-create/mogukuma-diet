import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPortalSession } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'Stripeアカウントが見つかりません' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'https://mogukuma-diet.vercel.app';
    const portalSession = await createPortalSession(
  subscription.stripe_customer_id,
  `${origin}/`
);

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'ポータル作成でエラーが発生しました' }, { status: 500 });
  }
}
