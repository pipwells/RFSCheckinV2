import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies as getCookies } from "next/headers";

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
    (process.env.NODE_ENV === "production"
      ? null
      : "dev-only-insecure-password-change-me");

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
  const store = await getCookies();
  const sessionOptions = getSessionOptions();
  const session = await getIronSession<{ user?: AdminUser }>(store as any, sessionOptions);
  return session as AdminSession;
}
