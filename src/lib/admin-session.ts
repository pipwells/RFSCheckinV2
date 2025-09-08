import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies as getCookies, type ResponseCookie } from "next/headers";

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
 * Minimal writable adapter that satisfies iron-session's CookieStore expectations.
 * In RSC (read-only cookies), 'set' will exist only at runtime in route handlers;
 * DO NOT call session.save() in RSC contexts.
 */
type WritableCookieStore = {
  get: (name: string) => any;
  set:
    | ((name: string, value: string, cookie?: Partial<ResponseCookie>) => void)
    | ((options: ResponseCookie) => void);
};

/**
 * Get (or create) the admin session.
 *
 * - In Route Handlers: safe to read & write (session.save()).
 * - In RSC/Server Components: safe to read only; DON'T call session.save().
 */
export async function getAdminSession(): Promise<AdminSession> {
  // Next 15: cookies() is async and may return a read-only store in RSC.
  const raw = await getCookies();

  // Create a typed adapter; in route handlers, raw.set exists (writable).
  // In RSC, raw.set is undefined — reading the session is fine, but saving isn't.
  const store: WritableCookieStore = {
    get: (name: string) => (raw as any).get?.(name),
    set: (...args: any[]) => (raw as any).set?.(...args),
  };

  const session = await getIronSession<{ user?: AdminUser }>(
    store as unknown as WritableCookieStore,
    sessionOptions
  );

  return session as AdminSession;
}
