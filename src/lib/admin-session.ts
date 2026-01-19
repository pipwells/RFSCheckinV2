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

/**
 * Get (or create) the admin session.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const store = cookies();
  const sessionOptions = getSessionOptions();

  // Next's cookies() store matches what iron-session needs at runtime, but the TS types
  // don't align across Next versions due to overloaded `set()` signatures.
  return (await getIronSession<{ user?: AdminUser }>(store as unknown as any, sessionOptions)) as AdminSession;
}
