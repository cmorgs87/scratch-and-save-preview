"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

const DEFAULT_LOGO_SRC = "/branding/scratch_n_save_logo.png";
const LIGHT_LOGO_SRC = "/branding/scratch_n_save_light.png";
const DARK_LOGO_SRC = "/branding/scratch_save_dark.png";
const THEME_STORAGE_KEY = "scratch-save-theme";
const THEME_EVENT = "scratch-save-theme-change";

type ThemeMode = "dark" | "light";

function readResolvedTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const theme = document.documentElement.dataset.theme;
    if (theme === "dark" || theme === "light") return theme;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  return "dark";
}

function subscribeToTheme(callback: () => void) {
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
}

export function BrandLogo({
  href = "/home",
  priority = false,
  className = "",
  imageClassName = "",
}: {
  href?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const resolvedTheme = useSyncExternalStore<ThemeMode>(subscribeToTheme, readResolvedTheme, () => "dark");
  const [verifiedThemeLogo, setVerifiedThemeLogo] = useState<{
    theme: ThemeMode;
    src: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const candidateSrc = resolvedTheme === "dark" ? DARK_LOGO_SRC : LIGHT_LOGO_SRC;

    const probe = new window.Image();

    probe.onload = () => {
      if (!cancelled) {
        setVerifiedThemeLogo({
          theme: resolvedTheme,
          src: candidateSrc,
        });
      }
    };

    probe.onerror = () => {
      if (!cancelled) {
        console.warn(`Scratch & Save ${resolvedTheme} logo failed to load; falling back to default logo.`);
        setVerifiedThemeLogo(null);
      }
    };

    probe.src = candidateSrc;

    return () => {
      cancelled = true;
    };
  }, [resolvedTheme]);

  const logoSrc =
    verifiedThemeLogo?.theme === resolvedTheme
      ? verifiedThemeLogo.src
      : DEFAULT_LOGO_SRC;

  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      <Image
        src={logoSrc}
        alt="Scratch & Save"
        width={320}
        height={320}
        priority={priority}
        className={`h-auto w-full max-w-[220px] ${imageClassName}`}
        onError={() => {
          if (logoSrc !== DEFAULT_LOGO_SRC) {
            console.warn("Scratch & Save themed logo failed during render; reverting to default logo.");
            setVerifiedThemeLogo(null);
          }
        }}
      />
    </Link>
  );
}
