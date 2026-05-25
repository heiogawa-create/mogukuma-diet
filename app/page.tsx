"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import { useSubscription } from "@/hooks/useSubscription";
import type { User } from "@supabase/supabase-js";

type Screen = "home" | "meal" | "weight" | "report" | "settings";
type MealType = "朝食" | "昼食" | "夕食" | "間食";
type Gender = "female" | "male";
type ActivityLevel = "sedentary" | "light" | "active";

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

type AnalyzeResult = {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  comment: string;
};

type WeeklyReport = {
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
  riskWarnings: string[];
  recommendedFoods: string[];
  convenienceStoreSuggestions: string[];
  encouragementMessage: string;
};

type UserSettings = {
  name: string;
  gender: Gender;
  age: number;
  height: number;
  currentWeight: number;
  targetWeight: number;
  activityLevel: ActivityLevel;
  manualCalories: number;
  manualProtein: number;
  manualFat: number;
  manualCarbs: number;
  manualFiber: number;
  manualWater: number;
};

const MEALS_STORAGE_KEY = "mogukuma-diet-meals";
const WEIGHTS_STORAGE_KEY = "mogukuma-diet-weights";
const SETTINGS_STORAGE_KEY = "mogukuma-diet-settings";
const mealTypes: MealType[] = ["朝食", "昼食", "夕食", "間食"];

const defaultSettings: UserSettings = {
  name: "",
  gender: "female",
  age: 30,
  height: 158,
  currentWeight: 57,
  targetWeight: 54,
  activityLevel: "light",
  manualCalories: 0,
  manualProtein: 0,
  manualFat: 0,
  manualCarbs: 0,
  manualFiber: 0,
  manualWater: 0,
};

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

const tabs: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "ホーム", icon: "🏠" },
  { id: "meal", label: "食事", icon: "📷" },
  { id: "weight", label: "体重", icon: "📈" },
  { id: "report", label: "AI分析", icon: "🐻" },
  { id: "settings", label: "設定", icon: "⚙️" },
];

const activityLabels: Record<ActivityLevel, string> = {
  sedentary: "座り仕事が多い",
  light: "軽い運動をする",
  active: "よく体を動かす",
};

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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

function calcGoals(settings: UserSettings) {
  const { gender, age, height, currentWeight, activityLevel } = settings;
  const bmr = gender === "female"
    ? 447.6 + 9.2 * currentWeight + 3.1 * height - 4.3 * age
    : 88.4 + 13.4 * currentWeight + 4.8 * height - 5.7 * age;
  const tdee = Math.round(bmr * activityMultipliers[activityLevel]);
  const calories = Math.max(tdee - 400, gender === "female" ? 1200 : 1500);
  const protein = Math.round(currentWeight * 1.6);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const fiber = gender === "female" ? 18 : 21;
  const water = Math.round(currentWeight * 35);
  return {
    calories: settings.manualCalories || calories,
    protein: settings.manualProtein || protein,
    fat: settings.manualFat || fat,
    carbs: settings.manualCarbs || carbs,
    fiber: settings.manualFiber || fiber,
    water: settings.manualWater || water,
    tdee,
  };
}

