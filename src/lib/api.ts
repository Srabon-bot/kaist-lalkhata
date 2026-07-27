// Thin client for the server-backed auth endpoints under api/auth/* — see
// PLAN.md. Every call sends credentials so the httpOnly session cookie
// round-trips; the server, not this module, is what actually verifies
// anything (this file has no secrets, just fetch plumbing).

export interface AuthResult {
  accountId: string;
  email: string;
  displayName: string | null;
  isNew: boolean;
  suggestedName?: string;
}

export type ApiErrorCode =
  | "EMAIL_TAKEN"
  | "NOT_FOUND"
  | "WRONG_PASSWORD"
  | "WRONG_PROVIDER"
  | "GOOGLE_TOKEN_INVALID"
  | "UNAUTHENTICATED"
  | "invalid_request"
  | "UNKNOWN";

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode) {
    super(code);
    this.name = "ApiError";
    this.code = code;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("UNKNOWN");
  }

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const code = typeof data.error === "string" ? (data.error as ApiErrorCode) : "UNKNOWN";
    throw new ApiError(code);
  }
  return data as T;
}

export function signup(email: string, password: string): Promise<AuthResult> {
  return postJson("/api/auth/signup", { email, password });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return postJson("/api/auth/login", { email, password });
}

export function loginWithGoogle(accessToken: string): Promise<AuthResult> {
  return postJson("/api/auth/google", { accessToken });
}

export async function setUsername(name: string): Promise<void> {
  await postJson("/api/auth/username", { name });
}

export async function logout(): Promise<void> {
  await postJson("/api/auth/logout", {});
}

export interface SessionInfo {
  authenticated: boolean;
  accountId?: string;
  email?: string;
  displayName?: string | null;
}

/** Checked on app load — a returning device with a valid session cookie
 * skips straight past the welcome page's signup/login step. */
export async function getSession(): Promise<SessionInfo> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}
