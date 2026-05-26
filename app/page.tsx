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

async function compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
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
  const [analyzeCount, setAnalyzeCount] = useState<number>(0);

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
  const { isPremium, isMax, plan, openPortal } = useSubscription();
  const analyzeLimit = isMax ? 100 : 50;

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

  // 写真解析回数を取得
  useEffect(() => {
    const fetchAnalyzeCount = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isPremium) return;
      const yearMonth = new Date().toISOString().slice(0, 7);
      const res = await fetch(`/api/analyze/count?yearMonth=${yearMonth}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyzeCount(data.count ?? 0);
      }
    };
    fetchAnalyzeCount();
  }, [isPremium, analyzeResult]);

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
    { id: "water"
