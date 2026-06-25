import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mediaType } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 });
  }
}
