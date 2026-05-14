"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MoguKuma } from "@/components/MoguKuma";

type Screen = "home" | "meal" | "weight";

const mealAnalysis = {
  menu: "鮭おにぎり・豆腐サラダ・お味噌汁",
  calories: 520,
  score: 88,
  pfc: [
    { name: "P", label: "たんぱく質", value: 28, color: "#F38BB5" },
    { name: "F", label: "脂質", value: 16, color: "#FFD36E" },
    { name: "C", label: "炭水化物", value: 68, color: "#8EDDC0" },
  ],
};

const weightData = [
  { day: "5/8", weight: 58.4 },
  { day: "5/9", weight: 58.2 },
  { day: "5/10", weight: 58.0 },
  { day: "5/11", weight: 57.8 },
  { day: "5/12", weight: 57.9 },
  { day: "5/13", weight: 57.6 },
  { day: "今日", weight: 57.4 },
];

const dailyMeals = [
  { label: "朝", kcal: 360, icon: "🍓" },
  { label: "昼", kcal: 520, icon: "🍙" },
  { label: "夜", kcal: 610, icon: "🥗" },
];

const tabs: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "🏠" },
  { id: "meal", label: "食事", icon: "📷" },
  { id: "weight", label: "体重", icon: "📈" },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [photoName, setPhotoName] = useState("今日のランチ写真.jpg");
  const totalCalories = useMemo(() => dailyMeals.reduce((sum, meal) => sum + meal.kcal, 0), []);

  return (
    <main className="min-h-screen bg-app px-4 py-5 text-cocoa">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[42px] border border-white/70 bg-white/45 shadow-soft backdrop-blur">
        <header className="px-5 pb-3 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-berry/80">AI Diet Coach</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">もぐクマDiet</h1>
            </div>
            <button className="rounded-full bg-white/90 px-4 py-3 text-xl shadow-float" aria-label="通知">
              🔔
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-5 pb-28">
          {screen === "home" && (
            <div className="space-y-5">
              <MoguKuma message="今日もえらいね。ランチはたんぱく質を足せていて、とってもいい感じだよ！" />

              <div className="rounded-[34px] bg-gradient-to-br from-sakura via-white to-mint/70 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-cocoa/70">今日の摂取カロリー</p>
                    <p className="mt-1 text-4xl font-black">{totalCalories}<span className="text-lg"> kcal</span></p>
                  </div>
                  <div className="rounded-3xl bg-white/80 px-4 py-3 text-center shadow-float">
                    <p className="text-xs font-bold text-cocoa/60">目標まで</p>
                    <p className="text-xl font-black text-berry">あと310</p>
                  </div>
                </div>
                <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full w-[83%] rounded-full bg-gradient-to-r from-berry to-honey" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {dailyMeals.map((meal) => (
                  <button
                    key={meal.label}
                    onClick={() => setScreen("meal")}
                    className="rounded-[28px] bg-white/85 p-4 text-left shadow-float transition active:scale-95"
                  >
                    <span className="text-3xl">{meal.icon}</span>
                    <p className="mt-3 text-sm font-black">{meal.label}</p>
                    <p className="text-xs font-bold text-cocoa/60">{meal.kcal} kcal</p>
                  </button>
                ))}
              </div>

              <SoftCard title="PFCバランス" subtitle="ダミーAI解析">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mealAnalysis.pfc} barSize={34}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3D9C8" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontWeight: 800 }} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: "rgba(255, 220, 232, 0.35)" }} />
                      <Bar dataKey="value" radius={[16, 16, 16, 16]}>
                        {mealAnalysis.pfc.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SoftCard>
            </div>
          )}

          {screen === "meal" && (
            <div className="space-y-5">
              <MoguKuma compact message="写真を選ぶだけでOK。今はOpenAI APIなしで動くダミー解析だよ。" />

              <label className="block rounded-[36px] border-2 border-dashed border-berry/30 bg-white/80 p-6 text-center shadow-soft">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "写真を選択してね")}
                />
                <div className="mx-auto flex h-40 items-center justify-center rounded-[30px] bg-gradient-to-br from-sakura to-cream text-6xl shadow-inner">
                  🍱
                </div>
                <p className="mt-4 text-lg font-black">食事写真をアップロード</p>
                <p className="mt-1 text-sm font-bold text-cocoa/60">{photoName}</p>
              </label>

              <SoftCard title="AI食事解析結果" subtitle={`スコア ${mealAnalysis.score}点`}>
                <div className="rounded-[28px] bg-cream/80 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-berry">Detected meal</p>
                  <h2 className="mt-2 text-2xl font-black">{mealAnalysis.menu}</h2>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-cocoa/70">
                    野菜とたんぱく質が入った、午後も元気に過ごせる組み合わせ。炭水化物は夜に少し控えめにするとさらに◎。
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="カロリー" value={`${mealAnalysis.calories} kcal`} tone="bg-sakura" />
                  <Metric label="AIおすすめ" value="水分+1杯" tone="bg-mint" />
                </div>
                <div className="mt-4 space-y-3">
                  {mealAnalysis.pfc.map((item) => (
                    <div key={item.name}>
                      <div className="mb-1 flex justify-between text-sm font-black">
                        <span>{item.label}</span>
                        <span>{item.value}g</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-cocoa/10">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(item.value, 80)}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </SoftCard>
            </div>
          )}

          {screen === "weight" && (
            <div className="space-y-5">
              <MoguKuma compact message="ゆるやかに右肩下がり！数字だけじゃなく、続けている自分もほめてね。" />

              <div className="grid grid-cols-2 gap-3">
                <Metric label="今日の体重" value="57.4 kg" tone="bg-sakura" />
                <Metric label="7日変化" value="-1.0 kg" tone="bg-mint" />
              </div>

              <SoftCard title="体重グラフ" subtitle="1週間の記録">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightData} margin={{ left: -18, right: 8, top: 16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F38BB5" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#F38BB5" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3D9C8" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontSize: 12, fontWeight: 800 }} />
                      <YAxis domain={[57, 59]} axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontSize: 12, fontWeight: 800 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="weight" stroke="#F38BB5" strokeWidth={4} fill="url(#weightGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SoftCard>

              <SoftCard title="体重を記録" subtitle="MVP用フォーム">
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.1"
                    defaultValue="57.4"
                    className="min-w-0 flex-1 rounded-[24px] border-0 bg-cream px-5 py-4 text-2xl font-black text-cocoa outline-none ring-2 ring-transparent focus:ring-berry/40"
                  />
                  <button className="rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95">保存</button>
                </div>
              </SoftCard>
            </div>
          )}
        </section>

        <nav className="fixed bottom-5 left-1/2 z-10 grid w-[min(390px,calc(100%-40px))] -translate-x-1/2 grid-cols-3 gap-2 rounded-[30px] border border-white/80 bg-white/85 p-2 shadow-soft backdrop-blur">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setScreen(tab.id)}
              className={`rounded-[24px] px-3 py-3 text-xs font-black transition active:scale-95 ${
                screen === tab.id ? "bg-cocoa text-white shadow-float" : "text-cocoa/70"
              }`}
            >
              <span className="block text-xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

function SoftCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-[34px] bg-white/85 p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="text-xs font-bold text-cocoa/55">{subtitle}</p>
        </div>
        <span className="rounded-full bg-honey/40 px-3 py-1 text-xs font-black">MVP</span>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-[28px] ${tone} p-4 shadow-float`}>
      <p className="text-xs font-black text-cocoa/60">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
