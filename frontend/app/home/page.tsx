"use client";

import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { fetchCurrentUser, type MeResponse } from "@/lib/auth";
import { GlobalBalanceAudioHud } from "@/app/_components/AppChromeControls";
import { BrandLogo } from "@/app/_components/BrandLogo";
import { MobileAppShell, MobilePageHeader, MobileSurface } from "@/app/_components/MobileAppShell";
import { ThemeToggle, applyTheme, resolveInitialTheme, type ThemeMode } from "@/app/_components/ThemeToggle";
import { HomeNavIcon, RewardsNavIcon, TicketsNavIcon } from "@/app/_components/MobileBottomNav";

type PublicConfigResponse = { ok: true; dailyReward: number; signupBonus: number } | { ok: false; error?: string };
type DailyClaimResponse = { ok: true; reward: number; scratchCoin: number };

type FeaturedTicket = {
  id: string;
  themeId: string;
  title: string;
  eyebrow: string;
  art: string;
  blurb: string;
};

function MobileBrandMark() {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-[linear-gradient(135deg,#0f1f4d_0%,#172d6c_100%)] text-lg font-black text-[#63f0da] shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
      S
    </div>
  );
}

function MobileScratchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <path d="M6 7.5h10a2 2 0 0 1 2 2v7H8a2 2 0 0 1-2-2v-7Z" />
      <path d="M8 10h8M11 13h5" />
      <path d="M5 7.5h1M5 16.5h13" />
    </svg>
  );
}

function MobileGiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
      <path d="M4 10h16v10H4z" />
      <path d="M12 10v10M4 14h16M7.5 10C6.1 10 5 8.9 5 7.5S6.1 5 7.5 5c1.9 0 3.1 1.9 4.5 5M16.5 10c1.4 0 2.5-1.1 2.5-2.5S17.9 5 16.5 5c-1.9 0-3.1 1.9-4.5 5" />
    </svg>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [message, setMessage] = useState("");
  const [dailyReward, setDailyReward] = useState(25);
  const [busy, setBusy] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveInitialTheme());
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [mobileAccountSheetOpen, setMobileAccountSheetOpen] = useState(false);

  const featuredTickets = useMemo<FeaturedTicket[]>(
    () => [
      {
        id: "flamingo-frenzy",
        themeId: "flamingo_frenzy",
        title: "Flamingo Frenzy",
        eyebrow: "Tropical Splash",
        art: "/flamingo-frenzy/flamingo_frenzy_logo_transparent_v4.png?v=20260513-1",
        blurb: "Bright tropical scratch action with the existing live reveal flow.",
      },
      {
        id: "the-big-score",
        themeId: "the_big_score",
        title: "The Big Score",
        eyebrow: "Vegas Heist",
        art: "/assets/tickets/the-big-score/logo.png",
        blurb: "A premium vault-crack ticket using the current app logic underneath.",
      },
      {
        id: "battlescratch",
        themeId: "battlescratch",
        title: "Battlescratch",
        eyebrow: "Naval Strike",
        art: "/battlescratch/logo.png",
        blurb: "Plot markers, scratch the sea map, and reveal the fleet outcome.",
      },
      {
        id: "triple-crown-derby",
        themeId: "triple_crown_derby",
        title: "Triple Crown Derby",
        eyebrow: "Premier Stakes",
        art: "/triple-crown-derby/logo.png",
        blurb: "Race-themed premium play with the existing Derby payout engine.",
      },
    ],
    []
  );

  const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

  const refreshMe = useCallback(async () => {
    const data = await fetchCurrentUser();
    if (!data.ok) {
      router.replace("/login");
      return;
    }
    setMe(data);
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        router.replace("/login");
        return;
      }

      try {
        const config = await apiGet<PublicConfigResponse>("/config/public");
        if (config.ok) setDailyReward(config.dailyReward);
      } catch {
        // Keep default value if config is unavailable.
      }
    })();
  }, [refreshMe, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 1279px)");
    const syncViewportMode = (event?: MediaQueryListEvent) => {
      setIsCompactViewport(event ? event.matches : media.matches);
    };

    syncViewportMode();
    media.addEventListener("change", syncViewportMode);
    return () => {
      media.removeEventListener("change", syncViewportMode);
    };
  }, []);

  async function claimDaily() {
    setMessage("");
    setBusy(true);
    try {
      const response = await apiPost<DailyClaimResponse>("/rewards/daily-claim");
      setMessage(`Claimed +${response.reward} Points.`);
      await refreshMe();
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Daily claim failed."));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await apiPost<{ ok: true }>("/auth/logout");
    } catch {
      // Ignore logout errors and still bounce the user.
    }
    router.replace("/login");
  }

  const email = me && me.ok ? me.user.email : "--";
  const balance = me && me.ok ? me.user.scratchCoin : 0;
  const username = email.split("@")[0] || "Player";
  const userInitial = username.charAt(0).toUpperCase() || "U";
  const mobileTab = searchParams.get("tab") === "rewards" ? "rewards" : "home";

  function setTheme(theme: ThemeMode) {
    setThemeMode(theme);
    applyTheme(theme);
    setMobileUserMenuOpen(false);
  }

  if (isCompactViewport) {
    const mobileNavItems = [
      {
        id: "home",
        label: "Home",
        icon: <HomeNavIcon />,
        active: mobileTab === "home",
        onClick: () => router.push("/home"),
      },
      {
        id: "tickets",
        label: "Tickets",
        icon: <TicketsNavIcon />,
        onClick: () => router.push("/scratch?view=tickets"),
      },
      {
        id: "rewards",
        label: "Rewards",
        icon: <RewardsNavIcon />,
        active: mobileTab === "rewards",
        onClick: () => router.push("/home?tab=rewards"),
      },
    ];

    return (
      <MobileAppShell
        navItems={mobileNavItems}
        contentClassName="pb-[max(4.75rem,calc(4rem+env(safe-area-inset-bottom)))]"
        header={mobileTab === "rewards" ? <MobilePageHeader title="Rewards" balance={balance} /> : undefined}
      >
        {mobileTab === "home" ? (
          <div className="mt-1 flex min-h-[calc(100dvh-6.35rem)] flex-col gap-2">
            <section className="relative rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <MobileBrandMark />
                <div className="relative">
                  <button
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-2 text-sm font-semibold text-[color:var(--foreground-strong)] shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:bg-[color:var(--panel)]"
                    onClick={() => setMobileUserMenuOpen((open) => !open)}
                    type="button"
                    aria-label="Open profile and settings"
                    aria-expanded={mobileUserMenuOpen}
                  >
                    <span className="sr-only">Profile</span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--teal),#73f0df)] text-[0.78rem] font-bold text-slate-950">
                      {userInitial}
                    </span>
                  </button>
                  {mobileUserMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.55rem)] z-20 w-[220px] rounded-[22px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">Signed in as</div>
                      <div className="mt-1 text-sm font-semibold text-[color:var(--foreground-strong)]">{username}</div>
                      <div className="truncate text-[0.8rem] text-[color:var(--foreground-muted)]">{email}</div>
                      <div className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">Theme</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          className={`rounded-full px-3 py-2 text-[0.82rem] font-semibold transition ${
                            themeMode === "light"
                              ? "bg-[linear-gradient(135deg,var(--teal),#73f0df)] text-slate-950 shadow-[0_10px_24px_rgba(34,230,193,0.18)]"
                              : "border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-[color:var(--foreground-strong)]"
                          }`}
                          onClick={() => setTheme("light")}
                          type="button"
                        >
                          Light
                        </button>
                        <button
                          className={`rounded-full px-3 py-2 text-[0.82rem] font-semibold transition ${
                            themeMode === "dark"
                              ? "bg-[linear-gradient(135deg,var(--teal),#73f0df)] text-slate-950 shadow-[0_10px_24px_rgba(34,230,193,0.18)]"
                              : "border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-[color:var(--foreground-strong)]"
                          }`}
                          onClick={() => setTheme("dark")}
                          type="button"
                        >
                          Dark
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        <button
                          className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-3 py-2 text-[0.82rem] font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel-soft)]"
                          onClick={() => {
                            setMobileUserMenuOpen(false);
                            setMobileAccountSheetOpen(true);
                          }}
                          type="button"
                        >
                          Account Settings
                        </button>
                        <button
                          className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-3 py-2 text-[0.82rem] font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel-soft)]"
                          onClick={logout}
                          type="button"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-2 pb-0 pt-0.5 text-center">
                <div className="text-[0.9rem] font-semibold text-[color:var(--foreground-strong)]">Welcome back!</div>
                <div className="mt-2 flex justify-center">
                  <GlobalBalanceAudioHud balance={balance} compact />
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <div className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[color:var(--foreground-faint)]">
                    Daily Bonus +{dailyReward}
                  </div>
                  <button
                    className="rounded-full bg-[linear-gradient(135deg,var(--teal),#73f0df)] px-3.5 py-1.5 text-[0.82rem] font-semibold text-slate-950 shadow-[0_12px_24px_rgba(34,230,193,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={claimDaily}
                    disabled={busy}
                    type="button"
                  >
                    {busy ? "Claiming..." : "Claim"}
                  </button>
                </div>
              </div>
              {message ? (
                <div className="mx-2 mb-1 mt-2 rounded-[16px] border border-teal-200/14 bg-teal-300/8 px-3 py-2 text-center text-[0.8rem] text-teal-100">
                  {message}
                </div>
              ) : null}
            </section>

            <section className="grid grid-cols-2 gap-2">
              <button
                className="rounded-[24px] border border-[color:var(--panel-border)] bg-[linear-gradient(135deg,rgba(86,230,213,0.18),rgba(115,240,223,0.08))] px-4 py-1.5 text-center shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:translate-y-[-1px]"
                onClick={() => router.push("/scratch?view=tickets")}
                type="button"
              >
                <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/70 text-[color:var(--foreground-strong)] shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                  <MobileScratchIcon />
                </div>
                <div className="mt-1 text-[1.28rem] font-semibold leading-none text-[color:var(--foreground-strong)]">Scratch</div>
                <div className="mt-0.5 text-[0.84rem] font-medium text-[color:var(--foreground-muted)]">Play Now</div>
              </button>

              <button
                className="rounded-[24px] border border-[color:var(--panel-border)] bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(115,240,223,0.06))] px-4 py-1.5 text-center shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:translate-y-[-1px]"
                onClick={() => router.push("/home?tab=rewards")}
                type="button"
              >
                <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-white/70 text-[color:var(--foreground-strong)] shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                  <MobileGiftIcon />
                </div>
                <div className="mt-1 text-[1.28rem] font-semibold leading-none text-[color:var(--foreground-strong)]">Rewards</div>
                <div className="mt-0.5 text-[0.84rem] font-medium text-[color:var(--foreground-muted)]">View &amp; Redeem</div>
              </button>
            </section>

            <section className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[0.94rem] font-semibold text-[color:var(--foreground-strong)]">Featured Tickets</div>
                </div>
                <button
                  className="text-[0.88rem] font-semibold text-[color:var(--teal)]"
                  onClick={() => router.push("/scratch?view=tickets")}
                  type="button"
                >
                  See All
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
                {featuredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className="h-full overflow-hidden rounded-[18px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:translate-y-[-1px]"
                    onClick={() => router.push(`/scratch?view=tickets&theme=${ticket.themeId}`)}
                    type="button"
                  >
                    <div className="relative h-full min-h-[58px] rounded-[12px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)]">
                      <Image src={ticket.art} alt={ticket.title} fill unoptimized className="object-contain p-1" sizes="220px" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <MobileSurface className="mt-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">Daily Bonus</div>
                  <div className="mt-2 text-xl font-semibold text-[color:var(--foreground-strong)]">Claim +{dailyReward}</div>
                  <div className="mt-1 text-sm text-[color:var(--foreground-muted)]">Redeem the live daily reward already wired to your balance.</div>
                </div>
                <button
                  className="rounded-full bg-[linear-gradient(135deg,var(--teal),#73f0df)] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_12px_24px_rgba(34,230,193,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={claimDaily}
                  disabled={busy}
                  type="button"
                >
                  {busy ? "Claiming..." : "Redeem"}
                </button>
              </div>
              {message ? (
                <div className="mt-3 rounded-[18px] border border-teal-200/14 bg-teal-300/8 px-3 py-3 text-sm text-teal-100">
                  {message}
                </div>
              ) : null}
            </MobileSurface>

            <MobileSurface className="mt-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">Rewards</div>
              <div className="mt-2 text-xl font-semibold text-[color:var(--foreground-strong)]">Daily reward ready</div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                Claim points, then jump back into the live ticket lineup whenever you are ready for another scratch.
              </div>
              <button
                className="mt-4 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel)]"
                onClick={() => router.push("/scratch?view=tickets")}
                type="button"
              >
                Open Tickets
              </button>
            </MobileSurface>
          </>
        )}
        {mobileAccountSheetOpen ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/32 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6">
            <div className="w-full max-w-[430px] rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--foreground-faint)]">
                    Account Settings
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[color:var(--foreground-strong)]">{username}</div>
                  <div className="text-sm text-[color:var(--foreground-muted)]">{email}</div>
                </div>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] text-lg text-[color:var(--foreground-strong)]"
                  onClick={() => setMobileAccountSheetOpen(false)}
                  type="button"
                  aria-label="Close account settings"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">Theme</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-full px-3 py-2 text-[0.84rem] font-semibold transition ${
                        themeMode === "light"
                          ? "bg-[linear-gradient(135deg,var(--teal),#73f0df)] text-slate-950 shadow-[0_10px_24px_rgba(34,230,193,0.18)]"
                          : "border border-[color:var(--panel-border)] bg-[color:var(--panel)] text-[color:var(--foreground-strong)]"
                      }`}
                      onClick={() => setTheme("light")}
                      type="button"
                    >
                      Light
                    </button>
                    <button
                      className={`rounded-full px-3 py-2 text-[0.84rem] font-semibold transition ${
                        themeMode === "dark"
                          ? "bg-[linear-gradient(135deg,var(--teal),#73f0df)] text-slate-950 shadow-[0_10px_24px_rgba(34,230,193,0.18)]"
                          : "border border-[color:var(--panel-border)] bg-[color:var(--panel)] text-[color:var(--foreground-strong)]"
                      }`}
                      onClick={() => setTheme("dark")}
                      type="button"
                    >
                      Dark
                    </button>
                  </div>
                </div>

                <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--foreground-faint)]">Account</div>
                  <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                    Username and password management can live here next. The current build already supports theme changes and sign out,
                    and this sheet is now the right place to add future account tools.
                  </div>
                </div>

                <button
                  className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground-strong)] transition hover:bg-[color:var(--panel-soft)]"
                  onClick={logout}
                  type="button"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </MobileAppShell>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sidebar-desktop-shell flex flex-col rounded-[34px] border border-[color:var(--panel-border)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <div className="relative w-full">
            <div className="sidebar-desktop-brand-region flex min-h-[268px] w-full items-center justify-center overflow-hidden rounded-[32px] bg-[color:var(--brand-logo-region-bg)]">
              <BrandLogo
                priority
                className="w-full justify-center"
                imageClassName="w-[248px] max-w-none scale-[1.16]"
              />
            </div>
            <div className="absolute right-1 top-1 z-10">
              <ThemeToggle compact />
            </div>
          </div>

          <nav className="mt-8 grid gap-3">
            <button
              className="sidebar-desktop-nav-link sidebar-desktop-nav-link-active rounded-[20px] border border-[color:var(--panel-border-strong)] bg-[linear-gradient(135deg,rgba(86,230,213,0.18),rgba(96,188,255,0.08))] px-4 py-3 text-left text-sm font-semibold text-[color:var(--foreground-strong)]"
              type="button"
            >
              Home
            </button>
            <button
              className="sidebar-desktop-nav-link rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-3 text-left text-sm font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--panel)]"
              onClick={() => router.push("/scratch?view=tickets")}
              type="button"
            >
              Tickets
            </button>
            <button
              className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-3 text-left text-sm font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--panel)]"
              onClick={claimDaily}
              disabled={busy}
              type="button"
            >
              Rewards
            </button>
          </nav>

          <div className="mt-8 rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] p-5">
            <div className="text-sm font-semibold text-[color:var(--foreground-strong)]">Welcome back!</div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
              Use the dashboard to jump into tickets, claim your live daily bonus, and keep the existing balance flow moving.
            </p>
          </div>

          <button
            className="mt-auto rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-4 py-3 text-left text-sm font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--panel)]"
            onClick={logout}
            type="button"
          >
            Log Out
          </button>
        </aside>

        <section className="app-desktop-main-shell rounded-[34px] border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-5 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-medium text-[color:var(--foreground-muted)]">Welcome back!</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground-strong)] sm:text-4xl">
                Hi, {username}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--foreground-muted)]">
                Browse real tickets, keep your live balance in view, and move straight into the existing scratch experience.
              </p>
            </div>

            <div className="grid min-w-[220px] gap-3">
              <div className="flex justify-end">
                <GlobalBalanceAudioHud balance={balance} />
              </div>
              <div className="rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-5 py-4">
                <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Account</div>
                <div className="mt-2 text-base font-semibold text-[color:var(--foreground-strong)]">{email}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="grid gap-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <button
                  className="rounded-[28px] border border-[color:var(--panel-border)] bg-[linear-gradient(135deg,rgba(86,230,213,0.22),rgba(115,240,223,0.1))] p-5 text-left shadow-[var(--shadow-md)] transition hover:translate-y-[-1px]"
                  onClick={() => router.push("/scratch?view=tickets")}
                  type="button"
                >
                  <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Scratch</div>
                  <div className="mt-3 text-2xl font-semibold text-[color:var(--foreground-strong)]">Browse Tickets</div>
                  <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">Jump into the live ticket list and start playing.</div>
                </button>

                <button
                  className="rounded-[28px] border border-[color:var(--panel-border)] bg-[linear-gradient(135deg,rgba(139,92,246,0.28),rgba(115,240,223,0.08))] p-5 text-left shadow-[var(--shadow-md)] transition hover:translate-y-[-1px]"
                  onClick={claimDaily}
                  disabled={busy}
                  type="button"
                >
                  <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Rewards</div>
                  <div className="mt-3 text-2xl font-semibold text-[color:var(--foreground-strong)]">
                    {busy ? "Claiming..." : `Claim +${dailyReward}`}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">Use the existing daily reward action without changing its logic.</div>
                </button>
              </section>

              <section className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Featured Tickets</div>
                    <h2 className="mt-2 text-2xl font-semibold text-[color:var(--foreground-strong)]">Play the real games</h2>
                  </div>
                  <button
                    className="text-sm font-semibold text-[color:var(--teal)]"
                    onClick={() => router.push("/scratch?view=tickets")}
                    type="button"
                  >
                    See All
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {featuredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      className="rounded-[24px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] p-4 text-left shadow-[var(--shadow-md)] transition hover:translate-y-[-1px] hover:border-[color:var(--panel-border-strong)]"
                      onClick={() => router.push(`/scratch?view=tickets&theme=${ticket.themeId}`)}
                      type="button"
                    >
                      <div className="relative h-32 overflow-hidden rounded-[18px] border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)]">
                        <Image src={ticket.art} alt={ticket.title} fill unoptimized className="object-contain p-2" sizes="320px" />
                      </div>
                      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-[color:var(--foreground-faint)]">{ticket.eyebrow}</div>
                      <div className="mt-1 text-xl font-semibold text-[color:var(--foreground-strong)]">{ticket.title}</div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">{ticket.blurb}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-5">
              <section className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Daily Bonus</div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--foreground-strong)]">Claim your live reward</div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-muted)]">
                  This uses the existing daily-claim endpoint and balance refresh flow already in the app.
                </p>
                <button
                  className="mt-4 rounded-[20px] bg-[linear-gradient(135deg,var(--teal),#73f0df)] px-4 py-3 font-semibold text-slate-950 shadow-[0_18px_50px_rgba(87,236,214,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={claimDaily}
                  disabled={busy}
                  type="button"
                >
                  {busy ? "Claiming..." : `Claim Bonus +${dailyReward}`}
                </button>
              </section>

              <section className="rounded-[28px] border border-[color:var(--panel-border)] bg-[color:var(--panel-strong)] p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-[color:var(--foreground-faint)]">Current App Surface</div>
                <div className="mt-2 text-2xl font-semibold text-[color:var(--foreground-strong)]">Live features preserved</div>
                <div className="mt-4 grid gap-3 text-sm text-[color:var(--foreground-muted)]">
                  <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3">Email authentication and session cookies</div>
                  <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3">Scratch ticket launch, reveal, payout, and result handling</div>
                  <div className="rounded-[20px] border border-[color:var(--panel-border)] bg-[color:var(--background-muted)] px-4 py-3">Live balance updates and the current daily reward flow</div>
                </div>
              </section>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-[22px] border border-teal-200/14 bg-teal-300/8 px-4 py-3 text-sm text-teal-100">
              {message}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
