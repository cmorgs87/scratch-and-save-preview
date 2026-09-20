import { apiGet } from "@/lib/api";

export type AuthenticatedUser = {
  id: string;
  email: string;
  scratchCoin: number;
  lifetimePointsEarned: number;
  lastDailyClaimAt: string | null;
};

export type MeResponse = { ok: true; user: AuthenticatedUser } | { ok: false; error?: string };

type RawAuthenticatedUser = {
  id: string;
  email: string;
  scratchCoin: number;
  lifetimePointsEarned?: unknown;
  lastDailyClaimAt: string | null;
};

type RawMeResponse = { ok: true; user: RawAuthenticatedUser } | { ok: false; error?: string };

function coerceNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function normalizeAuthenticatedUser(user: RawAuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    scratchCoin: coerceNonNegativeInteger(user.scratchCoin),
    lifetimePointsEarned: coerceNonNegativeInteger(user.lifetimePointsEarned),
    lastDailyClaimAt: user.lastDailyClaimAt,
  };
}

export function normalizeMeResponse(response: RawMeResponse): MeResponse {
  if (!response.ok) {
    return response;
  }

  return {
    ok: true,
    user: normalizeAuthenticatedUser(response.user),
  };
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  const response = await apiGet<RawMeResponse>("/me");
  return normalizeMeResponse(response);
}
