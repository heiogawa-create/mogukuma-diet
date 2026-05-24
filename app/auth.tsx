"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MoguKuma } from "@/components/MoguKuma";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
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
    } catch (err: any) {
      setError(err.message || "エラーが発生しました");
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
            <button
              onClick={() => setMode("login")}
              className={`rounded-[20px] py-3 text-sm font-black transition active:scale-95 ${mode === "login" ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}
            >
              ログイン
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-[20px] py-3 text-sm font-black transition active:scale-95 ${mode === "signup" ? "bg-cocoa text-white shadow-float" : "bg-cream text-cocoa"}`}
            >
              新規登録
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-black text-cocoa/65">メールアドレス</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="cute-input"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-cocoa/65">パスワード</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                className="cute-input"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-[20px] bg-mint/60 p-3">
              <p className="text-sm font-bold text-cocoa">{message}</p>
            </div>
          )}

          {error && (
            <div className="rounded-[20px] bg-sakura p-3">
              <p className="text-sm font-bold text-cocoa">⚠️ {error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-[24px] bg-cocoa px-5 py-4 font-black text-white shadow-float transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "新規登録"}
          </button>
        </div>
      </div>
    </main>
  );
}