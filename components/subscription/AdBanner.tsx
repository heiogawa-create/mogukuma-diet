// components/subscription/AdBanner.tsx
// フリープランのみ広告バナーを表示するコンポーネント
// Google AdSense などに差し替え可

'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

interface AdBannerProps {
  /** バナーの位置 */
  position?: 'top' | 'bottom' | 'inline';
  /** 閉じるボタンを表示するか */
  dismissible?: boolean;
}

export default function AdBanner({
  position = 'bottom',
  dismissible = true,
}: AdBannerProps) {
  const router = useRouter();
  const { isPremium, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  // プレミアムまたは読み込み中・閉じた場合は非表示
  if (loading || isPremium || dismissed) return null;

  const positionClass =
    position === 'bottom'
      ? 'fixed bottom-16 left-0 right-0 z-40 px-3 pb-2'
      : position === 'top'
      ? 'fixed top-0 left-0 right-0 z-40 px-3 pt-2'
      : 'relative mb-3';

  return (
    <div className={positionClass}>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between shadow-sm max-w-lg mx-auto">
        {/* 広告スペース */}
        <div className="flex-1">
          {/* ↓ Google AdSense 実装時はここを差し替え */}
          <div
            onClick={() => router.push('/pricing')}
            className="cursor-pointer flex items-center gap-3"
          >
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-xs font-bold text-amber-900">広告を非表示にする</p>
              <p className="text-xs text-amber-700">プレミアムプランで快適に ¥480/月</p>
            </div>
          </div>
          {/* Google AdSense 実装例（コメントアウト）:
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
            data-ad-slot="XXXXXXXXXX"
            data-ad-format="auto"
            data-full-width-responsive="true"
          /> */}
        </div>

        {/* 閉じるボタン */}
        {dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="ml-2 p-1 text-amber-400 hover:text-amber-600"
            aria-label="広告を閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
