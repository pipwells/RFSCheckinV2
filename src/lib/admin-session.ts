import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies as getCookies } from "next/headers";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: "owner" | "admin" | "staff" | "super_admin";
  organisationId?: string;
};

// The IronSession generic describes the shape stored in the session.
export type AdminSession = IronSession<{ user?: AdminUser }>;

// Configure cookie/session options
const sessionOptions: SessionOptions = {
  // In dev we allow a default; in prod we require an env var.
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
 * Get (or create) the admin session using Next.js App Router cookies().
 * Next 15 note: cookies() is async and returns a *readonly* store; iron-session
 * expects a mutable store. We await it and cast to the expected type.
 */
export async function getAdminSession(): Promise<AdminSession> {
  const cookieStore = await getCookies(); // Promise<ReadonlyRequestCookies> in Next 15
  // Cast to the writable CookieStore that iron-session expects
  const session = await getIronSession<{ user?: AdminUser }>(
    cookieStore as unknown as { get: (name: string) => any; set: (name: string, value: any) => void },
    sessionOptions
  );
  return session as AdminSession;
}
