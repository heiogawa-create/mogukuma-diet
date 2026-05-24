// components/subscription/MealLimitGuard.tsx
// フリープランの食事記録 3件/日 制限をチェックするコンポーネント

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/hooks/useSubscription';

interface MealLimitGuardProps {
  /** 今日の記録済み件数（親から渡す） */
  todayCount: number;
  /** 制限に引っかかっていない場合に表示する子要素 */
  children: React.ReactNode;
}

const FREE_LIMIT = 3;

export default function MealLimitGuard({ todayCount, children }: MealLimitGuardProps) {
  const router = useRouter();
  const { isPremium, loading } = useSubscription();

  if (loading) return <>{children}</>;

  // プレミアムは無制限
  if (isPremium) return <>{children}</>;

  // フリープランで上限超過
  if (todayCount >= FREE_LIMIT) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">🐻</div>
        <h3 className="text-lg font-bold text-amber-900 mb-1">
          今日の記録上限に達したクマ！
        </h3>
        <p className="text-sm text-amber-700 mb-1">
          フリープランは <span className="font-bold">1日 {FREE_LIMIT}件</span> まで記録できます
        </p>
        <p className="text-xs text-amber-600 mb-5">
          今日はあと{' '}
          <span className="font-bold text-orange-600">
            {Math.max(0, FREE_LIMIT - todayCount)}件
          </span>{' '}
          記録できます（現在 {todayCount}/{FREE_LIMIT} 件）
        </p>
        <button
          onClick={() => router.push('/pricing')}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow hover:opacity-90 transition mb-2"
        >
          ✨ プレミアムで無制限に記録する
        </button>
        <button
          onClick={() => router.back()}
          className="text-xs text-amber-600 hover:underline"
        >
          戻る
        </button>
      </div>
    );
  }

  // 上限に近い場合の警告バナー（残り1件）
  const remaining = FREE_LIMIT - todayCount;
  const showWarning = remaining === 1;

  return (
    <>
      {showWarning && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2 mb-3 flex items-center justify-between">
          <span className="text-xs text-yellow-800">
            ⚠️ 今日の記録はあと <strong>1件</strong> です（フリープラン）
          </span>
          <button
            onClick={() => router.push('/pricing')}
            className="text-xs text-orange-600 font-bold hover:underline ml-2"
          >
            アップグレード
          </button>
        </div>
      )}
      {children}
    </>
  );
}

// =============================================
// 食事記録追加ボタン用の小さなバリアント
// =============================================
export function MealAddButton({
  todayCount,
  onClick,
}: {
  todayCount: number;
  onClick: () => void;
}) {
  const router = useRouter();
  const { isPremium, loading } = useSubscription();

  if (loading) return null;

  const isBlocked = !isPremium && todayCount >= FREE_LIMIT;

  return (
    <button
      onClick={isBlocked ? () => router.push('/pricing') : onClick}
      className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold transition shadow ${
        isBlocked
          ? 'bg-gray-100 text-gray-400 border border-gray-200'
          : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white hover:opacity-90'
      }`}
    >
      {isBlocked ? (
        <>🔒 上限 {FREE_LIMIT}件 / 日（プレミアムで無制限）</>
      ) : (
        <>+ 食事を記録する {!isPremium && `(${todayCount}/${FREE_LIMIT})`}</>
      )}
    </button>
  );
}
