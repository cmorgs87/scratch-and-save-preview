"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { BrandLogo } from "@/app/_components/BrandLogo";
import { ThemeToggle } from "@/app/_components/ThemeToggle";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

  async function signup() {
    const nextEmail = email.trim();
    setMessage("");

    if (!nextEmail || !password) {
      setMessage("Enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      await apiPost<{ ok: true }>("/auth/signup", { email: nextEmail, password });
      await apiPost<{ ok: true }>("/auth/login", { email: nextEmail, password });
      router.push("/home");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Signup failed."));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") signup();
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden flex-col justify-between rounded-[34px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl lg:flex">
          <div>
            <div className="flex items-start justify-between gap-3">
              <BrandLogo href="/login" priority className="max-w-[220px]" />
              <ThemeToggle compact />
            </div>

            <div className="mt-8 rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-5">
              <div className="text-sm font-semibold text-[color:var(--foreground-strong)]">Create your account</div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                New players still use the existing signup flow and receive the configured starting balance before heading into the app.
              </p>
            </div>
          </div>

          <div className="mt-8 hidden rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-5 text-sm leading-6 text-[color:var(--foreground-muted)] lg:block">
            This update is UI-only. Account creation, balance seeding, sessions, and ticket logic stay connected to the current backend.
          </div>
        </aside>

        <section className="flex items-center justify-center rounded-[34px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex flex-col items-center lg:hidden">
              <BrandLogo href="/login" priority className="max-w-[210px]" />
            </div>

            <div className="mb-6">
              <div className="hidden lg:inline-flex rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--teal)]">
                Scratch & Save
              </div>
              <h1 className="mt-0 text-4xl font-semibold tracking-tight text-[color:var(--foreground-strong)] lg:mt-5">Create account</h1>
              <p className="mt-2 hidden text-sm leading-6 text-[color:var(--foreground-muted)] lg:block">
                Join the current app flow with the same signup bonus, auth behavior, and ticket access that already work today.
              </p>
            </div>

            {message ? (
              <div className="mb-4 rounded-[22px] border border-amber-300/20 bg-amber-200/12 px-4 py-3 text-sm text-amber-100">
                {message}
              </div>
            ) : null}

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[color:var(--foreground-strong)]">Email</span>
                <input
                  className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3 text-[color:var(--foreground-strong)] outline-none placeholder:text-[color:var(--foreground-faint)] focus:border-[color:var(--panel-border-strong)]"
                  placeholder="Email address"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={onKeyDown}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[color:var(--foreground-strong)]">Password</span>
                <input
                  className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3 text-[color:var(--foreground-strong)] outline-none placeholder:text-[color:var(--foreground-faint)] focus:border-[color:var(--panel-border-strong)]"
                  placeholder="Create password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={onKeyDown}
                />
              </label>

              <button
                className="mt-2 rounded-[20px] bg-[linear-gradient(135deg,var(--teal),#73f0df)] px-4 py-3.5 font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={signup}
                disabled={busy}
              >
                {busy ? "Creating..." : "Create Account"}
              </button>

              <button
                className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-3 font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--panel)]"
                onClick={() => router.push("/login")}
              >
                Back to sign in
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
