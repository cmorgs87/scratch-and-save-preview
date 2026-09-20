"use client";

import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "scratch-save-theme";
const THEME_EVENT = "scratch-save-theme-change";

export function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};

      const media = window.matchMedia("(prefers-color-scheme: light)");
      const handleChange = () => callback();

      window.addEventListener("storage", handleChange);
      window.addEventListener(THEME_EVENT, handleChange);
      media.addEventListener("change", handleChange);

      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(THEME_EVENT, handleChange);
        media.removeEventListener("change", handleChange);
      };
    },
    resolveInitialTheme,
    () => "dark"
  );

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] text-[color:var(--foreground-strong)] shadow-[var(--shadow-md)] transition hover:border-[color:var(--panel-border-strong)] hover:bg-[color:var(--panel)] ${
        compact ? "h-10 w-10 text-xs font-black" : "gap-2 px-4 py-2.5 text-sm font-semibold"
      }`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true">{theme === "dark" ? "L" : "D"}</span>
      {!compact ? <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
