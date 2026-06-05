import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MONTHLY_LIMIT = 50;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { imageBase64, mediaType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    if (token) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Stripeの請求期間開始日を取得
        const { data: subData } = await supabaseAdmin
  .from('subscriptions')
  .select('current_period_start, current_period_end')
  .eq('user_id', user.id)
  .single();

        const periodStart = subData?.current_period_start
  ? new Date(subData.current_period_start).toISOString()
  : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const { count } = await supabaseAdmin
          .from('api_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('api_type', 'analyze')
          .gte('used_at', periodStart);

        if ((count ?? 0) >= MONTHLY_LIMIT) {
          return NextResponse.json({
            error: `今月の写真解析は${MONTHLY_LIMIT}回までです。来月またお使いいただけます🐻`
          }, { status: 429 });
        }

        // 使用回数を記録（エラーチェック追加）
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { error: insertError } = await supabaseAdmin.from('api_usage').insert({
          user_id: user.id,
          api_type: 'analyze',
          used_at: now.toISOString(),
          year_month: yearMonth,
        });

        if (insertError) {
          console.error('api_usage insert error:', insertError);
          return NextResponse.json(
            { error: 'カウントの記録に失敗しました。もう一度お試しください。' },
            { status: 500 }
          );
        }
      }
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `この食事の写真を見て、栄養素を推定してください。必ず以下のJSON形式のみで返答してください（説明文は不要）：
{"foodName":"料理名","calories":数値,"protein":数値,"fat":数値,"carbs":数値,"fiber":数値,"comment":"一言コメント"}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return NextResponse.json(data);

  } catch (error: any) {
    if (error?.status === 429) throw error;
    console.error('Analyze error:', error);
    return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 });
  }
}
