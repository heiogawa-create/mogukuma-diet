import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createPortalSession } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const subscription = await getUserSubscription(session.user.id);

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'Stripeアカウントが見つかりません' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'https://mogukuma-diet.vercel.app';

    const portalSession = await createPortalSession(
      subscription.stripe_customer_id,
      `${origin}/settings`
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'ポータル作成でエラーが発生しました' }, { status: 500 });
  }
}