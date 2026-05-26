// components/subscription/SubscriptionSection.tsx
// 設定画面に埋め込むサブスク情報セクション

'use client';

import { useRouter } from 'next/navigation';
import { Crown, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

export default function SubscriptionSection() {
  const router = useRouter();
  const {
    isPremium,
    plan,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    loading,
    error,
    startCheckout,
    openPortal,
  } = useSubscription();

  const periodEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <Crown className={`w-4 h-4 ${isPremium ? 'text-amber-500' : 'text-gray-400'}`} />
        <span className="text-sm font-semibold text-gray-700">プラン・課金</span>
      </div>

      <div className="p-5 space-y-4">
        {/* 現在のプラン表示 */}
        <div className={`rounded-xl p-4 ${
          isPremium
            ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isPremium ? 'text-amber-800' : 'text-gray-700'}`}>
                  {isPremium ? '✨ プレミアムプラン' : '🐻 フリープラン'}
                </span>
                {loading && (
                  <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                )}
              </div>

              {isPremium && periodEndDate && (
                <p className="text-xs text-amber-600 mt-1">
                  {cancelAtPeriodEnd
                    ? `⚠️ ${periodEndDate} に終了予定`
                    : `次回更新: ${periodEndDate}`}
                </p>
              )}

              {!isPremium && (
                <p className="text-xs text-gray-500 mt-1">
                  食事記録 3件/日・手入力のみ
                </p>
              )}

              {status === 'past_due' && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <p className="text-xs text-red-500">支払いに問題があります</p>
                </div>
              )}
            </div>

            <div className={`text-lg font-bold ${isPremium ? 'text-amber-700' : 'text-gray-400'}`}>
              {isPremium ? '¥480/月' : '無料'}
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        {isPremium ? (
          <button
            onClick={openPortal}
            disabled={loading}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition"
          >
            <span className="text-sm text-gray-700">
              {loading ? '処理中...' : 'プラン管理・解約・請求履歴'}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ) : (
          <>
            <button
              onClick={() => startCheckout('premium')}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow hover:opacity-90 transition"
            >
              {loading ? '処理中...' : '✨ プレミアムにアップグレード（¥480/月）'}
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="w-full text-xs text-amber-600 hover:underline text-center py-1"
            >
              プランの詳細を見る
            </button>
          </>
        )}

        {/* エラー表示 */}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* フリープランの制限説明 */}
        {!isPremium && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-xs text-amber-700 font-semibold mb-1">フリープランの制限</p>
            <ul className="text-xs text-amber-600 space-y-0.5">
              <li>• 食事記録 3件/日まで</li>
              <li>• AI写真解析 不可</li>
              <li>• AI週間レポート 不可</li>
              <li>• 広告あり</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
