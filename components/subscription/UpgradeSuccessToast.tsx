// components/subscription/UpgradeSuccessToast.tsx
// Stripe決済成功後に設定画面で表示するトースト
// settings/page.tsx の先頭に <UpgradeSuccessToast /> を追加する

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export default function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setShow(true);
      // URLからパラメータを除去
      const url = new URL(window.location.href);
      url.searchParams.delete('upgrade');
      router.replace(url.pathname, { scroll: false });

      // 5秒後に自動で消える
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 animate-fade-in">
      <div className="bg-green-600 text-white rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3 max-w-sm w-full">
        <CheckCircle className="w-6 h-6 text-green-200 flex-shrink-0" />
        <div>
          <p className="font-bold text-sm">プレミアムプランへようこそ！🎉</p>
          <p className="text-xs text-green-200 mt-0.5">全機能が利用可能になりました</p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="ml-auto text-green-200 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
