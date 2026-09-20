"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";

type MeResponse = { ok: true } | { ok: false };

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    apiGet<MeResponse>("/me")
      .then((data) => {
        if (cancelled) return;
        router.replace(data.ok ? "/home" : "/login");
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-5 py-3 text-sm text-[color:var(--foreground-muted)] shadow-[var(--shadow-md)] backdrop-blur">
        Launching Scratch & Save...
      </div>
    </main>
  );
}