function calcStreak(mealRecords: MealRecord[]): number {
  const recordedDates = new Set(mealRecords.map((m) => m.date));
  let streak = 0;
  const current = new Date();
  while (true) {
    const key = current.toISOString().slice(0, 10);
    if (recordedDates.has(key)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getFallbackMealRecords(): MealRecord[] {
  return [
    { id: "sample-breakfast", date: getTodayKey(), mealType: "朝食", name: "いちごヨーグルト", calories: 360, protein: 18, fat: 9, carbs: 48, fiber: 5, water: 250 },
    { id: "sample-lunch", date: getTodayKey(), mealType: "昼食", name: "鮭おにぎり・豆腐サラダ", calories: 520, protein: 28, fat: 16, carbs: 68, fiber: 7, water: 400 },
    { id: "sample-dinner", date: getTodayKey(), mealType: "夕食", name: "チキンと温野菜", calories: 610, protein: 36, fat: 20, carbs: 58, fiber: 9, water: 350 },
  ];
}

function getFallbackWeightRecords(): WeightRecord[] {
  return [
    { id: "sample-1", date: offsetDateKey(-6), weight: 58.4, targetWeight: 54 },
    { id: "sample-2", date: offsetDateKey(-5), weight: 58.2, targetWeight: 54 },
    { id: "sample-3", date: offsetDateKey(-4), weight: 58.0, targetWeight: 54 },
    { id: "sample-4", date: offsetDateKey(-3), weight: 57.8, targetWeight: 54 },
    { id: "sample-5", date: offsetDateKey(-2), weight: 57.9, targetWeight: 54 },
    { id: "sample-6", date: offsetDateKey(-1), weight: 57.6, targetWeight: 54 },
    { id: "sample-7", date: getTodayKey(), weight: 57.4, targetWeight: 54 },
  ];
}

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("確認メールを送りました！メールを確認してね🐻");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-app px-4 py-5 text-cocoa">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col items-center justify-center gap-6 overflow-hidden rounded-[42px] border border-white/70 bg-white/45 shadow-soft backdrop-blur px-8">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-berry/80">AI Diet Coach</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">もぐクマDiet</h1>
        </div>
        <MoguKuma message={mode === "login" ? "おかえり！ログインしてね🐻" : "はじめまして！一緒にがんばろう🐻"} />
        <div className="w-full space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("login")} className={`rounded-[20px] py-3 text-sm font-black transition active:scale-95 ${mode === "login" ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}>ログイン</button>
            <button onClick={() => setMode("signup")} className={`rounded-[20px] py-3 text-sm font-black transition active:scale-95 ${mode === "signup" ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}>新規登録</button>
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-black text-cocoa/65">メールアドレス</p>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" className="cute-input" />
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-cocoa/65">パスワード</p>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6文字以上" className="cute-input" />
            </div>
          </div>
          {message && <div className="rounded-[20px] bg-mint/60 p-3"><p className="text-sm font-bold text-cocoa">{message}</p></div>}
          {error && <div className="rounded-[20px] bg-sakura p-3"><p className="text-sm font-bold text-cocoa">⚠️ {error}</p></div>}
          <button onClick={handleSubmit} disabled={loading} className="w-full rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95 disabled:opacity-60">
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "新規登録"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [photoName, setPhotoName] = useState("写真を選択してね");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [mealForm, setMealForm] = useState<MealForm>(emptyMealForm);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [weight, setWeight] = useState("57.4");
  const [targetWeight, setTargetWeight] = useState("54.0");
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const todayKey = getTodayKey();
  const { isPremium } = useSubscription();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const savedMeals = window.localStorage.getItem(MEALS_STORAGE_KEY);
    const savedWeights = window.localStorage.getItem(WEIGHTS_STORAGE_KEY);
    const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    setMealRecords(savedMeals ? JSON.parse(savedMeals) : getFallbackMealRecords());
    const initialWeights: WeightRecord[] = savedWeights ? JSON.parse(savedWeights) : getFallbackWeightRecords();
    setWeightRecords(initialWeights);
    const latestWeight = [...initialWeights].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latestWeight) {
      setWeight(String(latestWeight.weight));
      setTargetWeight(String(latestWeight.targetWeight));
    }
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    setHasLoadedStorage(true);
  }, []);

  useEffect(() => { if (hasLoadedStorage) window.localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(mealRecords)); }, [hasLoadedStorage, mealRecords]);
  useEffect(() => { if (hasLoadedStorage) window.localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weightRecords)); }, [hasLoadedStorage, weightRecords]);
  useEffect(() => { if (hasLoadedStorage) window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); }, [hasLoadedStorage, settings]);

  const goals = useMemo(() => calcGoals(settings), [settings]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => offsetDateKey(-6 + i)), []);
  const weekMeals = useMemo(() => mealRecords.filter((m) => weekDates.includes(m.date)), [mealRecords, weekDates]);
  const weekWeights = useMemo(() => weightRecords.filter((w) => weekDates.includes(w.date)), [weightRecords, weekDates]);

  const streak = useMemo(() => calcStreak(mealRecords), [mealRecords]);

  const todayMeals = useMemo(() => mealRecords.filter((meal) => meal.date === todayKey), [mealRecords, todayKey]);
  const todayTotals = useMemo(
    () => todayMeals.reduce(
      (sum, meal) => ({ calories: sum.calories + meal.calories, protein: sum.protein + meal.protein, fat: sum.fat + meal.fat, carbs: sum.carbs + meal.carbs, fiber: sum.fiber + meal.fiber, water: sum.water + meal.water }),
      { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, water: 0 }
    ),
    [todayMeals]
  );

  const badges = useMemo(() => [
    { id: "streak7", label: "7日継続", icon: "🔥", earned: streak >= 7 },
    { id: "streak14", label: "14日継続", icon: "⭐", earned: streak >= 14 },
    { id: "streak30", label: "30日継続", icon: "👑", earned: streak >= 30 },
    { id: "protein", label: "蛋白質達成", icon: "💪", earned: todayTotals.protein >= goals.protein },
    { id: "water", label: "水分達成", icon: "💧", earned: todayTotals.water >= goals.water },
    { id: "fiber", label: "食物繊維達成", icon: "🥦", earned: todayTotals.fiber >= goals.fiber },
  ], [streak, todayTotals, goals]);

  const mealsByType = useMemo(
    () => mealTypes.map((type) => ({
      label: type.replace("食", ""),
      kcal: todayMeals.filter((meal) => meal.mealType === type).reduce((sum, meal) => sum + meal.calories, 0),
      icon: type === "朝食" ? "🍓" : type === "昼食" ? "🍙" : type === "夕食" ? "🥗" : "🍪",
    })),
    [todayMeals]
  );

  const pfcChartData = [
    { name: "蛋白質", value: todayTotals.protein, goal: goals.protein, color: "#F38BB5" },
    { name: "脂質", value: todayTotals.fat, goal: goals.fat, color: "#FFD36E" },
    { name: "炭水化物", value: todayTotals.carbs, goal: goals.carbs, color: "#8EDDC0" },
    { name: "食物繊維", value: todayTotals.fiber, goal: goals.fiber, color: "#BFEEDB" },
    { name: "水分(dl)", value: Math.round(todayTotals.water / 100), goal: Math.round(goals.water / 100), color: "#9FD7FF" },
  ];

  const weightChartData = useMemo(
    () => [...weightRecords].sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((record) => ({
      day: formatChartDay(record.date),
      weight: record.weight,
      targetWeight: record.targetWeight,
    })),
    [weightRecords]
  );

  const latestWeightRecord = weightChartData.at(-1);
  const previousWeightRecord = weightChartData.at(-2);
  const weightDelta = latestWeightRecord && previousWeightRecord ? latestWeightRecord.weight - previousWeightRecord.weight : 0;
  const targetLeft = latestWeightRecord ? Math.max(latestWeightRecord.weight - latestWeightRecord.targetWeight, 0) : 0;
  const calorieProgress = Math.min(Math.round((todayTotals.calories / goals.calories) * 100), 100);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPremium) {
      alert("📷 AI写真解析はプレミアム限定機能です。\nアップグレードして使ってみてね🐻");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    setAnalyzeResult(null);
    setAnalyzeError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPhotoPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      setAnalyzing(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });
        const data = await res.json();
        if (data.error) {
          setAnalyzeError(data.error);
        } else {
          setAnalyzeResult(data);
          setMealForm((current) => ({ ...current, name: data.foodName ?? current.name, calories: data.calories ?? current.calories, protein: data.protein ?? current.protein, fat: data.fat ?? current.fat, carbs: data.carbs ?? current.carbs, fiber: data.fiber ?? current.fiber }));
        }
      } catch { setAnalyzeError("通信エラーが発生しました。"); }
      finally { setAnalyzing(false); }
    };
    reader.readAsDataURL(file);
  };

  const fetchWeeklyReport = async () => {
    if (!isPremium) {
      alert("🐻 AI週間レポートはプレミアム限定機能です。\nアップグレードして使ってみてね！");
      return;
    }
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealRecords: weekMeals, weightRecords: weekWeights, goals, userName: settings.name, gender: settings.gender }),
      });
      const data = await res.json();
      if (data.error) { setReportError(data.error); }
      else { setWeeklyReport(data); }
    } catch { setReportError("通信エラーが発生しました。"); }
    finally { setReportLoading(false); }
  };

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
    setPhotoPreview(null);
    setAnalyzeResult(null);
    setAnalyzeError(null);
    setPhotoName("写真を選択してね");
  };

  const saveMeal = () => {
    if (!editingMealId && !isPremium) {
      const todayCount = mealRecords.filter((m) => m.date === todayKey).length;
      if (todayCount >= 3) {
        alert("🐻 フリープランは1日3件まで記録できるよ。\nプレミアムにアップグレードすると無制限になるよ！");
        return;
      }
    }
    const normalizedMeal: MealRecord = { ...mealForm, id: editingMealId ?? createId(), date: todayKey, name: mealForm.name.trim() || "なまえなしごはん" };
    setMealRecords((current) => editingMealId ? current.map((meal) => (meal.id === editingMealId ? normalizedMeal : meal)) : [normalizedMeal, ...current]);
    resetMealForm();
  };

  const editMeal = (meal: MealRecord) => {
    setMealForm({ mealType: meal.mealType, name: meal.name, calories: meal.calories, protein: meal.protein, fat: meal.fat, carbs: meal.carbs, fiber: meal.fiber, water: meal.water });
    setEditingMealId(meal.id);
    setScreen("meal");
  };

  const deleteMeal = (id: string) => {
    setMealRecords((current) => current.filter((meal) => meal.id !== id));
    if (editingMealId === id) resetMealForm();
  };

  const saveWeight = () => {
    const normalizedWeight: WeightRecord = { id: createId(), date: todayKey, weight: toNumber(weight), targetWeight: toNumber(targetWeight) };
    setWeightRecords((current) => [normalizedWeight, ...current.filter((record) => record.date !== todayKey)]);
  };

  const saveSettings = () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const displayName = settings.name || "あなた";

  if (authLoading) {
    return (
      <main className="min-h-screen bg-app flex items-center justify-center">
        <p className="text-cocoa font-black animate-pulse">🐻 読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <main className="min-h-screen bg-app px-4 py-5 text-cocoa">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[42px] border border-white/70 bg-white/45 shadow-soft backdrop-blur">

        <header className="px-5 pb-3 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-berry/80">AI Diet Coach</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">もぐクマDiet</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-white/90 px-3 py-2 text-center shadow-float">
                <p className="text-xs font-black text-berry">🔥 {streak}日</p>
              </div>
              {isPremium && (
                <div className="rounded-full bg-amber-400 px-3 py-2 text-center shadow-float">
                  <p className="text-xs font-black text-white">✨ PRO</p>
                </div>
              )}
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-full bg-white/90 px-3 py-2 text-xs font-black shadow-float"
              >
                ログアウト
              </button>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-5 pb-28">

          {screen === "home" && (
            <div className="space-y-5">
              <MoguKuma message={`${displayName}、今日の記録は${todayMeals.length}件だよ。${streak > 0 ? `${streak}日連続記録中！すごいね🔥` : "続けているだけで十分えらい！"}`} />

              <div className="flex gap-2 overflow-x-auto pb-1">
                {badges.map((badge) => (
                  <div key={badge.id} className={`shrink-0 rounded-[20px] px-3 py-2 text-center shadow-float transition ${badge.earned ? "bg-honey/80" : "bg-white/50 opacity-40"}`}>
                    <p className="text-xl">{badge.icon}</p>
                    <p className="mt-1 text-[9px] font-black">{badge.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[34px] bg-gradient-to-br from-sakura via-white to-mint/70 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-cocoa/70">今日の合計カロリー</p>
                    <p className="mt-1 text-4xl font-black">{todayTotals.calories}<span className="text-lg"> kcal</span></p>
                    <p className="mt-1 text-xs font-bold text-cocoa/50">目標：{goals.calories} kcal</p>
                  </div>
                  <div className="rounded-3xl bg-white/80 px-4 py-3 text-center shadow-float">
                    <p className="text-xs font-bold text-cocoa/60">目標まで</p>
                    <p className="text-xl font-black text-berry">あと{Math.max(goals.calories - todayTotals.calories, 0)}</p>
                    <p className="text-xs font-bold text-cocoa/50">kcal</p>
                  </div>
                </div>
                <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-berry to-honey transition-all" style={{ width: `${calorieProgress}%` }} />
                </div>
                <p className="mt-1 text-right text-xs font-bold text-cocoa/50">{calorieProgress}%</p>
              </div>

              <div className="space-y-3">
                <NutrientRow label="蛋白質（Protein）" desc="筋肉を守り、代謝を上げる三大栄養素" value={todayTotals.protein} goal={goals.protein} unit="g" color="bg-sakura" barColor="#F38BB5" />
                <NutrientRow label="脂質（Fat）" desc="ホルモンや細胞の材料。摂りすぎに注意" value={todayTotals.fat} goal={goals.fat} unit="g" color="bg-honey/60" barColor="#FFD36E" />
                <NutrientRow label="炭水化物（Carbohydrate）" desc="脳と体のメインエネルギー源" value={todayTotals.carbs} goal={goals.carbs} unit="g" color="bg-mint" barColor="#8EDDC0" />
                <NutrientRow label="食物繊維" desc="腸内環境を整える。1日の目標を目指そう" value={todayTotals.fiber} goal={goals.fiber} unit="g" color="bg-cream" barColor="#BFEEDB" />
                <NutrientRow label="水分" desc="体重や活動量に合わせて補給しよう" value={todayTotals.water} goal={goals.water} unit="ml" color="bg-sky-100" barColor="#9FD7FF" />
              </div>

              <div className="rounded-[28px] bg-peach/70 p-4 shadow-float">
                <p className="text-xs font-black text-cocoa/60">今日の体重</p>
                <p className="mt-1 text-2xl font-black">{latestWeightRecord ? `${latestWeightRecord.weight} kg` : "未記録"}</p>
                {latestWeightRecord && <p className="mt-1 text-xs font-bold text-cocoa/50">目標まで あと {targetLeft.toFixed(1)} kg</p>}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {mealsByType.map((meal) => (
                  <button key={meal.label} onClick={() => setScreen("meal")} className="rounded-[24px] bg-white/85 p-3 text-left shadow-float transition active:scale-95">
                    <span className="text-2xl">{meal.icon}</span>
                    <p className="mt-2 text-xs font-black">{meal.label}</p>
                    <p className="text-[11px] font-bold text-cocoa/60">{meal.kcal} kcal</p>
                  </button>
                ))}
              </div>

              <SoftCard title="今日の栄養バランス" subtitle="目標値と比較">
                <NutritionBarChart data={pfcChartData} />
              </SoftCard>

              <SoftCard title="体重グラフ" subtitle="保存した体重を反映">
                <WeightAreaChart data={weightChartData} compact />
              </SoftCard>

              <button onClick={() => setScreen("report")} className="w-full rounded-[28px] bg-gradient-to-r from-berry/80 to-honey/80 p-5 text-left shadow-soft transition active:scale-95">
                <p className="text-lg font-black text-white">🐻 週間AIレポートを見る</p>
                <p className="mt-1 text-xs font-bold text-white/80">{isPremium ? "もぐクマが今週の食事を分析するよ" : "🔒 プレミアム限定機能"}</p>
              </button>
            </div>
          )}

          {screen === "meal" && (
            <div className="space-y-5">
              {analyzeResult ? <MoguKuma compact message={analyzeResult.comment} /> : <MoguKuma compact message={isPremium ? "写真を撮ったらもぐクマが栄養素を推定するよ！手入力でも記録できるよ🐻" : "手入力で食事を記録しよう🐻 写真解析はプレミアム限定だよ"} />}

              <labe
