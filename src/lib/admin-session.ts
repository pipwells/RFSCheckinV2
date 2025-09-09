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

const sessionOptions: SessionOptions = {
  password:
    process.env.ADMIN_SESSION_PASSWORD ??
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error(
            "ADMIN_SESSION_PASSWORD is required in production. Set it in Vercel → Settings → Environment Variables."
          );
        })()
      : "dev-only-insecure-password-change-me"),
  cookieName: "admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

/**
 * Get (or create) the admin session.
 * Next 15 note: cookies() is async; iron-session expects a CookieStore-like object.
 * Reading works everywhere; only call session.save() in route handlers/server actions.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const store = await getCookies();
  const session = await getIronSession<{ user?: AdminUser }>(store as any, sessionOptions);
  return session as AdminSession;
}
