// src/lib/admin-session.ts
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: "owner" | "admin" | "staff" | "super_admin";
  organisationId?: string;
};

export type AdminSession = IronSession<{ user?: AdminUser }>;

function getSessionOptions(): SessionOptions {
  const password =
    process.env.ADMIN_SESSION_PASSWORD ??
    (process.env.NODE_ENV === "production" ? null : "dev-only-insecure-password-change-me");

  if (!password) {
    throw new Error(
      "ADMIN_SESSION_PASSWORD is required in production. Set it in Vercel → Settings → Environment Variables."
    );
  }

  return {
    password,
    cookieName: "admin_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}

type CookieStoreLike = {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options?: unknown) => void;
};

/**
 * Get (or create) the admin session.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const store = cookies();

  // iron-session wants something CookieStore-ish; Next's cookies() matches at runtime.
  const cookieStore = store as unknown as CookieStoreLike;

  const sessionOptions = getSessionOptions();
  return getIronSession<{ user?: AdminUser }>(cookieStore, sessionOptions) as Promise<AdminSession>;
}
