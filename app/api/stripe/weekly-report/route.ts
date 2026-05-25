import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { mealRecords, weightRecords, goals, userName, gender } = await request.json();

    const response = await client.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `あなたはプロの栄養士もぐクマです。以下のデータを分析して週間レポートを作成してください。

ユーザー名：${userName || 'ユーザー'}
性別：${gender === 'female' ? '女性' : '男性'}
目標値：カロリー${goals.calories}kcal、蛋白質${goals.protein}g、脂質${goals.fat}g、炭水化物${goals.carbs}g

食事記録：${JSON.stringify(mealRecords)}
体重記録：${JSON.stringify(weightRecords)}

必ず以下のJSON形式のみで返答してください（説明文不要）：
{
  "summary": "今週の総評（2〜3文）",
  "goodPoints": ["良かった点1", "良かった点2", "良かった点3"],
  "improvementPoints": ["改善点1", "改善点2"],
  "riskWarnings": ["注意点（あれば）"],
  "recommendedFoods": ["おすすめ食品1", "おすすめ食品2", "おすすめ食品3"],
  "convenienceStoreSuggestions": ["コンビニ提案1", "コンビニ提案2", "コンビニ提案3"],
  "encouragementMessage": "励ましメッセージ（1文）"
}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Weekly report error:', error);
    return NextResponse.json({ error: 'レポート生成に失敗しました' }, { status: 500 });
  }
}
