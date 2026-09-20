const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100";
const ANDROID_EMULATOR_API_BASE = process.env.NEXT_PUBLIC_ANDROID_EMULATOR_API_URL || "http://10.0.2.2:4100";

function resolveApiBase() {
  if (typeof window !== "undefined" && window.location.hostname === "10.0.2.2") {
    return ANDROID_EMULATOR_API_BASE;
  }

  return DEFAULT_API_BASE;
}

export const API_BASE = resolveApiBase();

type ApiErrorPayload = {
  error?: string;
};

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

type Extra = {
  headers?: Record<string, string>;
};

function getApiErrorMessage(data: unknown, status: number) {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = (data as ApiErrorPayload).error;
    if (typeof error === "string" && error) return error;
  }

  return `HTTP ${status}`;
}

function getNetworkErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message === "Failed to fetch") {
      return `Backend unavailable at ${API_BASE}. Start the backend server and try again.`;
    }
    return error.message;
  }

  return `Backend unavailable at ${API_BASE}. Start the backend server and try again.`;
}

export async function apiGet<T>(path: string, extra: Extra = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        ...(extra.headers ?? {}),
      },
      credentials: "include",
    });

    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(getApiErrorMessage(data, response.status));
    return data as T;
  } catch (error: unknown) {
    throw new Error(getNetworkErrorMessage(error));
  }
}

export async function apiPost<T>(path: string, body?: unknown, extra: Extra = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(extra.headers ?? {}),
      },
      credentials: "include",
      body: JSON.stringify(body ?? {}),
    });

    const data = await parseJsonSafe(response);
    if (!response.ok) throw new Error(getApiErrorMessage(data, response.status));
    return data as T;
  } catch (error: unknown) {
    throw new Error(getNetworkErrorMessage(error));
  }
}
