"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
type MealType = "朝食" | "昼食" | "夕食" | "間食";

type MealRecord = {
  id: string;
  date: string;
  mealType: MealType;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  water: number;
};

type MealForm = Omit<MealRecord, "id" | "date">;

type WeightRecord = {
  id: string;
  date: string;
  weight: number;
  targetWeight: number;
};

const MEALS_STORAGE_KEY = "mogukuma-diet-meals";
const WEIGHTS_STORAGE_KEY = "mogukuma-diet-weights";
const mealTypes: MealType[] = ["朝食", "昼食", "夕食", "間食"];

const tabs: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "🏠" },
  { id: "meal", label: "食事", icon: "📷" },
  { id: "weight", label: "体重", icon: "📈" },
];

const emptyMealForm: MealForm = {
  mealType: "昼食",
  name: "",
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  water: 0,
};

const fallbackMealRecords: MealRecord[] = [
  {
    id: "sample-breakfast",
    date: getTodayKey(),
    mealType: "朝食",
    name: "いちごヨーグルト",
    calories: 360,
    protein: 18,
    fat: 9,
    carbs: 48,
    fiber: 5,
    water: 250,
  },
  {
    id: "sample-lunch",
    date: getTodayKey(),
    mealType: "昼食",
    name: "鮭おにぎり・豆腐サラダ",
    calories: 520,
    protein: 28,
    fat: 16,
    carbs: 68,
    fiber: 7,
    water: 400,
  },
  {
    id: "sample-dinner",
    date: getTodayKey(),
    mealType: "夕食",
    name: "チキンと温野菜",
    calories: 610,
    protein: 36,
    fat: 20,
    carbs: 58,
    fiber: 9,
    water: 350,
  },
];

