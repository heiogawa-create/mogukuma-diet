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
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    if (code) {
      setReferralCode(code.toUpperCase());
      setMode("signup");
    }
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (referralCode && data.session) {
          await fetch('/api/referral/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ code: referralCode }),
          });
        }
        if (referralCode && !data.session) {
          localStorage.setItem('pending_referral_code', referralCode);
        }
        setMessage("確認メールを送りました！メールを確認してね🐻");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const pendingCode = localStorage.getItem('pending_referral_code');
        if (pendingCode && data.session) {
          await fetch('/api/referral/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ code: pendingCode }),
          });
          localStorage.removeItem('pending_referral_code');
        }
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
            {mode === "signup" && (
              <div>
                <p className="mb-2 text-xs font-black text-cocoa/65">紹介コード（任意）</p>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="例：ABCD1234"
                  className="cute-input"
                  maxLength={8}
                />
              </div>
            )}
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
  const [myReferralCode, setMyReferralCode] = useState<string>('');

  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [mealForm, setMealForm] = useState<MealForm>(emptyMealForm);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [weight, setWeight] = useState("57.4");
  const [targetWeight, setTargetWeight] = useState("54.0");
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [todayKey, setTodayKey] = useState(getTodayKey());

useEffect(() => {
  const timer = setInterval(() => {
    const newKey = getTodayKey();
    setTodayKey(prev => prev !== newKey ? newKey : prev);
  }, 60 * 1000);
  return () => clearInterval(timer);
}, []);
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

  useEffect(() => {
    const fetchReferralCode = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isPremium) return;
      const res = await fetch('/api/referral/code', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyReferralCode(data.code);
      }
    };
    fetchReferralCode();
  }, [isPremium]);

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
      const compressed = await compressImage(dataUrl, 800, 0.7);
      const base64 = compressed.split(",")[1];
      setAnalyzing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
        });
        const data = await res.json();
        if (data.error) {
          setAnalyzeError(data.error);
        } else {
          setAnalyzeResult(data);
          setAnalyzeCount(prev => prev + 1);
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
              {isMax && (
                <div className="rounded-full bg-purple-500 px-3 py-2 text-center shadow-float">
                  <p className="text-xs font-black text-white">👑 MAX</p>
                </div>
              )}
              {isPremium && !isMax && (
                <div className="rounded-full bg-amber-400 px-3 py-2 text-center shadow-float">
                  <p className="text-xs font-black text-white">✨ PRO</p>
                </div>
              )}
              <button onClick={() => supabase.auth.signOut()} className="rounded-full bg-white/90 px-3 py-2 text-xs font-black shadow-float">
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
              <label className={`block rounded-[36px] border-2 border-dashed bg-white/80 p-6 text-center shadow-soft ${isPremium ? "border-berry/30 cursor-pointer" : "border-gray-200 cursor-not-allowed opacity-70"}`}>
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} disabled={!isPremium} />
                {photoPreview ? (
                  <img src={photoPreview} alt="食事写真" className="mx-auto h-48 w-full rounded-[24px] object-cover shadow-soft" />
                ) : (
                  <div className="mx-auto flex h-36 items-center justify-center rounded-[30px] bg-gradient-to-br from-sakura to-cream text-6xl shadow-inner">
                    {isPremium ? "🍱" : "🔒"}
                  </div>
                )}
                <p className="mt-4 text-lg font-black">{analyzing ? "🔍 もぐクマが解析中..." : isPremium ? "📷 写真を撮る・選ぶ" : "🔒 写真解析（プレミアム限定）"}</p>
                <p className="mt-1 text-sm font-bold text-cocoa/60">{isPremium ? photoName : "アップグレードで使えるよ"}</p>
              </label>
              {isPremium && (
                <div className="rounded-[20px] bg-amber-50 border border-amber-200 px-4 py-2 text-center">
                  <p className="text-xs font-black text-amber-700">
                    📷 今月の写真解析：あと{analyzeLimit - analyzeCount}回使えるよ（{analyzeCount}/{analyzeLimit}回）
                  </p>
                </div>
              )}
              {!isPremium && (
                <button onClick={() => setScreen("settings")} className="w-full rounded-[28px] bg-gradient-to-r from-amber-400 to-orange-400 p-4 text-center font-black text-white shadow-soft transition active:scale-95">
                  ✨ プレミアムにアップグレード
                </button>
              )}
              {analyzing && <div className="rounded-[28px] bg-berry/10 p-4 text-center"><p className="text-sm font-black text-berry animate-pulse">🐻 もぐクマが栄養素を推定しています...</p></div>}
              {analyzeError && <div className="rounded-[28px] bg-sakura p-4"><p className="text-sm font-bold text-cocoa">⚠️ {analyzeError}</p><p className="mt-1 text-xs text-cocoa/70">手動で入力してね！</p></div>}
              {analyzeResult && (
                <div className="rounded-[28px] bg-mint/60 p-4 shadow-float">
                  <p className="text-xs font-black text-cocoa/70">✨ AI解析完了！フォームに自動入力したよ</p>
                  <p className="mt-1 text-lg font-black">{analyzeResult.foodName}</p>
                  <p className="mt-1 text-xs font-bold text-cocoa/60">{analyzeResult.calories}kcal / 蛋白質{analyzeResult.protein}g 脂質{analyzeResult.fat}g 炭水化物{analyzeResult.carbs}g / 食物繊維{analyzeResult.fiber}g</p>
                </div>
              )}
              <SoftCard title={editingMealId ? "食事記録を編集" : "食事記録フォーム"} subtitle={isPremium ? (analyzeResult ? "AI推定値を確認・修正してね" : "手入力で保存") : `フリープラン：本日${mealRecords.filter(m => m.date === todayKey).length}/3件`}>
                <div className="space-y-4">
                  <div><Label>食事名</Label><input value={mealForm.name} onChange={(e) => updateMealForm("name", e.target.value)} placeholder="例：鮭おにぎりと豆腐サラダ" className="cute-input" /></div>
                  <div>
                    <Label>タイミング</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {mealTypes.map((type) => (
                        <button key={type} onClick={() => updateMealForm("mealType", type)} className={`rounded-[20px] px-2 py-3 text-xs font-black transition active:scale-95 ${mealForm.mealType === type ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}>{type}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="カロリー" unit="kcal" value={mealForm.calories} onChange={(v) => updateMealForm("calories", v)} />
                    <NumberInput label="蛋白質" unit="g" value={mealForm.protein} onChange={(v) => updateMealForm("protein", v)} />
                    <NumberInput label="脂質" unit="g" value={mealForm.fat} onChange={(v) => updateMealForm("fat", v)} />
                    <NumberInput label="炭水化物" unit="g" value={mealForm.carbs} onChange={(v) => updateMealForm("carbs", v)} />
                    <NumberInput label="食物繊維" unit="g" value={mealForm.fiber} onChange={(v) => updateMealForm("fiber", v)} />
                    <NumberInput label="水分量" unit="ml" value={mealForm.water} onChange={(v) => updateMealForm("water", v)} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={saveMeal} className="flex-1 rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95">{editingMealId ? "更新する" : "保存する"}</button>
                    {editingMealId && <button onClick={resetMealForm} className="rounded-[24px] bg-cream px-5 py-4 font-black text-cocoa shadow-float transition active:scale-95">取消</button>}
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
                          <p className="mt-1 text-xs font-bold text-cocoa/65">{meal.calories}kcal / 蛋白質{meal.protein}g 脂質{meal.fat}g 炭水化物{meal.carbs}g / 食物繊維{meal.fiber}g / 水分{meal.water}ml</p>
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
                <Metric label="今日の体重" value={latestWeightRecord ? `${latestWeightRecord.weight} kg` : "未記録"} tone="bg-sakura" />
                <Metric label="目標まで" value={latestWeightRecord ? `${targetLeft.toFixed(1)} kg` : "未記録"} tone="bg-mint" />
                <Metric label="前回差" value={`${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`} tone="bg-honey/60" />
                <Metric label="目標体重" value={latestWeightRecord ? `${latestWeightRecord.targetWeight} kg` : `${targetWeight} kg`} tone="bg-cream" />
              </div>
              <SoftCard title="体重を記録" subtitle="今日の記録は上書き保存">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="今日の体重" unit="kg" value={weight} step="0.1" onChange={setWeight} />
                    <NumberInput label="目標体重" unit="kg" value={targetWeight} step="0.1" onChange={setTargetWeight} />
                  </div>
                  <button onClick={saveWeight} className="w-full rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95">体重を保存する</button>
                </div>
              </SoftCard>
              <SoftCard title="体重グラフ" subtitle="保存データから自動更新">
                <WeightAreaChart data={weightChartData} />
              </SoftCard>
              <SoftCard title="体重記録一覧" subtitle={`${weightRecords.length}件を保存中`}>
                <div className="space-y-3">
                  {weightRecords.length === 0 && <EmptyMessage>まだ体重記録がないよ。</EmptyMessage>}
                  {[...weightRecords].sort((a, b) => b.date.localeCompare(a.date)).map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-[24px] bg-cream/80 p-4 shadow-float">
                      <div>
                        <p className="text-xs font-black text-berry">{record.date}</p>
                        <p className="mt-1 text-lg font-black">{record.weight} kg</p>
                        <p className="text-xs font-bold text-cocoa/60">目標 {record.targetWeight} kg</p>
                      </div>
                      <button onClick={() => setWeightRecords((current) => current.filter((item) => item.id !== record.id))} className="rounded-full bg-sakura px-3 py-2 text-xs font-black shadow-float">削除</button>
                    </div>
                  ))}
                </div>
              </SoftCard>
            </div>
          )}

          {screen === "report" && (
            <div className="space-y-5">
              <MoguKuma message={weeklyReport ? weeklyReport.encouragementMessage : isPremium ? `${displayName}の今週のデータを分析するよ！ボタンを押してね🐻` : "AI週間レポートはプレミアム限定だよ🔒 アップグレードしてね！"} />
              <button onClick={fetchWeeklyReport} disabled={reportLoading} className="w-full rounded-[28px] bg-gradient-to-r from-berry/80 to-honey/80 p-5 font-black text-white shadow-soft transition active:scale-95 disabled:opacity-60">
                {reportLoading ? "🐻 もぐクマが分析中..." : isPremium ? "✨ 今週のAIレポートを生成" : "🔒 プレミアムにアップグレードして使う"}
              </button>
              {!isPremium && (
                <div className="rounded-[28px] bg-amber-50 border border-amber-200 p-5 text-center">
                  <p className="text-lg font-black text-amber-800">✨ プレミアムプランで使える機能</p>
                  <ul className="mt-3 space-y-2 text-sm font-bold text-amber-700">
                    <li>🐻 AI週間レポート</li>
                    <li>📷 AI写真解析 月50回〜</li>
                    <li>📝 食事記録 無制限</li>
                  </ul>
                  <button onClick={() => window.location.href = '/pricing'} className="mt-4 w-full rounded-[24px] bg-amber-400 px-5 py-3 font-black text-white shadow-float transition active:scale-95">
                    プランを見る（¥480/月〜）
                  </button>
                </div>
              )}
              {reportLoading && <div className="rounded-[28px] bg-berry/10 p-4 text-center"><p className="text-sm font-black text-berry animate-pulse">🐻 今週の食事データを分析しています...</p></div>}
              {reportError && <div className="rounded-[28px] bg-sakura p-4"><p className="text-sm font-bold text-cocoa">⚠️ {reportError}</p></div>}
              {weeklyReport && (
                <div className="space-y-4">
                  <div className="rounded-[28px] bg-gradient-to-br from-mint/60 to-cream p-5 shadow-soft">
                    <p className="text-xs font-black text-cocoa/70">📊 今週の総評</p>
                    <p className="mt-2 text-sm font-bold leading-relaxed">{weeklyReport.summary}</p>
                  </div>
                  <SoftCard title="✅ 良かった点" subtitle="この調子で続けよう">
                    <div className="space-y-2">{weeklyReport.goodPoints.map((point, i) => <div key={i} className="rounded-[20px] bg-mint/50 px-4 py-3"><p className="text-sm font-bold">{point}</p></div>)}</div>
                  </SoftCard>
                  <SoftCard title="💡 改善できそうな点" subtitle="少しずつ意識してみよう">
                    <div className="space-y-2">{weeklyReport.improvementPoints.map((point, i) => <div key={i} className="rounded-[20px] bg-honey/40 px-4 py-3"><p className="text-sm font-bold">{point}</p></div>)}</div>
                  </SoftCard>
                  {weeklyReport.riskWarnings.length > 0 && (
                    <SoftCard title="⚠️ 注意してほしいこと" subtitle="無理せず健康的に">
                      <div className="space-y-2">{weeklyReport.riskWarnings.map((warning, i) => <div key={i} className="rounded-[20px] bg-sakura/80 px-4 py-3"><p className="text-sm font-bold">{warning}</p></div>)}</div>
                    </SoftCard>
                  )}
                  <SoftCard title="🥗 今週追加したい食品" subtitle="栄養バランスを整えるために">
                    <div className="flex flex-wrap gap-2">{weeklyReport.recommendedFoods.map((food, i) => <span key={i} className="rounded-full bg-mint/60 px-3 py-2 text-xs font-black">{food}</span>)}</div>
                  </SoftCard>
                  <SoftCard title="🏪 コンビニで買えるもの" subtitle="手軽に栄養補給">
                    <div className="space-y-2">{weeklyReport.convenienceStoreSuggestions.map((item, i) => <div key={i} className="rounded-[20px] bg-cream/80 px-4 py-3"><p className="text-sm font-bold">🛒 {item}</p></div>)}</div>
                  </SoftCard>
                </div>
              )}
              <SoftCard title="今週の記録" subtitle={`食事${weekMeals.length}件・体重${weekWeights.length}件`}>
                <div className="grid grid-cols-2 gap-2 text-xs font-black">
                  <div className="rounded-[16px] bg-cream/80 p-3 text-center"><p className="text-cocoa/60">記録した食事</p><p className="text-2xl">{weekMeals.length}件</p></div>
                  <div className="rounded-[16px] bg-cream/80 p-3 text-center"><p className="text-cocoa/60">連続記録</p><p className="text-2xl text-berry">{streak}日🔥</p></div>
                </div>
              </SoftCard>
            </div>
          )}

          {screen === "settings" && (
            <div className="space-y-5">
              <MoguKuma compact message={`${displayName}の情報を教えてね。目標カロリーとPFCを自動で計算するよ🐻`} />
              <SoftCard title="基本情報" subtitle="目標値の自動計算に使います">
                <div className="space-y-4">
                  <div><Label>名前（ニックネーム）</Label><input value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} placeholder="例：もぐちゃん" className="cute-input" /></div>
                  <div>
                    <Label>性別</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["female", "male"] as Gender[]).map((g) => (
                        <button key={g} onClick={() => setSettings((s) => ({ ...s, gender: g }))} className={`rounded-[20px] py-3 text-sm font-black transition active:scale-95 ${settings.gender === g ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}>
                          {g === "female" ? "👩 女性" : "👨 男性"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="年齢" unit="歳" value={settings.age} onChange={(v) => setSettings((s) => ({ ...s, age: toNumber(v) }))} />
                    <NumberInput label="身長" unit="cm" value={settings.height} onChange={(v) => setSettings((s) => ({ ...s, height: toNumber(v) }))} />
                    <NumberInput label="現在の体重" unit="kg" value={settings.currentWeight} step="0.1" onChange={(v) => setSettings((s) => ({ ...s, currentWeight: toNumber(v) }))} />
                    <NumberInput label="目標体重" unit="kg" value={settings.targetWeight} step="0.1" onChange={(v) => setSettings((s) => ({ ...s, targetWeight: toNumber(v) }))} />
                  </div>
                  <div>
                    <Label>活動量</Label>
                    <div className="space-y-2">
                      {(["sedentary", "light", "active"] as ActivityLevel[]).map((level) => (
                        <button key={level} onClick={() => setSettings((s) => ({ ...s, activityLevel: level }))} className={`w-full rounded-[20px] px-4 py-3 text-left text-sm font-black transition active:scale-95 ${settings.activityLevel === level ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}>
                          {level === "sedentary" ? "🪑 " : level === "light" ? "🚶 " : "🏃 "}{activityLabels[level]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SoftCard>
              <div className="rounded-[28px] bg-mint/50 p-4 shadow-float">
                <p className="text-xs font-black text-cocoa/70">🤖 自動計算された目標値</p>
                <p className="mt-1 text-[10px] font-bold text-cocoa/50">ハリス・ベネディクト方程式による推定値</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">維持カロリー</p><p className="text-lg">{goals.tdee} kcal</p></div>
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">目標カロリー</p><p className="text-lg text-berry">{goals.calories} kcal</p></div>
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">蛋白質</p><p className="text-lg">{goals.protein} g</p></div>
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">脂質</p><p className="text-lg">{goals.fat} g</p></div>
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">炭水化物</p><p className="text-lg">{goals.carbs} g</p></div>
                  <div className="rounded-[16px] bg-white/70 p-2 text-center"><p className="text-cocoa/60">食物繊維</p><p className="text-lg">{goals.fiber} g</p></div>
                </div>
              </div>
              <SoftCard title="目標値を手動で変更" subtitle="0のままにすると自動計算を使用">
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="カロリー目標" unit="kcal" value={settings.manualCalories} onChange={(v) => setSettings((s) => ({ ...s, manualCalories: toNumber(v) }))} />
                  <NumberInput label="蛋白質目標" unit="g" value={settings.manualProtein} onChange={(v) => setSettings((s) => ({ ...s, manualProtein: toNumber(v) }))} />
                  <NumberInput label="脂質目標" unit="g" value={settings.manualFat} onChange={(v) => setSettings((s) => ({ ...s, manualFat: toNumber(v) }))} />
                  <NumberInput label="炭水化物目標" unit="g" value={settings.manualCarbs} onChange={(v) => setSettings((s) => ({ ...s, manualCarbs: toNumber(v) }))} />
                  <NumberInput label="食物繊維目標" unit="g" value={settings.manualFiber} onChange={(v) => setSettings((s) => ({ ...s, manualFiber: toNumber(v) }))} />
                  <NumberInput label="水分目標" unit="ml" value={settings.manualWater} onChange={(v) => setSettings((s) => ({ ...s, manualWater: toNumber(v) }))} />
                </div>
                <p className="mt-2 text-xs font-bold text-cocoa/50">※ 0のままにすると自動計算値が使われます</p>
              </SoftCard>

              {isPremium && (
                <div className="rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5 shadow-float">
                  <p className="text-xs font-black text-amber-700 mb-2">🎁 あなたの紹介コード</p>
                  {myReferralCode ? (
                    <>
                      <div className="flex items-center gap-3">
                        <p className="text-2xl font-black text-amber-900 tracking-widest">{myReferralCode}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(myReferralCode);
                            alert('コピーしました！');
                          }}
                          className="rounded-[16px] bg-amber-400 px-3 py-2 text-xs font-black text-white shadow-float"
                        >
                          コピー
                        </button>
                      </div>
                      <p className="mt-2 text-xs font-bold text-amber-600">
                        友達がこのコードで登録して有料プランに入ると毎月報酬がもらえるよ🐻
                      </p>
                      <button
                        onClick={() => {
                          const url = `https://mogukuma-diet.vercel.app/?ref=${myReferralCode}`;
                          navigator.clipboard.writeText(url);
                          alert('招待リンクをコピーしました！');
                        }}
                        className="mt-3 w-full rounded-[20px] bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-float transition active:scale-95"
                      >
                        📤 招待リンクをコピー
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-amber-600">読み込み中...</p>
                  )}
                </div>
              )}

              <button onClick={saveSettings} className={`w-full rounded-[24px] px-5 py-4 font-black text-white shadow-float transition active:scale-95 ${settingsSaved ? "bg-mint/80 text-cocoa" : "bg-cocoa"}`}>
                {settingsSaved ? "✅ 保存しました！" : "設定を保存する"}
              </button>
              {!isPremium && (
                <button onClick={() => window.location.href = '/pricing'} className="w-full rounded-[24px] bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-4 font-black text-white shadow-float transition active:scale-95">
                  ✨ プレミアムにアップグレード（¥480/月〜）
                </button>
              )}
              {isPremium && (
                <button onClick={openPortal} className="w-full rounded-[24px] bg-white border-2 border-amber-400 px-5 py-4 font-black text-amber-600 shadow-float transition active:scale-95">
                  ✨ プラン管理・解約
                </button>
              )}
              <button onClick={() => supabase.auth.signOut()} className="w-full rounded-[24px] bg-sakura px-5 py-4 font-black text-cocoa shadow-float transition active:scale-95">
                ログアウト
              </button>
            </div>
          )}
        </section>

        <nav className="fixed bottom-5 left-1/2 z-10 grid w-[min(390px,calc(100%-40px))] -translate-x-1/2 grid-cols-5 gap-1 rounded-[30px] border border-white/80 bg-white/85 p-2 shadow-soft backdrop-blur">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setScreen(tab.id)} className={`rounded-[24px] px-2 py-3 text-[10px] font-black transition active:scale-95 ${screen === tab.id ? "bg-cocoa text-white shadow-float" : "text-cocoa/70"}`}>
              <span className="block text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

function NutrientRow({ label, desc, value, goal, unit, color, barColor }: { label: string; desc: string; value: number; goal: number; unit: string; color: string; barColor: string }) {
  const progress = Math.min(Math.round((value / goal) * 100), 100);
  const isOver = value > goal;
  return (
    <div className={`rounded-[28px] ${color} p-4 shadow-float`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs font-black text-cocoa/70">{label}</p><p className="text-[10px] font-bold text-cocoa/50">{desc}</p></div>
        <div className="text-right"><p className="text-xl font-black">{value}<span className="text-xs ml-1">{unit}</span></p><p className="text-[10px] font-bold text-cocoa/50">目標 {goal}{unit}</p></div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/60">
        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: isOver ? "#F38BB5" : barColor }} />
      </div>
      <p className="mt-1 text-right text-[10px] font-bold text-cocoa/50">{isOver ? `目標超過 +${value - goal}${unit}` : `あと ${goal - value}${unit}（${progress}%）`}</p>
    </div>
  );
}

