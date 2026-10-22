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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-card border border-line bg-coal p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 id="auth-modal-title" className="text-lg font-semibold text-bone">
            {mode === "register" ? "Create Test Account" : "Sign In"}
          </h2>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="min-h-[44px] min-w-[44px] rounded-control px-3 text-sm text-fog hover:text-bone"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex gap-2 border-b border-line pb-4">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`min-h-[44px] flex-1 rounded-control border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "border-peach bg-peach-dim text-peach"
                : "border-line bg-graphite text-fog hover:text-bone"
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
            className={`min-h-[44px] flex-1 rounded-control border px-3 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "border-peach bg-peach-dim text-peach"
                : "border-line bg-graphite text-fog hover:text-bone"
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="auth-display-name" className="block text-xs font-medium text-fog">
                Display Name
              </label>
              <input
                id="auth-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Mercer"
                className="mt-1 min-h-[44px] w-full rounded-control border border-line bg-graphite px-3 py-2 text-sm text-bone placeholder:text-fog"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-fog">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@example.com"
              className="mt-1 min-h-[44px] w-full rounded-control border border-line bg-graphite px-3 py-2 text-sm text-bone placeholder:text-fog"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-fog">
              Password (min 8 characters)
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 min-h-[44px] w-full rounded-control border border-line bg-graphite px-3 py-2 text-sm text-bone placeholder:text-fog"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-control border border-loss/40 bg-coal p-3 text-xs text-loss">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] w-full rounded-control bg-peach px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? "Authenticating..."
              : mode === "register"
                ? "Create Account & Claim 10,000.00 XTS"
                : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
