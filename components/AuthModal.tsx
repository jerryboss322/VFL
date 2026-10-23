"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppContext";
import { api } from "@/lib/api/client";

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen, refreshAccount } = useApp();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res =
      mode === "register"
        ? await api.auth.register({ email, password, displayName })
        : await api.auth.login({ email, password });

    setSubmitting(false);
    if (!res.ok) {
      setError(
        res.failure.kind === "network"
          ? res.failure.message
          : res.failure.error.message || "Authentication failed",
      );
      return;
    }

    await refreshAccount();
    setAuthModalOpen(false);
    setEmail("");
    setPassword("");
    setDisplayName("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-ink/75 transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Click outside backdrop to close */}
      <div
        className="fixed inset-0"
        onClick={() => setAuthModalOpen(false)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-b from-coal via-coal to-ink p-8 shadow-2xl shadow-peach/10 ring-1 ring-white/10">
        {/* Glow backdrop accent */}
        <div className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 rounded-full bg-peach/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-win/10 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-peach/20 to-peach/5 border border-peach/30 text-peach shadow-inner">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-xl font-bold tracking-tight text-bone">
                {mode === "register" ? "Create Trader Account" : "Welcome Back"}
              </h2>
              <p className="text-xs text-fog/80 mt-0.5">
                {mode === "register"
                  ? "Claim 10,000.00 XTS virtual balance on instant signup"
                  : "Access your portfolio, slips, and active positions"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fog hover:bg-graphite hover:text-bone transition-colors"
            aria-label="Close modal"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab switch */}
        <div className="relative mt-6 flex rounded-xl bg-graphite/90 p-1 border border-line/60">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold tracking-wide transition-all duration-200 ${
              mode === "register"
                ? "bg-peach text-ink shadow-md shadow-peach/20 font-bold"
                : "text-fog hover:text-bone hover:bg-coal/40"
            }`}
          >
            Register (+10,000 XTS)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold tracking-wide transition-all duration-200 ${
              mode === "login"
                ? "bg-peach text-ink shadow-md shadow-peach/20 font-bold"
                : "text-fog hover:text-bone hover:bg-coal/40"
            }`}
          >
            Sign In
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative mt-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label htmlFor="auth-display-name" className="text-xs font-medium tracking-wide text-bone/90 flex items-center justify-between">
                <span>Display Name</span>
                <span className="text-[10px] text-fog/60">Public identity</span>
              </label>
              <div className="relative">
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="h-11 w-full rounded-xl border border-line bg-graphite/70 px-4 text-sm text-bone placeholder:text-fog/40 focus:border-peach focus:outline-none focus:ring-2 focus:ring-peach/20 transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-xs font-medium tracking-wide text-bone/90 flex items-center justify-between">
              <span>Email Address</span>
              <span className="text-[10px] text-fog/60">Account access</span>
            </label>
            <div className="relative">
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@exchange.vfl"
                className="h-11 w-full rounded-xl border border-line bg-graphite/70 px-4 text-sm text-bone placeholder:text-fog/40 focus:border-peach focus:outline-none focus:ring-2 focus:ring-peach/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-xs font-medium tracking-wide text-bone/90 flex items-center justify-between">
              <span>Password</span>
              <span className="text-[10px] text-fog/60">Min 8 characters</span>
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-11 w-full rounded-xl border border-line bg-graphite/70 px-4 text-sm text-bone placeholder:text-fog/40 focus:border-peach focus:outline-none focus:ring-2 focus:ring-peach/20 transition-all font-mono"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-loss/30 bg-loss/10 p-3 text-xs text-loss">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {mode === "register" && (
            <div className="flex items-center justify-between rounded-xl border border-win/20 bg-win/5 px-3.5 py-2.5 text-xs text-win">
              <span className="flex items-center gap-2 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-win animate-pulse" />
                Starter Bonus Activated
              </span>
              <span className="font-mono font-bold tracking-tight text-bone">+10,000.00 XTS</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="group relative mt-2 flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-peach via-peach to-sky-400 font-semibold text-ink shadow-lg shadow-peach/25 transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            <span className="relative text-sm font-bold tracking-wide">
              {submitting
                ? "Authenticating..."
                : mode === "register"
                  ? "Create Account & Claim 10,000 XTS"
                  : "Sign In to Terminal"}
            </span>
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="relative mt-6 border-t border-line/60 pt-4 text-center">
          <p className="text-xs text-fog">
            {mode === "register" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="font-semibold text-peach hover:underline"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                New to Virtual Football?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-semibold text-peach hover:underline"
                >
                  Create account (+10,000 XTS)
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

