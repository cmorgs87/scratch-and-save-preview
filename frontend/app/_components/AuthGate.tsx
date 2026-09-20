"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";

const PUBLIC_PATHS = ["/", "/login", "/signup"];

export default function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) return;

    let cancelled = false;

    apiGet<{ ok: boolean }>("/me")
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) router.replace("/login");
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
