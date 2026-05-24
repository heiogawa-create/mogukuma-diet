// components/subscription/PremiumGate.tsx
// プレミアム機能をガードするラッパーコンポーネント

'use client';

import { useRouter } from 'next/navigation';
import { Lock, Star } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface PremiumGateProps {
  children: React.ReactNode;
  /** ゲートを表示するかどうかを override（省略時は useSubscription で自動判定） */
  isPremiumOverride?: boolean;
  /** ゲート表示時のタイトル */
  featureName?: string;
  /** ゲート表示方法: 'blur' = 子要素をぼかす / 'hide' = 完全に隠す / 'overlay' = オーバーレイ */
  variant?: 'blur' | 'hide' | 'overlay';
}

export default function PremiumGate({
  children,
  isPremiumOverride,
  featureName = 'この機能',
  variant = 'blur',
}: PremiumGateProps) {
  const router = useRouter();
  const { isPremium, loading } = useSubscription();

  const userIsPremium = isPremiumOverride ?? isPremium;

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-xl h-24 flex items-center justify-center">
        <span className="text-gray-400 text-sm">読み込み中...</span>
      </div>
    );
  }

  if (userIsPremium) return <>{children}</>;

  if (variant === 'hide') {
    return (
      <button
        onClick={() => router.push('/pricing')}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-xl font-medium shadow hover:shadow-md transition"
      >
        <Lock className="w-4 h-4" />
        {featureName}はプレミアムプラン限定
      </button>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-xl">
          <PremiumBadge featureName={featureName} onClick={() => router.push('/pricing')} />
        </div>
      </div>
    );
  }

  // default: blur
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <PremiumBadge featureName={featureName} onClick={() => router.push('/pricing')} />
      </div>
    </div>
  );
}

function PremiumBadge({
  featureName,
  onClick,
}: {
  featureName: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 mx-4 text-center border border-amber-100">
      <div className="text-3xl mb-2">🔒</div>
      <p className="text-sm font-semibold text-gray-800 mb-1">
        {featureName}はプレミアム限定
      </p>
      <p className="text-xs text-gray-500 mb-3">月額 ¥480 で全機能が使えます</p>
      <button
        onClick={onClick}
        className="flex items-center justify-center gap-1 w-full py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold shadow hover:opacity-90 transition"
      >
        <Star className="w-3 h-3 fill-current" />
        プレミアムにアップグレード
      </button>
    </div>
  );
}