function NutritionBarChart({ data }: { data: { name: string; value: number; goal: number; color: string }[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={20} margin={{ top: 8, bottom: 24, left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3D9C8" />
         <XAxis
  dataKey="name"
  axisLine={false}
  tickLine={false}
  tick={{ fill: "#7A5342", fontWeight: 800, fontSize: 10 }}
  interval={0}
  height={40}
/>
          <YAxis hide />
          <Tooltip cursor={{ fill: "rgba(255, 220, 232, 0.35)" }} />
          <Bar dataKey="goal" name="目標" radius={[8, 8, 8, 8]} fill="#E8E8E8" opacity={0.6} />
          <Bar dataKey="value" name="摂取" radius={[8, 8, 8, 8]}>
            {data.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-[10px] font-bold text-cocoa/40 mt-1">グレー＝目標値 / カラー＝摂取量</p>
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
        <div><h2 className="text-xl font-black">{title}</h2><p className="text-xs font-bold text-cocoa/55">{subtitle}</p></div>
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

function NumberInput({ label, unit, value, step = "1", onChange }: { label: string; unit: string; value: number | string; step?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="flex items-center rounded-[24px] bg-cream px-4 py-3 ring-2 ring-transparent focus-within:ring-berry/40">
        <input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-lg font-black text-cocoa outline-none" />
        <span className="ml-2 text-xs font-black text-cocoa/50">{unit}</span>
      </div>
    </label>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="rounded-[24px] bg-cream/80 p-4 text-sm font-bold text-cocoa/65">{children}</p>;
}