const fallbackWeightRecords: WeightRecord[] = [
  { id: "sample-1", date: offsetDateKey(-6), weight: 58.4, targetWeight: 54 },
  { id: "sample-2", date: offsetDateKey(-5), weight: 58.2, targetWeight: 54 },
  { id: "sample-3", date: offsetDateKey(-4), weight: 58.0, targetWeight: 54 },
  { id: "sample-4", date: offsetDateKey(-3), weight: 57.8, targetWeight: 54 },
  { id: "sample-5", date: offsetDateKey(-2), weight: 57.9, targetWeight: 54 },
  { id: "sample-6", date: offsetDateKey(-1), weight: 57.6, targetWeight: 54 },
  { id: "sample-7", date: getTodayKey(), weight: 57.4, targetWeight: 54 },
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mogukuma-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDateKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatChartDay(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return dateKey === getTodayKey() ? "今日" : `${Number(month)}/${Number(day)}`;
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [photoName, setPhotoName] = useState("今日のランチ写真.jpg");
  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [mealForm, setMealForm] = useState<MealForm>(emptyMealForm);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [weight, setWeight] = useState("57.4");
  const [targetWeight, setTargetWeight] = useState("54.0");
  const todayKey = getTodayKey();

  useEffect(() => {
    const savedMeals = window.localStorage.getItem(MEALS_STORAGE_KEY);
    const savedWeights = window.localStorage.getItem(WEIGHTS_STORAGE_KEY);
    setMealRecords(savedMeals ? JSON.parse(savedMeals) : fallbackMealRecords);
    const initialWeights: WeightRecord[] = savedWeights ? JSON.parse(savedWeights) : fallbackWeightRecords;
    setWeightRecords(initialWeights);
    const latestWeight = [...initialWeights].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latestWeight) {
      setWeight(String(latestWeight.weight));
      setTargetWeight(String(latestWeight.targetWeight));
    }
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => {
    if (hasLoadedStorage) {
      window.localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(mealRecords));
    }
  }, [hasLoadedStorage, mealRecords]);

  useEffect(() => {
    if (hasLoadedStorage) {
      window.localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weightRecords));
    }
  }, [hasLoadedStorage, weightRecords]);

  const todayMeals = useMemo(() => mealRecords.filter((meal) => meal.date === todayKey), [mealRecords, todayKey]);
  const todayTotals = useMemo(
    () =>
      todayMeals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.calories,
          protein: sum.protein + meal.protein,
          fat: sum.fat + meal.fat,
          carbs: sum.carbs + meal.carbs,
          fiber: sum.fiber + meal.fiber,
          water: sum.water + meal.water,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, water: 0 },
      ),
    [todayMeals],
  );

  const mealsByType = useMemo(
    () =>
      mealTypes.map((type) => ({
        label: type.replace("食", ""),
        kcal: todayMeals.filter((meal) => meal.mealType === type).reduce((sum, meal) => sum + meal.calories, 0),
        icon: type === "朝食" ? "🍓" : type === "昼食" ? "🍙" : type === "夕食" ? "🥗" : "🍪",
      })),
    [todayMeals],
  );

  const pfcChartData = [
    { name: "P", label: "たんぱく質", value: todayTotals.protein, color: "#F38BB5" },
    { name: "F", label: "脂質", value: todayTotals.fat, color: "#FFD36E" },
    { name: "C", label: "炭水化物", value: todayTotals.carbs, color: "#8EDDC0" },
    { name: "食物繊維", label: "食物繊維", value: todayTotals.fiber, color: "#BFEEDB" },
    { name: "水分", label: "水分", value: Math.round(todayTotals.water / 100), color: "#9FD7FF" },
  ];

  const weightChartData = useMemo(
    () =>
      [...weightRecords]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14)
        .map((record) => ({ day: formatChartDay(record.date), weight: record.weight, targetWeight: record.targetWeight })),
    [weightRecords],
  );

  const latestWeight = weightChartData.at(-1);
  const previousWeight = weightChartData.at(-2);
  const weightDelta = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0;
  const targetLeft = latestWeight ? Math.max(latestWeight.weight - latestWeight.targetWeight, 0) : 0;
  const calorieGoal = 1800;
  const calorieProgress = Math.min(Math.round((todayTotals.calories / calorieGoal) * 100), 100);

  const updateMealForm = (key: keyof MealForm, value: string) => {
    setMealForm((current) => {
      if (key === "name") return { ...current, name: value };
      if (key === "mealType") return { ...current, mealType: value as MealType };
      return { ...current, [key]: toNumber(value) };
    });
  };

  const resetMealForm = () => {
    setMealForm(emptyMealForm);
    setEditingMealId(null);
  };

  const saveMeal = () => {
    const normalizedMeal: MealRecord = {
      ...mealForm,
      id: editingMealId ?? createId(),
      date: todayKey,
      name: mealForm.name.trim() || "なまえなしごはん",
    };

    setMealRecords((current) =>
      editingMealId ? current.map((meal) => (meal.id === editingMealId ? normalizedMeal : meal)) : [normalizedMeal, ...current],
    );
    resetMealForm();
  };

  const editMeal = (meal: MealRecord) => {
    setMealForm({
      mealType: meal.mealType,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      fiber: meal.fiber,
      water: meal.water,
    });
    setEditingMealId(meal.id);
    setScreen("meal");
  };

  const deleteMeal = (id: string) => {
    setMealRecords((current) => current.filter((meal) => meal.id !== id));
    if (editingMealId === id) resetMealForm();
  };

  const saveWeight = () => {
    const normalizedWeight: WeightRecord = {
      id: createId(),
      date: todayKey,
      weight: toNumber(weight),
      targetWeight: toNumber(targetWeight),
    };
    setWeightRecords((current) => [normalizedWeight, ...current.filter((record) => record.date !== todayKey)]);
  };

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
              <MoguKuma message={`今日の記録は${todayMeals.length}件だよ。入力したデータから自動で合計しているから、更新しても消えないよ！`} />

              <div className="rounded-[34px] bg-gradient-to-br from-sakura via-white to-mint/70 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-cocoa/70">今日の合計カロリー</p>
                    <p className="mt-1 text-4xl font-black">
                      {todayTotals.calories}
                      <span className="text-lg"> kcal</span>
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/80 px-4 py-3 text-center shadow-float">
                    <p className="text-xs font-bold text-cocoa/60">目標まで</p>
                    <p className="text-xl font-black text-berry">あと{Math.max(calorieGoal - todayTotals.calories, 0)}</p>
                  </div>
                </div>
                <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-berry to-honey" style={{ width: `${calorieProgress}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Metric label="たんぱく質" value={`${todayTotals.protein} g`} tone="bg-sakura" />
                <Metric label="脂質" value={`${todayTotals.fat} g`} tone="bg-honey/60" />
                <Metric label="炭水化物" value={`${todayTotals.carbs} g`} tone="bg-mint" />
                <Metric label="食物繊維" value={`${todayTotals.fiber} g`} tone="bg-cream" />
                <Metric label="水分" value={`${todayTotals.water} ml`} tone="bg-sky-100" />
                <Metric label="今日の体重" value={latestWeight ? `${latestWeight.weight} kg` : "未記録"} tone="bg-peach/70" />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {mealsByType.map((meal) => (
                  <button
                    key={meal.label}
                    onClick={() => setScreen("meal")}
                    className="rounded-[24px] bg-white/85 p-3 text-left shadow-float transition active:scale-95"
                  >
                    <span className="text-2xl">{meal.icon}</span>
                    <p className="mt-2 text-xs font-black">{meal.label}</p>
                    <p className="text-[11px] font-bold text-cocoa/60">{meal.kcal} kcal</p>
                  </button>
                ))}
              </div>

              <SoftCard title="今日の栄養グラフ" subtitle="保存データから自動更新">
                <NutritionBarChart data={pfcChartData} />
              </SoftCard>

              <SoftCard title="体重ミニグラフ" subtitle="保存した体重を反映">
                <WeightAreaChart data={weightChartData} compact />
              </SoftCard>
            </div>
          )}

          {screen === "meal" && (
            <div className="space-y-5">
              <MoguKuma compact message="写真は気分づくり用だよ。下のフォームに入力して保存すると、ホームとグラフにすぐ反映されるよ。" />

              <label className="block rounded-[36px] border-2 border-dashed border-berry/30 bg-white/80 p-6 text-center shadow-soft">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "写真を選択してね")}
                />
                <div className="mx-auto flex h-36 items-center justify-center rounded-[30px] bg-gradient-to-br from-sakura to-cream text-6xl shadow-inner">
                  🍱
                </div>
                <p className="mt-4 text-lg font-black">食事写真をアップロード</p>
                <p className="mt-1 text-sm font-bold text-cocoa/60">{photoName}</p>
              </label>

              <SoftCard title={editingMealId ? "食事記録を編集" : "食事記録フォーム"} subtitle="手入力でlocalStorage保存">
                <div className="space-y-4">
                  <div>
                    <Label>食事名</Label>
                    <input
                      value={mealForm.name}
                      onChange={(event) => updateMealForm("name", event.target.value)}
                      placeholder="例：鮭おにぎりと豆腐サラダ"
                      className="cute-input"
                    />
                  </div>
                  <div>
                    <Label>タイミング</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {mealTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => updateMealForm("mealType", type)}
                          className={`rounded-[20px] px-2 py-3 text-xs font-black transition active:scale-95 ${
                            mealForm.mealType === type ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="カロリー" unit="kcal" value={mealForm.calories} onChange={(value) => updateMealForm("calories", value)} />
                    <NumberInput label="たんぱく質" unit="g" value={mealForm.protein} onChange={(value) => updateMealForm("protein", value)} />
                    <NumberInput label="脂質" unit="g" value={mealForm.fat} onChange={(value) => updateMealForm("fat", value)} />
                    <NumberInput label="炭水化物" unit="g" value={mealForm.carbs} onChange={(value) => updateMealForm("carbs", value)} />
                    <NumberInput label="食物繊維" unit="g" value={mealForm.fiber} onChange={(value) => updateMealForm("fiber", value)} />
                    <NumberInput label="水分量" unit="ml" value={mealForm.water} onChange={(value) => updateMealForm("water", value)} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={saveMeal} className="flex-1 rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95">
                      {editingMealId ? "更新する" : "保存する"}
                    </button>
                    {editingMealId && (
                      <button onClick={resetMealForm} className="rounded-[24px] bg-cream px-5 py-4 font-black text-cocoa shadow-float transition active:scale-95">
                        取消
                      </button>
                    )}
                  </div>
                </div>
              </SoftCard>

              <SoftCard title="保存した食事記録" subtitle={`${mealRecords.length}件を保存中`}>
                <div className="space-y-3">
                  {mealRecords.length === 0 && <EmptyMessage>まだ食事記録がないよ。まずは1つ保存してみよう。</EmptyMessage>}
                  {mealRecords.map((meal) => (
                    <div key={meal.id} className="rounded-[26px] bg-cream/80 p-4 shadow-float">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-berry">{meal.date}・{meal.mealType}</p>
                          <h3 className="mt-1 text-lg font-black">{meal.name}</h3>
                          <p className="mt-1 text-xs font-bold text-cocoa/65">
                            {meal.calories}kcal / P{meal.protein}g F{meal.fat}g C{meal.carbs}g / 食物繊維{meal.fiber}g / 水分{meal.water}ml
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button onClick={() => editMeal(meal)} className="rounded-full bg-white px-3 py-2 text-xs font-black shadow-float">編集</button>
                          <button onClick={() => deleteMeal(meal.id)} className="rounded-full bg-sakura px-3 py-2 text-xs font-black shadow-float">削除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SoftCard>
            </div>
          )}

          {screen === "weight" && (
            <div className="space-y-5">
              <MoguKuma compact message="保存した体重はグラフに反映されるよ。目標までの距離も一緒に見守るね。" />

              <div className="grid grid-cols-2 gap-3">
                <Metric label="今日の体重" value={latestWeight ? `${latestWeight.weight} kg` : "未記録"} tone="bg-sakura" />
                <Metric label="目標まで" value={latestWeight ? `${targetLeft.toFixed(1)} kg` : "未記録"} tone="bg-mint" />
                <Metric label="前回差" value={`${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`} tone="bg-honey/60" />
                <Metric label="目標体重" value={latestWeight ? `${latestWeight.targetWeight} kg` : `${targetWeight} kg`} tone="bg-cream" />
              </div>

              <SoftCard title="体重を記録" subtitle="今日の記録は上書き保存">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="今日の体重" unit="kg" value={weight} step="0.1" onChange={setWeight} />
                    <NumberInput label="目標体重" unit="kg" value={targetWeight} step="0.1" onChange={setTargetWeight} />
                  </div>
                  <button onClick={saveWeight} className="w-full rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95">
                    体重を保存する
                  </button>
                </div>
              </SoftCard>

              <SoftCard title="体重グラフ" subtitle="保存データから自動更新">
                <WeightAreaChart data={weightChartData} />
              </SoftCard>

              <SoftCard title="体重記録一覧" subtitle={`${weightRecords.length}件を保存中`}>
                <div className="space-y-3">
                  {weightRecords.length === 0 && <EmptyMessage>まだ体重記録がないよ。</EmptyMessage>}
                  {[...weightRecords]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((record) => (
                      <div key={record.id} className="flex items-center justify-between rounded-[24px] bg-cream/80 p-4 shadow-float">
                        <div>
                          <p className="text-xs font-black text-berry">{record.date}</p>
                          <p className="mt-1 text-lg font-black">{record.weight} kg</p>
                          <p className="text-xs font-bold text-cocoa/60">目標 {record.targetWeight} kg</p>
                        </div>
                        <button onClick={() => setWeightRecords((current) => current.filter((item) => item.id !== record.id))} className="rounded-full bg-sakura px-3 py-2 text-xs font-black shadow-float">
                          削除
                        </button>
                      </div>
                    ))}
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

function NutritionBarChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={26}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3D9C8" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontWeight: 800, fontSize: 11 }} />
          <YAxis hide />
          <Tooltip cursor={{ fill: "rgba(255, 220, 232, 0.35)" }} />
          <Bar dataKey="value" radius={[16, 16, 16, 16]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function WeightAreaChart({ data, compact = false }: { data: { day: string; weight: number; targetWeight: number }[]; compact?: boolean }) {
  return (
    <div className={compact ? "h-44" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 16, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F38BB5" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#F38BB5" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3D9C8" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontSize: 12, fontWeight: 800 }} />
          <YAxis domain={["dataMin - 1", "dataMax + 1"]} axisLine={false} tickLine={false} tick={{ fill: "#7A5342", fontSize: 12, fontWeight: 800 }} />
          <Tooltip />
          <Area type="monotone" dataKey="weight" name="体重" stroke="#F38BB5" strokeWidth={4} fill="url(#weightGradient)" />
          <Area type="monotone" dataKey="targetWeight" name="目標" stroke="#8EDDC0" strokeWidth={3} fill="transparent" strokeDasharray="5 5" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
        <span className="rounded-full bg-honey/40 px-3 py-1 text-xs font-black">保存OK</span>
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

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-black text-cocoa/65">{children}</p>;
}

function NumberInput({
  label,
  unit,
  value,
  step = "1",
  onChange,
}: {
  label: string;
  unit: string;
  value: number | string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="flex items-center rounded-[24px] bg-cream px-4 py-3 ring-2 ring-transparent focus-within:ring-berry/40">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-lg font-black text-cocoa outline-none"
        />
        <span className="ml-2 text-xs font-black text-cocoa/50">{unit}</span>
      </div>
    </label>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="rounded-[24px] bg-cream/80 p-4 text-sm font-bold text-cocoa/65">{children}</p>;
}
