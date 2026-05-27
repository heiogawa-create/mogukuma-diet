'use client';

import { useState, useEffect } from 'react';

type RewardData = {
  referrer_id: string;
  email: string;
  total_amount: number;
  active_referrals: number;
  status: string;
  rewards: any[];
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<RewardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/referral/admin?yearMonth=${yearMonth}`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json.data);
        setIsAuth(true);
      } else {
        alert('認証失敗：キーを確認してください');
      }
    } catch {
      alert('エラーが発生しました');
    }
    setLoading(false);
  };

  const calculateRewards = async () => {
    if (!confirm(`${yearMonth}の報酬を計算しますか？`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/referral/calculate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const json = await res.json();
      setMessage(`✅ 計算完了：${json.count}件`);
      await fetchData();
    } catch {
      setMessage('❌ エラーが発生しました');
    }
    setLoading(false);
  };

  const markAsPaid = async (referrer_id: string) => {
    if (!confirm('支払い済みにしますか？')) return;
    try {
      const res = await fetch('/api/referral/admin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ referrer_id, year_month: yearMonth }),
      });
      if (res.ok) {
        setMessage('✅ 支払い済みに更新しました');
        await fetchData();
      }
    } catch {
      setMessage('❌ エラーが発生しました');
    }
  };

  const downloadCSV = () => {
    const header = 'email,active_referrals,total_amount,status';
    const rows = data.map(d =>
      `${d.email},${d.active_referrals},${d.total_amount},${d.status}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral_rewards_${yearMonth}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">🐻 もぐクマ 管理画面</h1>

        {!isAuth ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md">
            <h2 className="text-lg font-bold mb-4">管理者ログイン</h2>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="管理者キーを入力"
              className="w-full border rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full bg-amber-500 text-white rounded-xl py-3 font-bold hover:bg-amber-600 transition"
            >
              {loading ? '確認中...' : 'ログイン'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* コントロールパネル */}
            <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-wrap gap-3 items-center">
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="border rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-gray-100 text-gray-700 rounded-xl px-4 py-2 font-bold hover:bg-gray-200 transition"
              >
                🔄 更新
              </button>
              <button
                onClick={calculateRewards}
                disabled={loading}
                className="bg-amber-500 text-white rounded-xl px-4 py-2 font-bold hover:bg-amber-600 transition"
              >
                📊 報酬計算
              </button>
              <button
                onClick={downloadCSV}
                disabled={data.length === 0}
                className="bg-green-500 text-white rounded-xl px-4 py-2 font-bold hover:bg-green-600 transition"
              >
                📥 CSV出力
              </button>
            </div>

            {message && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 font-bold">
                {message}
              </div>
            )}

            {/* サマリー */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">対象者数</p>
                <p className="text-3xl font-black text-amber-600">{data.length}人</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">総報酬額</p>
                <p className="text-3xl font-black text-amber-600">¥{data.reduce((s, d) => s + d.total_amount, 0)}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">未払い</p>
                <p className="text-3xl font-black text-red-500">
                  ¥{data.filter(d => d.status === 'pending').reduce((s, d) => s + d.total_amount, 0)}
                </p>
              </div>
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-gray-600">メールアドレス</th>
                    <th className="text-center px-4 py-3 font-bold text-gray-600">有効紹介数</th>
                    <th className="text-center px-4 py-3 font-bold text-gray-600">今月報酬</th>
                    <th className="text-center px-4 py-3 font-bold text-gray-600">状態</th>
                    <th className="text-center px-4 py-3 font-bold text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td>
                    </tr>
                  )}
                  {data.map((d) => (
                    <tr key={d.referrer_id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{d.email}</td>
                      <td className="px-4 py-3 text-center">{d.active_referrals}人</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">¥{d.total_amount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          d.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {d.status === 'paid' ? '支払済' : '未払い'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.status === 'pending' && (
                          <button
                            onClick={() => markAsPaid(d.referrer_id)}
                            className="bg-green-500 text-white rounded-lg px-3 py-1 text-xs font-bold hover:bg-green-600 transition"
                          >
                            支払済にする
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
