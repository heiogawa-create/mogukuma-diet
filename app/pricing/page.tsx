'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, Zap, Star } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPremium, loading, startCheckout, openPortal, error } = useSubscription();
  const canceled = searchParams.get('upgrade') === 'canceled';

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🐻</div>
        <h1 className="text-3xl font-bold text-amber-900">もぐクマプラン</h1>
        <p className="text-amber-700 mt-2">あなたのダイエット目標に合ったプランを選ぼう</p>
        {canceled && (
          <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded-lg py-2 px-4 inline-block text-yellow-800 text-sm">
            ⚠️ 決済がキャンセルされました。
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        <div className={`bg-white rounded-2xl border-2 p-6 shadow-sm ${!isPremium ? 'border-amber-400' : 'border-gray-200'}`}>
          {!isPremium && (
            <div className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">現在のプラン</div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-amber-500 w-5 h-5" />
            <h2 className="text-xl font-bold text-gray-800">フリープラン</h2>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">¥0<span className="text-base font-normal text-gray-500"> / 月</span></div>
          <p className="text-sm text-gray-500 mb-6">まずは無料で始める</p>
          <ul className="space-y-3 mb-6">
            {['食事記録 3件/日', '手入力のみ', '体重記録', '基本グラフ', '広告あり'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
          <button onClick={() => router.push('/')} className="w-full py-3 rounded-xl border-2 border-amber-300 text-amber-700 font-medium hover:bg-amber-50 transition">
            このまま続ける
          </button>
        </div>

        <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-2xl border-2 border-orange-400 p-6 shadow-lg relative overflow-hidden">
          <div className="relative">
            {isPremium && (
              <div className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">✨ ご利用中</div>
            )}
            <div className="bg-yellow-300 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4 ml-2">おすすめ</div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="text-yellow-200 w-5 h-5 fill-current" />
              <h2 className="text-xl font-bold text-white">プレミアムプラン</h2>
            </div>
            <div className="text-3xl font-bold text-white mb-1">¥480<span className="text-base font-normal text-orange-100"> / 月</span></div>
            <p className="text-sm text-orange-100 mb-6">AI フル活用でダイエット加速</p>
            <ul className="space-y-3 mb-6">
              {['食事記録 無制限', 'AI写真解析', 'AI週間レポート', '詳細栄養グラフ', '広告なし', '優先サポート'].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-white">
                  <Check className="w-4 h-4 text-yellow-300 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            {isPremium ? (
              <button onClick={openPortal} disabled={loading} className="w-full py-3 rounded-xl bg-white/20 text-white font-medium hover:bg-white/30 transition border border-white/30">
                {loading ? '処理中...' : 'プラン管理・解約'}
              </button>
            ) : (
              <button onClick={() => startCheckout('premium')} disabled={loading} className="w-full py-3 rounded-xl bg-white text-orange-600 font-bold hover:bg-orange-50 transition shadow-md">
                {loading ? '処理中...' : '✨ プレミアムにアップグレード'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-md mx-auto mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-700 text-sm">{error}</div>
      )}

      <div className="text-center mt-8">
        <button onClick={() => router.back()} className="text-amber-700 text-sm hover:underline">← 戻る</button>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-amber-700">読み込み中...</div>}>
      <PricingContent />
    </Suspense>
  );
}
